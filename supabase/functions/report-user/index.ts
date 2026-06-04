// report-user: Sends a report email to support via Brevo

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { reported_id, reported_name, reporter_id, reporter_name, reason, conversation_id } = await req.json()

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'content-type': 'application/json', 'api-key': BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'PAKT Reports', email: 'paktsupport@gmail.com' },
        to: [{ email: 'paktsupport@gmail.com' }],
        subject: `[SIGNALEMENT PAKT] ${reason} — ${reported_name}`,
        htmlContent: `
          <h2 style="color:#d4a853">Nouveau signalement PAKT</h2>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:8px;border:1px solid #ddd"><b>Raison</b></td><td style="padding:8px;border:1px solid #ddd">${reason}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><b>Signalé par</b></td><td style="padding:8px;border:1px solid #ddd">${reporter_name} (${reporter_id})</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><b>Profil signalé</b></td><td style="padding:8px;border:1px solid #ddd">${reported_name} (${reported_id})</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><b>Conversation</b></td><td style="padding:8px;border:1px solid #ddd">${conversation_id}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><b>Date</b></td><td style="padding:8px;border:1px solid #ddd">${new Date().toLocaleString('fr-FR')}</td></tr>
          </table>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[REPORT] Brevo error:', err)
      return new Response(JSON.stringify({ success: false }), { headers: CORS })
    }

    console.log(`[REPORT] Report sent: ${reporter_name} → ${reported_name} (${reason})`)
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...CORS } })

  } catch (e) {
    console.error('[REPORT] Error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS })
  }
})
