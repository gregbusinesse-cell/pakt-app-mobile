// reset-password-request: Generate token + send reset email via Brevo

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BREVO_API_KEY        = Deno.env.get('BREVO_API_KEY')!

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ok  = (d: object) => new Response(JSON.stringify({ success: true,  ...d }), { status: 200, headers: { 'content-type': 'application/json', ...CORS } })
const err = (msg: string) => new Response(JSON.stringify({ success: false, error: msg }), { status: 200, headers: { 'content-type': 'application/json', ...CORS } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

    // Support both: authenticated call (from settings) and email-only call (from forgot password)
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    const body = await req.json().catch(() => ({}))
    const emailFromBody = body?.email

    let userEmail: string | null = null

    if (token && token !== 'Bearer' && !token.startsWith('eyJhbG') === false) {
      // Authenticated call — get user from JWT
      const { data: { user } } = await sb.auth.getUser(token)
      userEmail = user?.email || null
    }

    // If no user from JWT, use email from body (forgot password flow)
    if (!userEmail && emailFromBody) {
      userEmail = emailFromBody
    }

    if (!userEmail) return err('Email requis')

    // Generate reset token
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32))
    const resetToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1h

    // Find user by email if not authenticated
    let userId: string | null = null
    const { data: users } = await sb.auth.admin.listUsers()
    const foundUser = users?.users?.find((u: any) => u.email === userEmail)
    userId = foundUser?.id || null

    // Delete any existing tokens for this email
    await sb.from('password_reset_tokens').delete().eq('email', userEmail)

    // Insert fresh token
    const { error: insertErr } = await sb.from('password_reset_tokens').insert({
      user_id: userId || '00000000-0000-0000-0000-000000000000',
      email: userEmail,
      token: resetToken,
      expires_at: expiresAt,
    })

    if (insertErr) {
      console.error('[RESET] Token insert error:', insertErr.message)
      return err('Impossible de créer le token. Réessaie.')
    }

    // Deep link — opens app on mobile
    const resetLink = `pakt://reset-password?token=${resetToken}`

    const emailHtml = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:520px;">
        <tr><td align="center" style="padding-bottom:32px;">
          <span style="font-size:32px;font-weight:900;letter-spacing:6px;color:#d4a853;">PAKT</span>
        </td></tr>
        <tr><td style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px 28px;">
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#fff;">Réinitialisation du mot de passe</h1>
          <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;">
            Tu as demandé à changer ton mot de passe PAKT. Appuie sur le bouton ci-dessous <strong style="color:#fff;">depuis ton téléphone</strong> pour choisir un nouveau mot de passe.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr><td align="center">
              <a href="${resetLink}" style="display:inline-block;background:#d4a853;color:#0a0a0a;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
                Changer mon mot de passe
              </a>
            </td></tr>
          </table>
          <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px 16px;margin-bottom:16px;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.6;">
              📱 Ce lien doit être ouvert depuis ton téléphone avec l'app PAKT installée.<br>
              Ce lien expire dans <strong style="color:rgba(255,255,255,0.6);">1 heure</strong>.
            </p>
          </div>
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);">
            Si tu n'as pas demandé cette réinitialisation, ignore cet email.
          </p>
        </td></tr>
        <tr><td align="center" style="padding-top:20px;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">PAKT &copy; 2026</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'content-type': 'application/json', 'api-key': BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'PAKT', email: 'paktsupport@gmail.com' },
        to: [{ email: userEmail }],
        subject: 'Réinitialisation de ton mot de passe PAKT',
        htmlContent: emailHtml,
      }),
    })

    if (!brevoRes.ok) {
      const body = await brevoRes.text()
      console.error('[RESET] Brevo error:', brevoRes.status, body)
      return err('Impossible d\'envoyer l\'email. Réessaie plus tard.')
    }

    return ok({ message: 'Email envoyé' })

  } catch (e) {
    console.error('[RESET] Error:', e)
    return err('Erreur serveur')
  }
})
