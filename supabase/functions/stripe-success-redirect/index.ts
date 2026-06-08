// supabase/functions/stripe-success-redirect/index.ts
// Redirects from Stripe Checkout success to mobile app deep link

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req: Request) => {
  try {
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('session_id')
    const plan = url.searchParams.get('plan') || 'business'

    if (!sessionId) {
      return new Response('Missing session_id', { status: 400 })
    }

    // Redirect to mobile app deep link
    const deepLink = `pakt://payment/success?plan=${encodeURIComponent(plan)}&session_id=${encodeURIComponent(sessionId)}`

    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Redirection...</title>
  <script>
    // Try to open the deep link
    window.location.href = '${deepLink}';

    // Fallback: If deep link doesn't work after 2 seconds, show message
    setTimeout(() => {
      if (!document.hidden) {
        document.body.innerHTML = '<p>Redirection vers PAKT...</p><p>Si ça ne marche pas, vérifie que PAKT est installé.</p>';
      }
    }, 2000);
  </script>
</head>
<body>
  <p>Redirection vers PAKT...</p>
</body>
</html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (err) {
    console.error('[REDIRECT-SUCCESS] Error:', err)
    return new Response('Error processing redirect', { status: 500 })
  }
})
