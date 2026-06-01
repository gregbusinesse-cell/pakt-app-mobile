// supabase/functions/verify-email-confirmation/index.ts
// Verify confirmation token and mark email as verified

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { token } = await req.json()

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('[VERIFY] Missing Supabase credentials')
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })

    // ── 1. Look up token ──────────────────────────────────────────────
    console.log('[VERIFY] Looking up token...')

    const { data: tokenRecord, error: lookupError } = await serviceClient
      .from('confirmation_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (lookupError || !tokenRecord) {
      console.error('[VERIFY] Token not found:', lookupError)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── 2. Check if already used ──────────────────────────────────────
    if (tokenRecord.used_at) {
      console.warn('[VERIFY] Token already used')
      return new Response(
        JSON.stringify({ error: 'Token already used' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── 3. Check if expired ───────────────────────────────────────────
    const now = new Date()
    const expiresAt = new Date(tokenRecord.expires_at)

    if (now > expiresAt) {
      console.warn('[VERIFY] Token expired')
      return new Response(
        JSON.stringify({ error: 'Token expired' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── 4. Find user by email and update email_confirmed_at ───────────
    console.log(`[VERIFY] Confirming email: ${tokenRecord.email}`)

    const { data: users, error: usersError } = await serviceClient.auth.admin.listUsers()

    if (usersError) {
      console.error('[VERIFY] Failed to list users:', usersError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify email' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const user = users.users.find(u => u.email === tokenRecord.email)

    if (!user) {
      console.error('[VERIFY] User not found for email:', tokenRecord.email)
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── 5. Update user's email_confirmed_at ───────────────────────────
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(
      user.id,
      {
        email_confirm: true, // Mark email as verified
      }
    )

    if (updateError) {
      console.error('[VERIFY] Failed to confirm email:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to confirm email' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── 6. Mark token as used ────────────────────────────────────────
    const { error: markError } = await serviceClient
      .from('confirmation_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)

    if (markError) {
      console.warn('[VERIFY] Failed to mark token as used:', markError)
      // Don't fail if this fails
    }

    console.log(`[VERIFY] Email confirmed for ${tokenRecord.email}`)

    return new Response(
      JSON.stringify({
        success: true,
        user_id: user.id,
        email: tokenRecord.email,
        message: 'Email confirmed successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[VERIFY] Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Function error', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
