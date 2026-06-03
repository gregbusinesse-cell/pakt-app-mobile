// use-referral-code: User enters a referral code after signup
// Validates the code, links the referral, increments the referrer's count

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
    // Auth
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
    const { data: myProfile } = await sb.from('profiles').select('referred_by_code').eq('id', user.id).single()
    if (myProfile?.referred_by_code) return err('Tu as déjà utilisé un code de parrainage.')

    // Find referrer by code
    const { data: referral } = await sb.from('referrals').select('user_id, referral_count').eq('referral_code', cleanCode).single()
    if (!referral) return err('Code invalide. Vérifie et réessaie.')

    // Can't use your own code
    if (referral.user_id === user.id) return err('Tu ne peux pas utiliser ton propre code.')

    // Link the referral on the new user's profile
    await sb.from('profiles').update({ referred_by_code: cleanCode }).eq('id', user.id)

    // Increment referrer's count
    await sb.from('referrals').update({
      referral_count: (referral.referral_count || 0) + 1,
    }).eq('referral_code', cleanCode)

    console.log(`[REFERRAL] ${user.id} used code ${cleanCode} from ${referral.user_id}`)
    return ok({ message: 'Code appliqué !', referral_count: (referral.referral_count || 0) + 1 })

  } catch (e) {
    console.error('[REFERRAL] Error:', e)
    return err('Erreur serveur')
  }
})
