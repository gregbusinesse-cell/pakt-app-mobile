// supabase/functions/create-checkout/index.ts
// Creates a Stripe Checkout session for Business or Business Pro plan
// Returns a checkout URL that the mobile app opens in the browser

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const STRIPE_PRICE_ID_BUSINESS = Deno.env.get('STRIPE_PRICE_ID_BUSINESS')
const STRIPE_PRICE_ID_PRO = Deno.env.get('STRIPE_PRICE_ID_PRO')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing token' }), { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '').trim()

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    })

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    // ── 2. Get plan from request ──────────────────────────────────────────────
    const body = await req.json()
    const { plan } = body // 'business' or 'business_pro'

    if (plan !== 'business' && plan !== 'business_pro') {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), { status: 400 })
    }

    const priceId = plan === 'business' ? STRIPE_PRICE_ID_BUSINESS : STRIPE_PRICE_ID_PRO

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: `Price ID for ${plan} not configured` }),
        { status: 500 }
      )
    }

    if (!STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Stripe not configured' }), { status: 500 })
    }

    // ── 3. Get or create Stripe customer ──────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId: string | null = profile?.stripe_customer_id || null

    if (!customerId) {
      // Create new Stripe customer
      const customerRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: profile?.email || user.email || '',
          'metadata[user_id]': user.id,
        }),
      })
      const customer = await customerRes.json()
      customerId = customer.id

      // Save customer ID
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // ── 4. Create Stripe Checkout Session ────────────────────────────────────
    // Deep links: pakt://payment/success and pakt://payment/cancel
    const params = new URLSearchParams({
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      // Deep link back to the app after payment
      success_url: `pakt://payment/success?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `pakt://payment/cancel`,
      'metadata[user_id]': user.id,
      'metadata[plan]': plan,
      'metadata[price_id]': priceId,
      'subscription_data[metadata][user_id]': user.id,
      'subscription_data[metadata][plan]': plan,
      allow_promotion_codes: 'true',
    })

    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const session = await sessionRes.json()

    if (!sessionRes.ok || !session.url) {
      console.error('[CHECKOUT] Stripe error:', session)
      return new Response(
        JSON.stringify({ error: session.error?.message || 'Failed to create checkout' }),
        { status: 500 }
      )
    }

    console.log(`[CHECKOUT] Created session for user ${user.id}, plan ${plan}`)

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[CHECKOUT] Error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error', details: String(err) }),
      { status: 500 }
    )
  }
})
