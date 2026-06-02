// supabase/functions/verify-email-confirmation/index.ts
// Handles both:
//   GET  /verify-email-confirmation?token=xxx  → HTML page (from email link click)
//   POST /verify-email-confirmation             → JSON response (from mobile app)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function jsonRes(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

// ─── Shared verification logic ────────────────────────────────────────────────
async function verifyToken(token: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })

  const { data: rec, error: lookupErr } = await supabase
    .from('confirmation_tokens')
    .select('*')
    .eq('token', token)
    .single()

  if (lookupErr || !rec) return { ok: false, reason: 'invalid' }
  if (rec.used_at)       return { ok: false, reason: 'already_used' }
  if (new Date() > new Date(rec.expires_at)) return { ok: false, reason: 'expired' }

  // Find user in auth.users
  const { data: users, error: usersErr } = await supabase.auth.admin.listUsers()
  if (usersErr) return { ok: false, reason: 'server_error' }

  const user = users.users.find((u: any) => u.email === rec.email)
  if (!user) return { ok: false, reason: 'user_not_found' }

  // Mark email as confirmed in auth
  const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  })
  if (updateErr) return { ok: false, reason: 'server_error' }

  // Mark token used + update profile
  await supabase
    .from('confirmation_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)

  await supabase
    .from('profiles')
    .update({ email_confirmed: true, email: rec.email })
    .eq('id', user.id)

  return { ok: true, user_id: user.id, email: rec.email }
}

// ─── HTML page templates ──────────────────────────────────────────────────────
const PAGE = (icon: string, title: string, message: string, extra = '') => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>PAKT – ${title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         min-height:100vh;display:flex;flex-direction:column;align-items:center;
         justify-content:center;padding:24px}
    .logo{font-size:36px;font-weight:900;letter-spacing:8px;color:#d4a853;margin-bottom:48px}
    .card{background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:20px;
          padding:40px 36px;max-width:420px;width:100%;text-align:center}
    .icon{font-size:56px;margin-bottom:20px}
    h1{color:#fff;font-size:22px;font-weight:800;margin-bottom:12px}
    p{color:rgba(255,255,255,0.55);font-size:14px;line-height:1.7;margin-bottom:16px}
    .box{background:rgba(212,168,83,0.08);border:1px solid rgba(212,168,83,0.25);
         border-radius:12px;padding:16px 20px;margin-top:20px}
    .box p{color:#d4a853;font-weight:600;font-size:14px;margin:0}
    .btn{display:inline-block;background:#d4a853;color:#000;font-weight:700;
         font-size:15px;text-decoration:none;padding:14px 32px;border-radius:12px;margin-top:20px}
    footer{color:rgba(255,255,255,0.2);font-size:11px;margin-top:32px}
  </style>
</head>
<body>
  <div class="logo">PAKT</div>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    ${extra}
  </div>
  <footer>PAKT © 2026</footer>
</body>
</html>`

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  const url = new URL(req.url)

  // ── GET request: user clicked the link in their email ──────────────────────
  if (req.method === 'GET') {
    const token = url.searchParams.get('token')

    if (!token) {
      return html(PAGE('❌', 'Lien invalide', 'Ce lien de confirmation est invalide.'))
    }

    const result = await verifyToken(token)

    if (!result.ok) {
      if (result.reason === 'already_used') {
        return html(PAGE(
          '✅', 'Déjà confirmé',
          'Ton adresse email a déjà été confirmée.',
          `<div class="box"><p>Ouvre l'application PAKT sur ton téléphone pour te connecter.</p></div>`
        ))
      }
      if (result.reason === 'expired') {
        return html(PAGE(
          '⏰', 'Lien expiré',
          'Ce lien a expiré (validité 24h). Crée un nouveau compte depuis l\'application.',
          `<div class="box"><p>Retourne sur l'app PAKT et recommence l'inscription.</p></div>`
        ))
      }
      return html(PAGE('❌', 'Lien invalide', 'Ce lien de confirmation est invalide ou a expiré.'))
    }

    // Success — show page with deep link button for mobile
    return html(PAGE(
      '✓', 'Email confirmé !',
      'Ton adresse email a bien été confirmée. Ton compte PAKT est maintenant actif.',
      `<div class="box">
        <p>Retourne sur l'application mobile PAKT pour te connecter avec ton mot de passe.</p>
      </div>
      <a class="btn" href="pakt://auth">Ouvrir PAKT</a>`
    ))
  }

  // ── POST request: called programmatically from the mobile app ──────────────
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405)

  try {
    const { token } = await req.json()
    if (!token) return jsonRes({ success: false, error: 'Token required' })

    const result = await verifyToken(token)

    if (!result.ok) {
      const msgs: Record<string, string> = {
        invalid:      'Lien invalide ou expiré.',
        already_used: 'Email déjà confirmé.',
        expired:      'Lien expiré.',
        server_error: 'Erreur serveur.',
        user_not_found: 'Utilisateur introuvable.',
      }
      return jsonRes({ success: false, error: msgs[result.reason!] || 'Erreur.' })
    }

    return jsonRes({ success: true, user_id: result.user_id, email: result.email })

  } catch (err) {
    console.error('[VERIFY] Error:', err)
    return jsonRes({ success: false, error: 'Erreur serveur.' })
  }
})
