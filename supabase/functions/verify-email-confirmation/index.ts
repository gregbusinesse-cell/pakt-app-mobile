// supabase/functions/verify-email-confirmation/index.ts
// GET  ?token=xxx  -> renders HTML page (from email link click, PC or mobile)
// POST {token}     -> returns JSON (from mobile app)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Always render as proper HTML (lowercase content-type for Deno)
function htmlPage(body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  })
}

function jsonRes(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  })
}

// ─── Shared verification logic ────────────────────────────────────────────────
async function verifyToken(token: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })

  const { data: rec, error } = await supabase
    .from('confirmation_tokens')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !rec)   return { ok: false, reason: 'invalid' as const }
  if (rec.used_at)     return { ok: false, reason: 'already_used' as const }
  if (new Date() > new Date(rec.expires_at)) return { ok: false, reason: 'expired' as const }

  const { data: users, error: usersErr } = await supabase.auth.admin.listUsers()
  if (usersErr) return { ok: false, reason: 'server_error' as const }

  const user = users.users.find((u: any) => u.email === rec.email)
  if (!user) return { ok: false, reason: 'user_not_found' as const }

  const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  })
  if (updateErr) return { ok: false, reason: 'server_error' as const }

  await supabase.from('confirmation_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)
  await supabase.from('profiles').update({ email_confirmed: true, email: rec.email }).eq('id', user.id)

  return { ok: true, user_id: user.id, email: rec.email }
}

// ─── HTML templates ───────────────────────────────────────────────────────────
const BASE_STYLE = `
<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>PAKT</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;
       min-height:100vh;display:flex;flex-direction:column;align-items:center;
       justify-content:center;padding:24px;color:#fff}
  .logo{font-size:32px;font-weight:900;letter-spacing:8px;color:#d4a853;margin-bottom:40px}
  .card{background:#161616;border:1px solid rgba(255,255,255,0.07);border-radius:20px;
        padding:40px 32px;max-width:400px;width:100%;text-align:center}
  .badge{width:72px;height:72px;border-radius:50%;margin:0 auto 24px;
         display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900}
  .ok   {background:#d4a853;color:#000}
  .warn {background:#2a2a2a;border:2px solid #d4a853;color:#d4a853}
  .bad  {background:#2a0a0a;border:2px solid #ff4444;color:#ff4444}
  h1{font-size:20px;font-weight:800;margin-bottom:10px}
  p{color:rgba(255,255,255,0.5);font-size:14px;line-height:1.7}
  .notice{background:rgba(212,168,83,0.08);border:1px solid rgba(212,168,83,0.2);
          border-radius:12px;padding:16px 18px;margin-top:24px}
  .notice p{color:#d4a853;font-weight:600;font-size:13px}
  .btn{display:inline-block;background:#d4a853;color:#000;font-weight:700;font-size:15px;
       text-decoration:none;padding:13px 32px;border-radius:12px;margin-top:20px;
       letter-spacing:0.3px}
  footer{color:rgba(255,255,255,0.18);font-size:11px;margin-top:28px}
</style></head><body>
<div class="logo">PAKT</div>
`

function pageOk() {
  return BASE_STYLE + `
<div class="card">
  <div class="badge ok">&#10003;</div>
  <h1>Email confirm&eacute; !</h1>
  <p>Ton adresse email a bien &eacute;t&eacute; confirm&eacute;e.<br>Ton compte PAKT est maintenant actif.</p>
  <div class="notice">
    <p>Retourne sur l&apos;application mobile PAKT et connecte-toi avec ton mot de passe.</p>
  </div>
  <a class="btn" href="pakt://auth">Ouvrir PAKT</a>
</div>
<footer>PAKT &copy; 2026</footer>
</body></html>`
}

function pageAlreadyUsed() {
  return BASE_STYLE + `
<div class="card">
  <div class="badge warn">&#10003;</div>
  <h1>D&eacute;j&agrave; confirm&eacute;</h1>
  <p>Ton adresse email a d&eacute;j&agrave; &eacute;t&eacute; confirm&eacute;e.</p>
  <div class="notice">
    <p>Ouvre l&apos;app PAKT sur ton t&eacute;l&eacute;phone et connecte-toi.</p>
  </div>
  <a class="btn" href="pakt://auth">Ouvrir PAKT</a>
</div>
<footer>PAKT &copy; 2026</footer>
</body></html>`
}

function pageExpired() {
  return BASE_STYLE + `
<div class="card">
  <div class="badge bad">!</div>
  <h1>Lien expir&eacute;</h1>
  <p>Ce lien de confirmation a expir&eacute; (validit&eacute; 24h).</p>
  <div class="notice">
    <p>Retourne sur l&apos;app PAKT et cr&eacute;e un nouveau compte pour recevoir un nouvel email.</p>
  </div>
</div>
<footer>PAKT &copy; 2026</footer>
</body></html>`
}

function pageError() {
  return BASE_STYLE + `
<div class="card">
  <div class="badge bad">!</div>
  <h1>Lien invalide</h1>
  <p>Ce lien est invalide ou a d&eacute;j&agrave; &eacute;t&eacute; utilis&eacute;.</p>
  <div class="notice">
    <p>Si tu penses qu&apos;il s&apos;agit d&apos;une erreur, contacte-nous : paktsupport@gmail.com</p>
  </div>
</div>
<footer>PAKT &copy; 2026</footer>
</body></html>`
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  const url = new URL(req.url)

  // GET — browser clicked the email link → verify then REDIRECT to Vercel page
  if (req.method === 'GET') {
    const token = url.searchParams.get('token')
    const base = 'https://pakt-sigma.vercel.app/email-confirme'

    if (!token) {
      return Response.redirect(`${base}?status=error`, 302)
    }

    const result = await verifyToken(token)

    if (!result.ok) {
      const statusMap: Record<string, string> = {
        already_used:   'already',
        expired:        'expired',
        invalid:        'error',
        server_error:   'error',
        user_not_found: 'error',
      }
      return Response.redirect(`${base}?status=${statusMap[result.reason] ?? 'error'}`, 302)
    }

    return Response.redirect(`${base}?status=ok`, 302)
  }

  // POST — called from the mobile app
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405)

  try {
    const { token } = await req.json().catch(() => ({}))
    if (!token) return jsonRes({ success: false, error: 'Token requis' })

    const result = await verifyToken(token)
    if (!result.ok) {
      const msgs: Record<string, string> = {
        invalid:        'Lien invalide.',
        already_used:   'Email deja confirme.',
        expired:        'Lien expire.',
        server_error:   'Erreur serveur.',
        user_not_found: 'Utilisateur introuvable.',
      }
      return jsonRes({ success: false, error: msgs[result.reason] || 'Erreur.' })
    }

    return jsonRes({ success: true, user_id: result.user_id, email: result.email })

  } catch (err) {
    console.error('[VERIFY] Error:', err)
    return jsonRes({ success: false, error: 'Erreur serveur.' })
  }
})
