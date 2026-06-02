// supabase/functions/confirm-payment/index.ts
// Called when user returns to the app after Stripe checkout
// Verifies the session and manually updates the plan if webhook hasn't fired yet

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing token' }), { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '').trim()

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { session_id, plan } = await req.json()

    if (!session_id || !plan) {
      return new Response(JSON.stringify({ error: 'Missing session_id or plan' }), { status: 400 })
    }

    // Verify with Stripe that the session is paid
    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` }
    })
    const session = await stripeRes.json()

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return new Response(
        JSON.stringify({ success: false, reason: 'Payment not completed' }),
        { status: 200 }
      )
    }

    // Verify user_id matches
    if (session.metadata?.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'User mismatch' }), { status: 403 })
    }

    // Update BOTH plan fields for consistency
    await supabase
      .from('profiles')
      .update({
        plan: plan,
        subscription_plan: plan,
        subscription_status: 'active',
        stripe_subscription_id: session.subscription || null,
      })
      .eq('id', user.id)

    console.log(`[CONFIRM] Plan ${plan} activated for user ${user.id}`)

    return new Response(
      JSON.stringify({ success: true, plan }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[CONFIRM] Error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
