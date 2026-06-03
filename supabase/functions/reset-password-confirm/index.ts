// reset-password-confirm: Validate token + update password

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
    const { token, newPassword } = await req.json().catch(() => ({}))
    if (!token || !newPassword) return err('Token et mot de passe requis')
    if (newPassword.length < 6) return err('Le mot de passe doit contenir au moins 6 caractères')

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

    // Validate token
    const { data: rec } = await sb.from('password_reset_tokens').select('*').eq('token', token).single()
    if (!rec) return err('Lien invalide ou expiré')
    if (rec.used_at) return err('Ce lien a déjà été utilisé')
    if (new Date() > new Date(rec.expires_at)) return err('Ce lien a expiré')

    // Update password
    const { error: updateErr } = await sb.auth.admin.updateUserById(rec.user_id, { password: newPassword })
    if (updateErr) return err('Impossible de mettre à jour le mot de passe')

    // Mark token used
    await sb.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)

    return ok({ message: 'Mot de passe mis à jour' })

  } catch (e) {
    console.error('[RESET CONFIRM] Error:', e)
    return err('Erreur serveur')
  }
})
