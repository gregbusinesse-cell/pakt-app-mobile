// notify-inactive-users: Daily cron job for re-engagement notifications
// Handles: inactive users + photo reminders (every 48h if < 6 photos)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ENGAGEMENT_MESSAGES = [
  { title: '🔥 Quelqu\'un attend de vous matcher !', body: 'De nouveaux profils vous correspondent. Ne les laissez pas attendre.' },
  { title: '💼 Votre prochain partenaire business est là', body: 'Continuez à swiper — votre connexion idéale est peut-être à un swipe.' },
  { title: '✨ PAKT vous a manqué !', body: 'Des profils intéressants vous attendent. Revenez voir qui a liké le vôtre.' },
  { title: '🚀 Avancez vers vos objectifs', body: 'Le networking ne s\'arrête jamais. Retrouvez votre fil PAKT maintenant.' },
]

async function sendPush(token: string, title: string, body: string, data: object = {}) {
  return fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data, sound: 'default', priority: 'normal' }),
  })
}

Deno.serve(async (_req: Request) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
  const now = new Date()
  let sent = 0

  // ── 1. Photo reminder (every 48h) ────────────────────────────────────────
  // Users with < 6 photos who haven't been reminded in 48h
  const fortyEightHAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
  const { data: photoUsers } = await sb
    .from('profiles')
    .select('id, push_token, photos, last_photo_reminder_at')
    .not('push_token', 'is', null)
    .or(`last_photo_reminder_at.is.null,last_photo_reminder_at.lt.${fortyEightHAgo}`)
    .or('is_suspended.is.null,is_suspended.eq.false')
    .limit(200)

  for (const user of (photoUsers || [])) {
    const photoCount = Array.isArray(user.photos) ? user.photos.length : 0
    if (photoCount >= 6) continue // Already has max photos

    const remaining = 6 - photoCount
    const token = user.push_token
    if (!token) continue

    await sendPush(
      token,
      '📸 +3x de matchs avec une photo',
      `Il te manque ${remaining} photo${remaining > 1 ? 's' : ''} pour maximiser tes chances de match. Ajoute-en une maintenant !`,
      { type: 'profile_tip' }
    )

    // Update last reminder timestamp
    await sb.from('profiles').update({ last_photo_reminder_at: now.toISOString() } as any).eq('id', user.id)
    sent++
  }

  // ── 2. Re-engagement (inactive 24h+) ────────────────────────────────────
  const twentyFourHAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const { data: inactiveUsers } = await sb
    .from('profiles')
    .select('id, push_token, last_active_at')
    .not('push_token', 'is', null)
    .lt('last_active_at', twentyFourHAgo)
    .or('is_suspended.is.null,is_suspended.eq.false')
    .limit(100)

  const msg = ENGAGEMENT_MESSAGES[Math.floor(Math.random() * ENGAGEMENT_MESSAGES.length)]
  const tokens = (inactiveUsers || [])
    .filter((u: any) => u.push_token)
    .map((u: any) => u.push_token)

  if (tokens.length > 0) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens.map(t => ({ to: t, title: msg.title, body: msg.body, data: { type: 'engagement' }, sound: 'default', priority: 'normal' }))),
    })
    sent += tokens.length
  }

  console.log(`[CRON] Sent ${sent} notifications`)
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
