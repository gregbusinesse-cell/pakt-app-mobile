// supabase/functions/validate-iap-receipt/index.ts
// Validates Apple In-App Purchase receipt and updates subscription plan

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const APPLE_SHARED_SECRET = Deno.env.get('APPLE_SHARED_SECRET') // For receipt validation

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })

/**
 * Validate receipt with Apple's receipt validation service
 * Uses the legacy App Store Receipt Validation endpoint for simplicity
 */
async function validateReceiptWithApple(receipt: string): Promise<{
  valid: boolean
  bundle_id?: string
  product_id?: string
  transaction_id?: string
  expires_date?: number
}> {
  try {
    // Try production endpoint first
    const response = await fetch('https://buy.itunes.apple.com/verifyReceipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receipt,
        password: APPLE_SHARED_SECRET || '',
      }),
    })

    const data = await response.json()

    // Status 0 = valid, 21007 = test receipt, try sandbox
    if (data.status === 21007) {
      console.log('[IAP] Test receipt, trying sandbox...')
      const sandboxResponse = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'receipt-data': receipt,
          password: APPLE_SHARED_SECRET || '',
        }),
      })
      const sandboxData = await sandboxResponse.json()
      if (sandboxData.status === 0) {
        return parseReceiptData(sandboxData)
      }
    }

    if (data.status === 0) {
      return parseReceiptData(data)
    }

    console.error('[IAP] Apple validation error. Status:', data.status)
    return { valid: false }
  } catch (err) {
    console.error('[IAP] Apple request error:', err)
    return { valid: false }
  }
}

/**
 * Extract relevant data from Apple's receipt response
 */
function parseReceiptData(data: any): {
  valid: boolean
  bundle_id?: string
  product_id?: string
  transaction_id?: string
  expires_date?: number
} {
  if (!data.receipt) {
    return { valid: false }
  }

  const receipt = data.receipt
  const inApp = data.latest_receipt_info?.[0] || receipt.in_app?.[0]

  return {
    valid: true,
    bundle_id: receipt.bundle_id,
    product_id: inApp?.product_id,
    transaction_id: inApp?.transaction_id,
    expires_date: parseInt(inApp?.expires_date_ms || '0'),
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing token' }, 401)
    }
    const token = authHeader.replace('Bearer ', '').trim()

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('[IAP] Auth error:', authError?.message)
      return json({ error: 'Unauthorized' }, 401)
    }

    // ── Parse body ────────────────────────────────────────────────────────
    const { receipt, plan, transactionId } = await req.json()

    if (!receipt || !plan || !transactionId) {
      return json({ error: 'Missing receipt, plan, or transactionId' }, 400)
    }

    if (plan !== 'business' && plan !== 'business_pro') {
      return json({ error: `Invalid plan: ${plan}` }, 400)
    }

    console.log('[IAP] Validating receipt for user:', user.id, '| Plan:', plan)

    // ── Validate receipt with Apple ───────────────────────────────────────
    const validation = await validateReceiptWithApple(receipt)

    if (!validation.valid) {
      console.error('[IAP] Receipt validation failed')
      return json({ success: false, reason: 'Invalid receipt' }, 400)
    }

    console.log('[IAP] Receipt validated:', {
      product_id: validation.product_id,
      bundle_id: validation.bundle_id,
    })

    // ── Update subscription in database ───────────────────────────────────
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        plan,
        subscription_plan: plan,
        subscription_status: 'active',
        iap_transaction_id: transactionId,
        iap_platform: 'ios',
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[IAP] Database update error:', updateError)
      return json({ error: 'Failed to update subscription' }, 500)
    }

    console.log('[IAP] Subscription updated for user:', user.id)

    return json({
      success: true,
      plan,
      transaction_id: transactionId,
    })
  } catch (err) {
    console.error('[IAP] Unexpected error:', err)
    return json({ error: String(err) }, 500)
  }
})
