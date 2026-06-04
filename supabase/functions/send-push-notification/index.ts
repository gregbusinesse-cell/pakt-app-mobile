// send-push-notification: Sends push notification via Expo Push API
// Called from other functions when a match/message/like occurs

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { to_user_id, title, body, data } = await req.json()
    if (!to_user_id || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: CORS })
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

    // Get recipient's push token
    const { data: profile } = await sb.from('profiles').select('push_token').eq('id', to_user_id).single()
    const token = (profile as any)?.push_token

    if (!token) {
      return new Response(JSON.stringify({ success: false, reason: 'no_token' }), { headers: CORS })
    }

    // Send via Expo Push API
    const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data: data || {},
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      }),
    })

    const result = await pushRes.json()
    console.log('[PUSH] Sent to', to_user_id, ':', result)
    return new Response(JSON.stringify({ success: true, result }), { headers: { 'Content-Type': 'application/json', ...CORS } })

  } catch (e) {
    console.error('[PUSH] Error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS })
  }
})
