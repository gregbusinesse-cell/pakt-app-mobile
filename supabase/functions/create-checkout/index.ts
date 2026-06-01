// supabase/functions/create-checkout/index.ts
// Creates a Stripe Checkout session for Business or Business Pro plan

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const STRIPE_SECRET_KEY    = Deno.env.get('STRIPE_SECRET_KEY')
const PRICE_BUSINESS       = Deno.env.get('STRIPE_PRICE_ID_BUSINESS')
const PRICE_PRO            = Deno.env.get('STRIPE_PRICE_ID_PRO')
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// CORS headers – required for all Edge Function calls from mobile/web
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    // ── 1. Config check ────────────────────────────────────────────────────────
    if (!STRIPE_SECRET_KEY || !PRICE_BUSINESS || !PRICE_PRO) {
      console.error('[CHECKOUT] Missing secrets:', {
        hasStripe: !!STRIPE_SECRET_KEY,
        hasBusiness: !!PRICE_BUSINESS,
        hasPro: !!PRICE_PRO,
      })
      return json({ error: 'Payment service not configured' }, 500)
    }

    // ── 2. Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    console.log('[CHECKOUT] Auth header present:', !!authHeader)

    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing or invalid Authorization header' }, 401)
    }
    const token = authHeader.replace('Bearer ', '').trim()

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('[CHECKOUT] Auth error:', authError?.message)
      return json({ error: 'Unauthorized' }, 401)
    }
    console.log('[CHECKOUT] User authenticated:', user.id)

    // ── 3. Parse plan ──────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { plan } = body

    if (plan !== 'business' && plan !== 'business_pro') {
      return json({ error: `Invalid plan: ${plan}` }, 400)
    }

    const priceId = plan === 'business' ? PRICE_BUSINESS : PRICE_PRO
    console.log('[CHECKOUT] Plan:', plan, '→ Price:', priceId)

    // ── 4. Get or create Stripe customer ───────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId: string | null = (profile as any)?.stripe_customer_id || null
    const email = (profile as any)?.email || user.email || ''

    if (!customerId) {
      console.log('[CHECKOUT] Creating Stripe customer for:', email)
      const res = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email,
          'metadata[user_id]': user.id,
        }),
      })
      const customer = await res.json()
      if (!res.ok) {
        console.error('[CHECKOUT] Stripe customer error:', customer)
        return json({ error: customer.error?.message || 'Failed to create customer' }, 500)
      }
      customerId = customer.id

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    console.log('[CHECKOUT] Customer:', customerId)

    // ── 5. Create Stripe Checkout Session ──────────────────────────────────────
    // Use Vercel web app as success/cancel URL (HTTPS required, then app uses deep link)
    // The webhook will update the plan in Supabase
    const baseUrl = 'https://pakt-sigma.vercel.app'

    const params = new URLSearchParams()
    params.append('mode', 'subscription')
    params.append('customer', customerId)
    params.append('line_items[0][price]', priceId)
    params.append('line_items[0][quantity]', '1')
    // After payment, redirect to web app which redirects back to mobile app
    params.append('success_url', `${baseUrl}/payment/mobile-success?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`)
    params.append('cancel_url', `${baseUrl}/payment/mobile-cancel`)
    params.append('metadata[user_id]', user.id)
    params.append('metadata[plan]', plan)
    params.append('metadata[price_id]', priceId)
    params.append('metadata[platform]', 'mobile')
    params.append('subscription_data[metadata][user_id]', user.id)
    params.append('subscription_data[metadata][plan]', plan)
    params.append('subscription_data[metadata][price_id]', priceId)
    params.append('allow_promotion_codes', 'true')

    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const session = await sessionRes.json()

    if (!sessionRes.ok) {
      console.error('[CHECKOUT] Stripe session error:', session)
      return json({ error: session.error?.message || 'Failed to create checkout session' }, 500)
    }

    console.log('[CHECKOUT] Session created:', session.id)
    return json({ url: session.url, session_id: session.id })

  } catch (err) {
    console.error('[CHECKOUT] Unexpected error:', err)
    return json({ error: String(err) }, 500)
  }
})
