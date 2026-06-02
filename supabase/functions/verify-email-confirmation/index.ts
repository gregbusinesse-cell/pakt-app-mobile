// supabase/functions/verify-email-confirmation/index.ts
// GET ?token=xxx  → HTML confirmation page
// POST {token}    → JSON response (mobile app)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Shared verification logic ────────────────────────────────────────────────
async function verifyToken(token: string) {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

  const { data: rec } = await sb.from('confirmation_tokens').select('*').eq('token', token).single()
  if (!rec)           return { ok: false, reason: 'invalid' }
  if (rec.used_at)    return { ok: false, reason: 'already_used' }
  if (new Date() > new Date(rec.expires_at)) return { ok: false, reason: 'expired' }

  const { data: { users } } = await sb.auth.admin.listUsers()
  const user = users?.find((u: any) => u.email === rec.email)
  if (!user) return { ok: false, reason: 'user_not_found' }

  const { error } = await sb.auth.admin.updateUserById(user.id, { email_confirm: true })
  if (error) return { ok: false, reason: 'server_error' }

  await sb.from('confirmation_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)
  await sb.from('profiles').update({ email_confirmed: true, email: rec.email }).eq('id', user.id)

  return { ok: true, user_id: user.id, email: rec.email }
}

// ─── HTML page ────────────────────────────────────────────────────────────────
function makePage(ok: boolean, title: string, msg: string, sub = '') {
  const color = ok ? '#d4a853' : '#ff4444'
  const symbol = ok ? '&#10003;' : '!'
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>PAKT</title>
<style>
body{margin:0;padding:24px;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
.logo{font-size:30px;font-weight:900;letter-spacing:8px;color:#d4a853;margin-bottom:36px;text-align:center}
.card{background:#161616;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:36px 28px;max-width:380px;width:100%;text-align:center}
.circle{width:68px;height:68px;border-radius:50%;background:${color};color:#000;font-size:28px;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
h1{color:#fff;font-size:20px;font-weight:800;margin:0 0 10px}
.sub{color:rgba(255,255,255,0.5);font-size:14px;line-height:1.7;margin:0}
.box{background:rgba(212,168,83,0.08);border:1px solid rgba(212,168,83,0.2);border-radius:12px;padding:14px 16px;margin-top:20px}
.box p{color:#d4a853;font-weight:600;font-size:13px;margin:0}
.btn{display:inline-block;margin-top:18px;background:#d4a853;color:#000;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:10px}
footer{color:rgba(255,255,255,0.15);font-size:11px;margin-top:24px;text-align:center}
</style>
</head>
<body>
<div class="logo">PAKT</div>
<div class="card">
  <div class="circle">${symbol}</div>
  <h1>${title}</h1>
  <p class="sub">${msg}</p>
  ${sub}
</div>
<footer>PAKT &copy; 2026</footer>
</body>
</html>`
}

// ─── Handler (modern Deno.serve API) ─────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const url = new URL(req.url)

  // GET — user clicked the confirmation link in their email
  if (req.method === 'GET') {
    const token = url.searchParams.get('token')

    if (!token) {
      return new Response(makePage(false, 'Lien invalide', 'Ce lien de confirmation est invalide.'), {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' },
      })
    }

    const result = await verifyToken(token)

    if (!result.ok) {
      if (result.reason === 'already_used') {
        return new Response(makePage(true, 'D&eacute;j&agrave; confirm&eacute;', 'Ton email a d&eacute;j&agrave; &eacute;t&eacute; confirm&eacute;.',
          `<div class="box"><p>Ouvre l'app PAKT sur ton t&eacute;l&eacute;phone et connecte-toi.</p></div>
           <a class="btn" href="pakt://auth">Ouvrir PAKT</a>`), {
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        })
      }
      if (result.reason === 'expired') {
        return new Response(makePage(false, 'Lien expir&eacute;', 'Ce lien a expir&eacute; (validit&eacute; 24h). Cr&eacute;e un nouveau compte.'), {
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        })
      }
      return new Response(makePage(false, 'Lien invalide', 'Ce lien est invalide. Contacte-nous : paktsupport@gmail.com'), {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' },
      })
    }

    return new Response(
      makePage(true, 'Email confirm&eacute;&nbsp;!',
        'Ton adresse email a bien &eacute;t&eacute; confirm&eacute;e.<br>Ton compte PAKT est maintenant actif.',
        `<div class="box"><p>Retourne sur l&apos;application mobile PAKT et connecte-toi avec ton mot de passe.</p></div>
         <a class="btn" href="pakt://auth">Ouvrir PAKT</a>`
      ),
      { headers: { 'Content-Type': 'text/html; charset=UTF-8' } }
    )
  }

  // POST — called from the mobile app (JSON)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } })

  try {
    const { token } = await req.json().catch(() => ({}))
    if (!token) return new Response(JSON.stringify({ success: false, error: 'Token requis' }), { headers: { 'Content-Type': 'application/json', ...CORS } })

    const result = await verifyToken(token)
    if (!result.ok) {
      const msgs: Record<string, string> = { invalid: 'Lien invalide.', already_used: 'Email deja confirme.', expired: 'Lien expire.', server_error: 'Erreur serveur.', user_not_found: 'Utilisateur introuvable.' }
      return new Response(JSON.stringify({ success: false, error: msgs[result.reason as string] || 'Erreur.' }), { headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    return new Response(JSON.stringify({ success: true, user_id: result.user_id, email: result.email }), { headers: { 'Content-Type': 'application/json', ...CORS } })

  } catch (err) {
    console.error('[VERIFY]', err)
    return new Response(JSON.stringify({ success: false, error: 'Erreur serveur.' }), { headers: { 'Content-Type': 'application/json', ...CORS } })
  }
})
