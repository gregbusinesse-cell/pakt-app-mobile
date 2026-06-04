// notify-inactive-users: Called via cron to re-engage inactive users
// Deploy then set up cron in Supabase: every day at 10:00

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const MESSAGES = [
  { title: '🔥 Quelqu\'un attend de vous matcher !', body: 'De nouveaux profils vous correspondent sur PAKT. Ne les laissez pas attendre.' },
  { title: '💼 Votre prochain partenaire business est là', body: 'Continuez à swiper sur PAKT — votre connexion idéale est peut-être à un swipe.' },
  { title: '✨ PAKT vous a manqué !', body: 'Des profils intéressants vous attendent. Revenez voir qui a liké le vôtre.' },
  { title: '🚀 Avancez vers vos objectifs business', body: 'Le networking ne s\'arrête jamais. Retrouvez votre fil PAKT maintenant.' },
]

Deno.serve(async (req: Request) => {
  // Allow cron trigger (no auth needed from Supabase scheduler)
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

  // Find users inactive for 24h+ with a push token
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: users } = await sb
    .from('profiles')
    .select('id, first_name, push_token, last_active_at')
    .not('push_token', 'is', null)
    .lt('last_active_at', since)
    .eq('is_suspended', false)
    .limit(100)

  if (!users?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } })
  }

  let sent = 0
  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]

  const notifications = users.map((u: any) => ({
    to: u.push_token,
    title: msg.title,
    body: msg.body,
    data: { type: 'engagement' },
    sound: 'default',
    priority: 'normal',
  }))

  // Send in batches of 100 (Expo limit)
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notifications),
  })
  const result = await res.json()
  sent = notifications.length

  console.log(`[CRON] Sent ${sent} re-engagement notifications`)
  return new Response(JSON.stringify({ sent, result }), { headers: { 'Content-Type': 'application/json' } })
})
