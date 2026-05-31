// supabase/functions/send-email/index.ts
// Supabase Edge Function to send emails via Brevo
// Called from mobile/web apps

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

interface SendEmailRequest {
  userId?: string
  to: string
  subject: string
  htmlContent: string
  type: 'welcome' | 'confirm_signup' | 'like' | 'match' | 'message' | 'inactive_day_1' | 'inactive_day_2' | 'inactive_day_3' | 'incomplete_profile'
}

const MAX_EMAILS_PER_DAY = 2

serve(async (req: Request) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const body: SendEmailRequest = await req.json()
    const { userId, to, subject, htmlContent, type } = body

    // Validate required fields
    if (!to || !subject || !htmlContent || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, htmlContent, type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!BREVO_API_KEY) {
      console.error('[EMAIL] BREVO_API_KEY missing')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase service client
    const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '')

    // ── 1. Check unsubscribed (if userId provided) ────────────────
    if (userId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('emails_sent_today, last_email_sent_at, email_unsubscribed')
        .eq('id', userId)
        .single()

      if (profile?.email_unsubscribed) {
        console.log(`[EMAIL] user ${userId} is unsubscribed`)
        return new Response(
          JSON.stringify({ sent: false, reason: 'unsubscribed' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // ── 2. Check daily limit ─────────────────────────────────────
      let currentCount = profile?.emails_sent_today ?? 0
      if (profile?.last_email_sent_at) {
        const lastSent = new Date(profile.last_email_sent_at)
        const now = new Date()
        if (lastSent.toDateString() !== now.toDateString()) {
          currentCount = 0
        }
      }

      if (currentCount >= MAX_EMAILS_PER_DAY) {
        console.log(`[EMAIL] daily limit reached for ${userId} (${currentCount}/${MAX_EMAILS_PER_DAY})`)
        return new Response(
          JSON.stringify({ sent: false, reason: 'daily_limit' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // ── 3. Check duplicate (same type within 23h) ────────────────
      const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()

      const { data: recentEvents } = await supabase
        .from('email_events')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .gte('sent_at', twentyThreeHoursAgo)
        .limit(1)

      if (recentEvents && recentEvents.length > 0) {
        console.log(`[EMAIL] duplicate blocked: ${type} already sent to ${userId} within 23h`)
        return new Response(
          JSON.stringify({ sent: false, reason: 'duplicate' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // ── 4. Send via Brevo ────────────────────────────────────────
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'PAKT', email: 'paktsupport@gmail.com' },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[EMAIL] Brevo API error', res.status, body)
      return new Response(
        JSON.stringify({ sent: false, reason: 'brevo_error', details: body }),
        { status: res.status, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── 5. Log event (if userId provided) ─────────────────────────
    if (userId) {
      await supabase.from('email_events').insert({
        user_id: userId,
        type,
      })

      // ── 6. Update counter ────────────────────────────────────────
      const { data: profile } = await supabase
        .from('profiles')
        .select('emails_sent_today')
        .eq('id', userId)
        .single()

      let currentCount = profile?.emails_sent_today ?? 0
      const newCount = currentCount + 1

      await supabase
        .from('profiles')
        .update({
          emails_sent_today: newCount,
          last_email_sent_at: new Date().toISOString(),
        })
        .eq('id', userId)

      console.log(`[EMAIL] sent ${type} to ${to} (${newCount}/${MAX_EMAILS_PER_DAY})`)
    } else {
      console.log(`[EMAIL] sent ${type} to ${to}`)
    }

    return new Response(
      JSON.stringify({ sent: true, type, to }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[EMAIL] Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Function error', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
