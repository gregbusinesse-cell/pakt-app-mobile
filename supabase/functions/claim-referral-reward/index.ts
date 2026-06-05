// claim-referral-reward: User claims a referral reward
// Adds plan days based on referral count

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ok = (d: object) => new Response(JSON.stringify({ success: true, ...d }), { status: 200, headers: { 'content-type': 'application/json', ...CORS } })
const err = (msg: string) => new Response(JSON.stringify({ success: false, error: msg }), { status: 200, headers: { 'content-type': 'application/json', ...CORS } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return err('Non authentifié')

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
    const { data: { user }, error: authErr } = await sb.auth.getUser(token)
    if (authErr || !user) return err('Utilisateur introuvable')

    const { requiredCount, planDays } = await req.json().catch(() => ({}))
    if (!requiredCount || !planDays) return err('Paramètres requis')

    // Get user's profile
    const { data: profile } = await sb.from('profiles').select('id, referral_code, subscription_plan, subscription_end_date').eq('id', user.id).single()
    if (!profile) return err('Profil introuvable')

    // Count how many referrals this user has
    const { count: refCount } = await sb.from('referrals').select('*', { count: 'exact', head: true }).eq('referral_code', profile.referral_code)
    const referralCount = refCount || 0

    if (referralCount < requiredCount) return err(`Tu dois avoir au moins ${requiredCount} amis invités.`)

    // Parse days from planDays (e.g., "3J Business", "1M Business Pro")
    const daysMatch = planDays.match(/(\d+)([JM])/)
    if (!daysMatch) return err('Format de récompense invalide')

    const amount = parseInt(daysMatch[1])
    const unit = daysMatch[2] // 'J' = jours, 'M' = mois (30 jours)
    const daysToAdd = unit === 'M' ? amount * 30 : amount

    // Extract plan type (Business or Business Pro)
    const planType = planDays.includes('Pro') ? 'business_pro' : 'business'

    // Calculate new subscription end date
    const now = new Date()
    const currentEndDate = profile.subscription_end_date ? new Date(profile.subscription_end_date) : now
    const isExpired = currentEndDate < now

    // If plan is expired or doesn't exist, set from now
    // If plan is active, add to existing end date
    const newEndDate = isExpired ? new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000) : new Date(currentEndDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000)

    // Update profile
    const { error: updateErr } = await sb.from('profiles').update({
      subscription_plan: planType,
      subscription_end_date: newEndDate.toISOString(),
      subscription_status: 'active',
    }).eq('id', user.id)

    if (updateErr) throw updateErr

    // Record the claimed reward
    await sb.from('referral_rewards_claimed').insert({
      user_id: user.id,
      required_count: requiredCount,
      plan_type: planType,
      days_added: daysToAdd,
      claimed_at: new Date().toISOString(),
    }).then(() => {}, () => {}) // Ignore errors if table doesn't exist yet

    console.log(`[REWARD] ${user.id} claimed reward for ${requiredCount} referrals: ${daysToAdd} days ${planType}`)
    return ok({ message: `Récompense activée : ${planDays} !` })

  } catch (e: any) {
    console.error('[REWARD] Error:', e)
    return err(e.message || 'Erreur serveur')
  }
})
