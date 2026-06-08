// supabase/functions/stripe-webhook/index.ts
// Handles Stripe webhook events: subscription updates, cancellations, etc.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Verify Stripe webhook signature
async function verifyWebhookSignature(req: Request, secret: string): Promise<Record<string, any> | null> {
  try {
    const body = await req.clone().text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      console.error('[WEBHOOK] Missing stripe-signature header')
      return null
    }

    // Import crypto for signature verification
    const encoder = new TextEncoder()
    const parts = signature.split(',')
    let timestamp = ''
    let hash = ''

    for (const part of parts) {
      if (part.startsWith('t=')) timestamp = part.slice(2)
      if (part.startsWith('v1=')) hash = part.slice(3)
    }

    if (!timestamp || !hash) {
      console.error('[WEBHOOK] Invalid signature format')
      return null
    }

    // Verify timestamp (within 5 minutes)
    const now = Math.floor(Date.now() / 1000)
    const ts = parseInt(timestamp)
    if (Math.abs(now - ts) > 300) {
      console.error('[WEBHOOK] Signature timestamp too old')
      return null
    }

    // Verify signature using HMAC-SHA256
    const signedContent = `${timestamp}.${body}`
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signature_computed = await crypto.subtle.sign('HMAC', key, encoder.encode(signedContent))
    const computedHash = Array.from(new Uint8Array(signature_computed))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    if (computedHash !== hash) {
      console.error('[WEBHOOK] Invalid signature')
      return null
    }

    return JSON.parse(body)
  } catch (err) {
    console.error('[WEBHOOK] Verification error:', err)
    return null
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    if (!STRIPE_WEBHOOK_SECRET) {
      console.error('[WEBHOOK] Missing STRIPE_WEBHOOK_SECRET')
      return new Response(JSON.stringify({ error: 'Missing webhook secret' }), { status: 500, headers: CORS })
    }

    // Verify webhook signature
    const event = await verifyWebhookSignature(req, STRIPE_WEBHOOK_SECRET)
    if (!event) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400, headers: CORS })
    }

    console.log(`[WEBHOOK] Event: ${event.type}`)

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Handle subscription events
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const userId = subscription.metadata?.user_id

        if (!userId) {
          console.warn('[WEBHOOK] No user_id in subscription metadata')
          return new Response(JSON.stringify({ received: true }), { status: 200, headers: CORS })
        }

        const plan = subscription.metadata?.plan || 'business'
        const status = subscription.status === 'active' ? 'active' : 'inactive'

        console.log(`[WEBHOOK] Updating user ${userId} to plan ${plan}, status ${status}`)

        await supabase
          .from('profiles')
          .update({
            plan,
            subscription_plan: plan,
            subscription_status: status,
            stripe_subscription_id: subscription.id,
          })
          .eq('id', userId)

        return new Response(JSON.stringify({ received: true }), { status: 200, headers: CORS })
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const userId = subscription.metadata?.user_id

        if (!userId) {
          console.warn('[WEBHOOK] No user_id in subscription metadata')
          return new Response(JSON.stringify({ received: true }), { status: 200, headers: CORS })
        }

        console.log(`[WEBHOOK] Cancelling subscription for user ${userId}`)

        await supabase
          .from('profiles')
          .update({
            plan: 'free',
            subscription_plan: 'free',
            subscription_status: 'cancelled',
            stripe_subscription_id: null,
          })
          .eq('id', userId)

        return new Response(JSON.stringify({ received: true }), { status: 200, headers: CORS })
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        const subscriptionId = invoice.subscription

        if (!subscriptionId) {
          return new Response(JSON.stringify({ received: true }), { status: 200, headers: CORS })
        }

        console.log(`[WEBHOOK] Payment succeeded for subscription ${subscriptionId}`)
        // Payment already handled by subscription.updated event
        return new Response(JSON.stringify({ received: true }), { status: 200, headers: CORS })
      }

      default:
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`)
        return new Response(JSON.stringify({ received: true }), { status: 200, headers: CORS })
    }

  } catch (err) {
    console.error('[WEBHOOK] Error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
