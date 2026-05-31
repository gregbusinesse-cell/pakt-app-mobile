// supabase/functions/send-confirmation-email/index.ts
// Generate confirmation link and send email via Brevo

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
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
    const { email } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('[CONFIRM] Missing Supabase credentials')
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create admin client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        persistSession: false,
      },
    })

    console.log(`[CONFIRM] Generating link for ${email}`)

    // ── 1. Generate confirmation link ────────────────────────────
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email,
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[CONFIRM] Link generation failed:', linkError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate confirmation link', details: linkError?.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const confirmationLink = linkData.properties.action_link
    console.log(`[CONFIRM] Link generated for ${email}`)

    // ── 2. Send email via Brevo ──────────────────────────────────
    if (!BREVO_API_KEY) {
      console.error('[CONFIRM] BREVO_API_KEY missing')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const emailHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PAKT</title>
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
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">Bienvenue !</h1>
              <p style="margin:0 0 14px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;">Tu es à un clic de rejoindre la communauté francophone avec le plus d'opportunités.</p>
              <p style="margin:0 0 14px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;">Clique le bouton ci-dessous pour confirmer ton adresse email et activer ton compte.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td align="center">
                    <a href="${confirmationLink}" target="_blank" style="display:inline-block;background-color:#d4a853;color:#0a0a0a;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
                      Confirmer mon compte
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:32px 0 0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.7;">Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>
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

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'PAKT', email: 'paktsupport@gmail.com' },
        to: [{ email: email }],
        subject: 'Confirme ton adresse email pour PAKT',
        htmlContent: emailHtml,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[CONFIRM] Brevo API error:', res.status, body)
      return new Response(
        JSON.stringify({ sent: false, reason: 'brevo_error', status: res.status }),
        { status: res.status, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[CONFIRM] Email sent to ${email}`)
    return new Response(
      JSON.stringify({ sent: true, email, message: 'Confirmation email sent' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[CONFIRM] Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Function error', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
