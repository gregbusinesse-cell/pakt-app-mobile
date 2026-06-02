// supabase/functions/request-email-confirmation/index.ts
// Handle signup: create user + generate confirmation token + send email via Brevo
// RESTORED to last working version (4e213cd) + Brevo failure fix

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !BREVO_API_KEY) {
      console.error('[CONFIRM] Missing env vars')
      return new Response(JSON.stringify({ success: false, error: 'Server not configured' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })

    // ── 1. Create user (no auto-confirmation email) ──────────────────
    console.log(`[CONFIRM] Creating user for ${email}`)
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    })

    if (authError) {
      console.error('[CONFIRM] Auth signup error:', authError.message)
      // Always return 200 so supabase.functions.invoke doesn't throw
      return new Response(
        JSON.stringify({ success: false, error: authError.message }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'User creation failed' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[CONFIRM] User created: ${authData.user.id}`)

    // ── 2. Generate confirmation token ───────────────────────────────
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32))
    const tokenHex = Array.from(tokenBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    // ── 3. Store token ───────────────────────────────────────────────
    const { error: insertError } = await serviceClient
      .from('confirmation_tokens')
      .insert({ email, token: tokenHex, expires_at: expiresAt })

    if (insertError) console.error('[CONFIRM] Token storage failed:', insertError)

    // ── 4. Confirmation link ─────────────────────────────────────────
    // Deep link → opens the PAKT app directly on mobile
    // On PC, the email body explains to open from the phone
    const confirmationLink = `pakt://confirm/${tokenHex}`

    // ── 5. Send email via Brevo ──────────────────────────────────────
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
          <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;">
            Appuie sur le bouton ci-dessous depuis ton <strong style="color:#fff;">t&eacute;l&eacute;phone</strong> pour confirmer ton adresse et acc&eacute;der &agrave; PAKT.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr><td align="center">
              <a href="${confirmationLink}"
                 style="display:inline-block;background:#d4a853;color:#0a0a0a;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
                Confirmer mon adresse email
              </a>
            </td></tr>
          </table>
          <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px 16px;margin-bottom:20px;text-align:left;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.7;">
              &#128241; <strong style="color:rgba(255,255,255,0.7);">Important :</strong> Ce bouton doit &ecirc;tre ouvert depuis ton t&eacute;l&eacute;phone avec l&apos;application PAKT install&eacute;e.<br>
              Si tu lis cet email sur ordinateur, ouvre-le depuis ton t&eacute;l&eacute;phone.
            </p>
          </div>
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2);">Si tu n&apos;es pas &agrave; l&apos;origine de cette demande, ignore cet email. Le lien expire dans 24h.</p>
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
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'PAKT', email: 'paktsupport@gmail.com' },
        to: [{ email }],
        subject: 'Confirme ton adresse email pour PAKT',
        htmlContent: emailHtml,
      }),
    })

    if (!brevoRes.ok) {
      const body = await brevoRes.text().catch(() => '')
      console.error('[CONFIRM] Brevo API error:', brevoRes.status, body)
      // FIX: user was created successfully even if email failed — return 200 success
      // so the user can proceed (they just won't get the email)
      return new Response(
        JSON.stringify({
          success: true,
          user_id: authData.user.id,
          email,
          warning: 'email_not_sent',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[CONFIRM] Email sent to ${email}`)
    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        email,
        message: 'Confirmation email sent.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[CONFIRM] Function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Erreur serveur. Réessaie.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
