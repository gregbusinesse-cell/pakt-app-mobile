// supabase/functions/create-checkout/index.ts
// Creates a Stripe Checkout session for Business or Business Pro plan

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const STRIPE_SECRET_KEY    = Deno.env.get('STRIPE_SECRET_KEY')
const PRICE_BUSINESS       = Deno.env.get('STRIPE_PRICE_ID_BUSINESS')
const PRICE_PRO            = Deno.env.get('STRIPE_PRICE_ID_PRO')
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })

// ─── Create a Stripe customer ─────────────────────────────────────────────────
async function createStripeCustomer(email: string, userId: string) {
  const res = await fetch('https://api.stripe.com/v1/customers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ email, 'metadata[user_id]': userId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Failed to create Stripe customer')
  return data.id as string
}

// ─── Create a Stripe Checkout session ────────────────────────────────────────
async function createCheckoutSession(customerId: string, priceId: string, plan: string, userId: string) {
  const baseUrl = 'https://pakt-sigma.vercel.app'
  const params = new URLSearchParams()
  params.append('mode', 'subscription')
  params.append('customer', customerId)
  params.append('line_items[0][price]', priceId)
  params.append('line_items[0][quantity]', '1')
  params.append('success_url', `${baseUrl}/payment/mobile-success?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`)
  params.append('cancel_url', `${baseUrl}/payment/mobile-cancel`)
  params.append('metadata[user_id]', userId)
  params.append('metadata[plan]', plan)
  params.append('metadata[price_id]', priceId)
  params.append('metadata[platform]', 'mobile')
  params.append('subscription_data[metadata][user_id]', userId)
  params.append('subscription_data[metadata][plan]', plan)
  params.append('subscription_data[metadata][price_id]', priceId)
  params.append('allow_promotion_codes', 'true')

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
  const data = await res.json()
  return { ok: res.ok, data }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    // ── Config check ──────────────────────────────────────────────────────────
    if (!STRIPE_SECRET_KEY || !PRICE_BUSINESS || !PRICE_PRO) {
      console.error('[CHECKOUT] Missing secrets')
      return json({ error: 'Payment not configured' }, 500)
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Missing token' }, 401)
    const token = authHeader.replace('Bearer ', '').trim()

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('[CHECKOUT] Auth error:', authError?.message)
      return json({ error: 'Unauthorized' }, 401)
    }

    // ── Plan ──────────────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { plan } = body
    if (plan !== 'business' && plan !== 'business_pro') return json({ error: `Invalid plan: ${plan}` }, 400)

    const priceId = plan === 'business' ? PRICE_BUSINESS : PRICE_PRO
    console.log('[CHECKOUT] User:', user.id, '| Plan:', plan, '| Price:', priceId)

    // ── Get/Create Stripe customer ────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, stripe_customer_id')
      .eq('id', user.id)
      .single()

    const email = (profile as any)?.email || user.email || ''
    let customerId: string | null = (profile as any)?.stripe_customer_id || null

    if (!customerId) {
      console.log('[CHECKOUT] Creating new customer for:', email)
      customerId = await createStripeCustomer(email, user.id)
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    // ── Create checkout session ───────────────────────────────────────────────
    let { ok, data: session } = await createCheckoutSession(customerId!, priceId!, plan, user.id)

    // If customer doesn't exist in this Stripe account (e.g. old test customer),
    // clear it and create a fresh one
    if (!ok && (session?.error?.code === 'resource_missing' || session?.error?.message?.includes('No such customer'))) {
      console.log('[CHECKOUT] Customer not found, creating fresh one...')
      customerId = await createStripeCustomer(email, user.id)
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
      const retry = await createCheckoutSession(customerId!, priceId!, plan, user.id)
      ok = retry.ok
      session = retry.data
    }

    if (!ok || !session?.url) {
      console.error('[CHECKOUT] Stripe error:', session?.error)
      return json({ error: session?.error?.message || 'Failed to create checkout session' }, 500)
    }

    console.log('[CHECKOUT] Session created:', session.id)
    return json({ url: session.url, session_id: session.id })

  } catch (err) {
    console.error('[CHECKOUT] Unexpected error:', err)
    return json({ error: String(err) }, 500)
  }
})
