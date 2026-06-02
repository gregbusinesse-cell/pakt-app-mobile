// supabase/functions/delete-account/index.ts
// Deletes a user's account: all data + auth user

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Verify JWT
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return new Response(JSON.stringify({ success: false, error: 'Missing token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    const userId = user.id
    console.log('[DELETE] Deleting account:', userId)

    // Delete all user data in order (respect foreign keys)
    const tables = ['messages', 'conversations', 'matches', 'likes', 'swipes', 'profile_views', 'confirmation_tokens', 'profiles']
    for (const table of tables) {
      try {
        // Each table may have different column names for user reference
        if (table === 'messages') {
          await supabase.from(table).delete().eq('sender_id', userId)
        } else if (table === 'conversations') {
          await supabase.from(table).delete().or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        } else if (table === 'matches') {
          await supabase.from(table).delete().or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        } else if (table === 'likes') {
          await supabase.from(table).delete().or(`liker_id.eq.${userId},liked_id.eq.${userId}`)
        } else if (table === 'swipes') {
          await supabase.from(table).delete().or(`swiper_id.eq.${userId},target_id.eq.${userId}`)
        } else if (table === 'profile_views') {
          await supabase.from(table).delete().or(`viewer_id.eq.${userId},viewed_id.eq.${userId}`)
        } else if (table === 'confirmation_tokens') {
          await supabase.from(table).delete().eq('email', user.email || '')
        } else if (table === 'profiles') {
          await supabase.from(table).delete().eq('id', userId)
        }
        console.log(`[DELETE] Cleaned ${table}`)
      } catch (e) {
        console.warn(`[DELETE] Could not clean ${table}:`, e)
      }
    }

    // Delete auth user (must be last)
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId)
    if (deleteAuthError) {
      console.error('[DELETE] Auth delete error:', deleteAuthError.message)
      return new Response(JSON.stringify({ success: false, error: deleteAuthError.message }), { headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    console.log('[DELETE] Account deleted:', userId)
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...CORS } })

  } catch (err) {
    console.error('[DELETE] Error:', err)
    return new Response(JSON.stringify({ success: false, error: String(err) }), { headers: { 'Content-Type': 'application/json', ...CORS } })
  }
})
