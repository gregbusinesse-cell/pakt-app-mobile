// use-referral-code: User enters a referral code after signup
// Validates code from profiles table, records in referrals table

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ok  = (d: object) => new Response(JSON.stringify({ success: true,  ...d }), { status: 200, headers: { 'content-type': 'application/json', ...CORS } })
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

    const { code } = await req.json().catch(() => ({}))
    if (!code) return err('Code requis')

    const cleanCode = code.trim().toUpperCase()

    // Check user hasn't already used a referral code
    const { data: myProfile } = await sb.from('profiles').select('referred_by_code, referral_code').eq('id', user.id).single()
    if ((myProfile as any)?.referred_by_code) return err('Tu as déjà utilisé un code de parrainage.')

    // Find referrer by their referral_code in profiles
    const { data: referrer } = await sb.from('profiles').select('id, referral_code').eq('referral_code', cleanCode).single()
    if (!referrer) return err('Code invalide. Vérifie et réessaie.')

    // Can't use your own code
    if (referrer.id === user.id) return err('Tu ne peux pas utiliser ton propre code.')

    // Record in referrals table (using actual schema)
    await sb.from('referrals').insert({
      referred_id: user.id,
      referral_code: cleanCode,
      status: 'pending',
    })

    // Link on the new user's profile
    await sb.from('profiles').update({ referred_by_code: cleanCode } as any).eq('id', user.id)

    // Count total referrals for the referrer
    const { count } = await sb.from('referrals').select('*', { count: 'exact', head: true }).eq('referral_code', cleanCode)

    console.log(`[REFERRAL] ${user.id} used code ${cleanCode} from ${referrer.id}, total: ${count}`)
    return ok({ message: 'Code appliqué !', referral_count: count || 1 })

  } catch (e) {
    console.error('[REFERRAL] Error:', e)
    return err('Erreur serveur')
  }
})
