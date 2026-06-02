// supabase/functions/request-email-confirmation/index.ts
// Handle signup: create user + generate confirmation token + send email via Brevo

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const { email, password } = await req.json()

    if (!email || !password) return json({ error: 'Email and password required' }, 400)

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !BREVO_API_KEY) {
      console.error('[CONFIRM] Missing env vars:', { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_SERVICE_KEY: !!SUPABASE_SERVICE_KEY, BREVO_API_KEY: !!BREVO_API_KEY })
      return json({ error: 'Server not configured' }, 500)
    }

    // ── 1. Create user in Supabase Auth (email_verified = false) ───────
    console.log(`[CONFIRM] Creating user for ${email}`)

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })

    // Use admin API to create user WITHOUT triggering auto-email
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Don't mark as confirmed yet
    })

    if (authError) {
      console.error('[CONFIRM] Auth signup error:', authError.message)
      return json({ error: authError.message || 'Signup failed' }, 400)
    }

    if (!authData.user) return json({ error: 'User creation failed' }, 500)

    console.log(`[CONFIRM] User created: ${authData.user.id}`)

    // ── 2. Generate confirmation token ────────────────────────────────
    const token = crypto.getRandomValues(new Uint8Array(32))
    const tokenHex = Array.from(token)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h

    console.log(`[CONFIRM] Generated token for ${email}`)

    // ── 3. Store token in database ────────────────────────────────────
    const { error: insertError } = await serviceClient
      .from('confirmation_tokens')
      .insert({
        email,
        token: tokenHex,
        expires_at: expiresAt,
      })

    if (insertError) {
      console.error('[CONFIRM] Token storage failed:', insertError)
      // Don't fail, continue to send email anyway
    }

    // ── 4. Build confirmation link ────────────────────────────────────
    // HTTPS link → web page handles both PC (show message) and mobile (redirect to app)
    const confirmationLink = `https://pakt-sigma.vercel.app/confirm/${tokenHex}`

    console.log(`[CONFIRM] Confirmation link: ${confirmationLink}`)

    // ── 5. Build email HTML ──────────────────────────────────────────
    const emailHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PAKT - Confirme ton email</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" style="max-width:520px;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-size:32px;font-weight:900;letter-spacing:6px;color:#d4a853;">PAKT</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px 28px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">Bienvenue dans PAKT!</h1>
              <p style="margin:0 0 14px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;">Tu es à un clic de rejoindre la communauté francophone avec le plus d'opportunités.</p>
              <p style="margin:0 0 28px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;">Clique le bouton ci-dessous pour confirmer ton adresse email et activer ton compte.</p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${confirmationLink}" target="_blank" style="display:inline-block;background-color:#d4a853;color:#0a0a0a;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
                      Confirmer mon adresse email
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Token as backup (in case deep link doesn't work) -->
              <p style="margin:0 0 12px;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.6;">
                Ou copie ce code dans l'app PAKT:
              </p>
              <div style="background-color:#0a0a0a;border:1px dashed rgba(212,168,83,0.3);border-radius:8px;padding:12px;margin-bottom:28px;text-align:center;">
                <code style="font-size:12px;color:#d4a853;letter-spacing:1px;font-family:monospace;word-break:break-all;">${tokenHex}</code>
              </div>

              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.7;">Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);line-height:1.6;">
                Tu recois cet email car tu as créé un compte PAKT.<br/>
                <a href="https://paktapp.fr" style="color:rgba(212,168,83,0.5);text-decoration:none;">paktapp.fr</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    // ── 6. Send via Brevo ────────────────────────────────────────────
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
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

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[CONFIRM] Brevo error:', res.status, body)
      // User created successfully, email failed — still return success so user can proceed
      return json({ success: true, user_id: authData.user.id, email, warning: 'email_send_failed' })
    }

    console.log(`[CONFIRM] Email sent to ${email}`)
    return json({ success: true, user_id: authData.user.id, email })

  } catch (error) {
    console.error('[CONFIRM] Function error:', error)
    return json({ error: 'Function error', details: String(error) }, 500)
  }
})
