// supabase/functions/stripe-cancel-redirect/index.ts
// Redirects from Stripe Checkout cancel to mobile app deep link

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req: Request) => {
  try {
    // Redirect to mobile app deep link
    const deepLink = 'pakt://payment/cancel'

    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Redirection...</title>
  <script>
    // Redirect to mobile app deep link
    window.location.href = '${deepLink}';

    // Fallback: If deep link doesn't work after 2 seconds, show message
    setTimeout(() => {
      if (!document.hidden) {
        document.body.innerHTML = '<p>Paiement annulé. Redirection vers PAKT...</p><p>Si ça ne marche pas, vérifie que PAKT est installé.</p>';
      }
    }, 2000);
  </script>
</head>
<body>
  <p>Paiement annulé. Redirection vers PAKT...</p>
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
    console.error('[REDIRECT-CANCEL] Error:', err)
    return new Response('Error processing redirect', { status: 500 })
  }
})
