// supabase/functions/cancel-subscription/index.ts
// Cancels a Stripe subscription and downgrades user to free plan

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Missing token' }, 401)
    const token = authHeader.replace('Bearer ', '').trim()

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('[CANCEL] Auth error:', authError?.message)
      return json({ error: 'Unauthorized' }, 401)
    }

    // ── Get user's subscription ────────────────────────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, plan')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      console.error('[CANCEL] Profile fetch error:', profileErr?.message)
      return json({ error: 'User not found' }, 404)
    }

    const subscriptionId = (profile as any)?.stripe_subscription_id
    const currentPlan = (profile as any)?.plan

    // Already on free plan
    if (currentPlan === 'free' || !subscriptionId) {
      return json({ success: true, message: 'Already on free plan' }, 200)
    }

    // ── Cancel Stripe subscription ─────────────────────────────────────────
    console.log(`[CANCEL] Cancelling subscription ${subscriptionId} for user ${user.id}`)

    const cancelRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      },
    })

    const canceledSub = await cancelRes.json()

    if (!cancelRes.ok) {
      console.error('[CANCEL] Stripe error:', canceledSub?.error)
      return json({ error: canceledSub?.error?.message || 'Failed to cancel subscription' }, 500)
    }

    // ── Update Supabase: downgrade to free ─────────────────────────────────
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        plan: 'free',
        subscription_plan: 'free',
        subscription_status: 'cancelled',
        stripe_subscription_id: null,
      })
      .eq('id', user.id)

    if (updateErr) {
      console.error('[CANCEL] Update error:', updateErr.message)
      return json({ error: 'Failed to update plan' }, 500)
    }

    console.log(`[CANCEL] User ${user.id} downgraded to free plan ✓`)

    return json({ success: true, plan: 'free' }, 200)

  } catch (err) {
    console.error('[CANCEL] Unexpected error:', err)
    return json({ error: String(err) }, 500)
  }
})
