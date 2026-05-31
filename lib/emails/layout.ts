// lib/emails/templates/layout.ts
// Shared dark/gold email wrapper

// Production domain — used in all real emails
const APP_URL = 'https://paktapp.fr'

export { APP_URL }

export function emailLayout(body: string, unsubscribeUrl?: string): string {
  const unsubscribeHtml = unsubscribeUrl
    ? `<br/><a href="${unsubscribeUrl}" style="color:rgba(255,255,255,0.2);text-decoration:underline;font-size:10px;">Se desinscrire des emails</a>`
    : ''

  return `<!DOCTYPE html>
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
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);line-height:1.6;">
                Tu recois cet email car tu as un compte PAKT.<br/>
                <a href="${APP_URL}" style="color:rgba(212,168,83,0.5);text-decoration:none;">paktapp.fr</a>
                ${unsubscribeHtml}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function ctaButton(text: string, href: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
  <tr>
    <td align="center">
      <a href="${href}" target="_blank" style="display:inline-block;background-color:#d4a853;color:#0a0a0a;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
        ${text}
      </a>
    </td>
  </tr>
</table>`
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">${text}</h1>`
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;">${text}</p>`
}
