// supabase/functions/request-email-confirmation/index.ts
// Create user + send confirmation email via Brevo

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BREVO_API_KEY        = Deno.env.get('BREVO_API_KEY')!

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Always return HTTP 200 so supabase.functions.invoke doesn't throw
// Use { success, error } pattern so the client can check the result
const ok  = (data: object) => new Response(JSON.stringify({ success: true,  ...data }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } })
const err = (msg: string)  => new Response(JSON.stringify({ success: false, error: msg }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } })

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')   return err('Method not allowed')

  try {
    const { email, password } = await req.json().catch(() => ({}))

    if (!email || !password) return err('Email et mot de passe requis')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })

    // ── 1. Create user (no auto-confirmation email) ──────────────────────
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    })

    if (authError) {
      const msg = authError.message || ''
      // Translate common Supabase errors to French
      if (msg.includes('already registered') || msg.includes('already exists')) {
        return err('Un compte existe déjà avec cet email. Connecte-toi.')
      }
      if (msg.includes('invalid') && msg.includes('email')) {
        return err('Adresse email invalide.')
      }
      if (msg.includes('password') && msg.includes('short')) {
        return err('Mot de passe trop court (6 caractères minimum).')
      }
      console.error('[SIGNUP] Auth error:', msg)
      return err(msg || 'Erreur lors de la création du compte')
    }

    if (!authData?.user) return err('Erreur serveur — réessaie.')

    const userId = authData.user.id
    console.log('[SIGNUP] User created:', userId)

    // ── 2. Generate token ─────────────────────────────────────────────────
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32))
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await supabase.from('confirmation_tokens').insert({ email, token, expires_at: expiresAt })

    // ── 3. Confirmation link ──────────────────────────────────────────────
    // PC: shows nice web page → user clicks "Ouvrir PAKT"
    // Mobile browser: web page auto-redirects to pakt://confirm/[token]
    const confirmLink = `https://pakt-sigma.vercel.app/confirm/${token}`

    // ── 4. Send email via Brevo ───────────────────────────────────────────
    const emailHtml = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:520px;">
        <tr><td align="center" style="padding-bottom:32px;">
          <span style="font-size:32px;font-weight:900;letter-spacing:6px;color:#d4a853;">PAKT</span>
        </td></tr>
        <tr><td style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px 28px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fff;">Bienvenue dans PAKT !</h1>
          <p style="margin:0 0 28px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;">
            Clique le bouton ci-dessous pour confirmer ton adresse email et accéder à l'application.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td align="center">
              <a href="${confirmLink}" target="_blank"
                 style="display:inline-block;background:#d4a853;color:#0a0a0a;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
                Confirmer mon adresse email
              </a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">
            Ce lien expire dans 24h. Si tu n'es pas à l'origine de cette demande, ignore cet email.
          </p>
        </td></tr>
        <tr><td align="center" style="padding-top:20px;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">PAKT © 2026</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept':       'application/json',
        'content-type': 'application/json',
        'api-key':      BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender:      { name: 'PAKT', email: 'paktsupport@gmail.com' },
        to:          [{ email }],
        subject:     'Confirme ton adresse email PAKT',
        htmlContent: emailHtml,
      }),
    })

    if (!brevoRes.ok) {
      const brevoBody = await brevoRes.text().catch(() => '')
      console.error('[SIGNUP] Brevo error:', brevoRes.status, brevoBody)
      // User was created — return success anyway (email failed silently)
      return ok({ user_id: userId, email, email_sent: false })
    }

    console.log('[SIGNUP] Email sent to', email)
    return ok({ user_id: userId, email, email_sent: true })

  } catch (e) {
    console.error('[SIGNUP] Unexpected error:', e)
    return err('Erreur serveur inattendue. Réessaie.')
  }
})
