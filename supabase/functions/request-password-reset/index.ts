// supabase/functions/request-password-reset/index.ts
// Generates a password reset token and sends email via Brevo

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BREVO_API_KEY        = Deno.env.get('BREVO_API_KEY')!

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { email } = await req.json().catch(() => ({}))
    if (!email) return new Response(JSON.stringify({ success: false, error: 'Email requis' }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

    // Check user exists
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const user = users?.find((u: any) => u.email === email)
    if (!user) {
      // Don't reveal if user exists — return success anyway
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    // Generate token
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32))
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1h

    // Store token
    await supabase.from('password_reset_tokens').insert({ user_id: user.id, email, token, expires_at: expiresAt })
      .catch(async () => {
        // Table might not exist, create it
        await supabase.rpc('exec_sql', { sql: `
          CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id uuid NOT NULL,
            email text NOT NULL,
            token text UNIQUE NOT NULL,
            expires_at timestamptz NOT NULL,
            used_at timestamptz,
            created_at timestamptz DEFAULT now()
          );
          ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
        `}).catch(() => {})
        await supabase.from('password_reset_tokens').insert({ user_id: user.id, email, token, expires_at: expiresAt })
      })

    // Reset link → app deep link
    const resetLink = `pakt://reset-password?token=${token}`

    // Send email via Brevo
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'content-type': 'application/json', 'api-key': BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'PAKT', email: 'paktsupport@gmail.com' },
        to: [{ email }],
        subject: 'Réinitialise ton mot de passe PAKT',
        htmlContent: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:520px;">
        <tr><td align="center" style="padding-bottom:32px;">
          <span style="font-size:32px;font-weight:900;letter-spacing:6px;color:#d4a853;">PAKT</span>
        </td></tr>
        <tr><td style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px 28px;">
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#fff;">Réinitialise ton mot de passe</h1>
          <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;">
            Appuie sur le bouton ci-dessous depuis ton téléphone pour choisir un nouveau mot de passe.<br>
            <strong style="color:#fff;">Le lien expire dans 1 heure.</strong>
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr><td align="center">
              <a href="${resetLink}" style="display:inline-block;background:#d4a853;color:#0a0a0a;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
                Réinitialiser mon mot de passe
              </a>
            </td></tr>
          </table>
          <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px 16px;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);">
              📱 Ce lien doit être ouvert depuis ton téléphone avec l'app PAKT.<br>
              Si tu n'es pas à l'origine de cette demande, ignore cet email.
            </p>
          </div>
        </td></tr>
        <tr><td align="center" style="padding-top:20px;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">PAKT © 2026</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
      }),
    })

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } })
  } catch (err) {
    console.error('[RESET] Error:', err)
    return new Response(JSON.stringify({ success: false, error: 'Erreur serveur' }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } })
  }
})
