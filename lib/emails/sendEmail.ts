// lib/emails/sendEmail.ts
// Core email service — Brevo API + anti-spam + logging
// Adapted for React Native/Expo

import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

const BREVO_API_KEY = process.env.BREVO_API_KEY || Constants.expoConfig?.extra?.brevoApiKey
const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Constants.expoConfig?.extra?.supabaseServiceKey
const APP_URL = 'https://paktapp.fr'

const MAX_EMAILS_PER_DAY = 2

export type EmailType =
  | 'welcome'
  | 'confirm_signup'
  | 'like'
  | 'match'
  | 'message'
  | 'inactive_day_1'
  | 'inactive_day_2'
  | 'inactive_day_3'
  | 'incomplete_profile'

interface SendEmailParams {
  userId?: string
  to: string
  subject: string
  htmlContent: string
  type: EmailType
}

interface SendEmailResult {
  sent: boolean
  reason?: string
}

/**
 * Send an email via Brevo with built-in anti-spam:
 * 1. Check unsubscribed (if userId provided)
 * 2. Check daily limit (max 2/day)
 * 3. Check duplicate (same type within 23h)
 * 4. Send via Brevo API
 * 5. Log to email_events
 * 6. Increment emails_sent_today + update last_email_sent_at
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { userId, to, subject, htmlContent, type } = params

  if (!BREVO_API_KEY) {
    console.error('[EMAIL] BREVO_API_KEY missing')
    return { sent: false, reason: 'brevo_key_missing' }
  }

  // Create service role client for admin operations
  const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '', {
    auth: {
      persistSession: false, // Service role doesn't need session
    },
  })

  // ── 1. Check unsubscribed (if userId provided) ────────────────
  if (userId) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('emails_sent_today, last_email_sent_at, email_unsubscribed')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('[EMAIL] profile lookup failed', profileError)
      // Don't return error - proceed anyway for signup emails
    }

    if (profile?.email_unsubscribed) {
      console.log(`[EMAIL] user ${userId} is unsubscribed`)
      return { sent: false, reason: 'unsubscribed' }
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
      return { sent: false, reason: 'daily_limit' }
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
      return { sent: false, reason: 'duplicate' }
    }
  }

  // ── 4. Send via Brevo ────────────────────────────────────────
  try {
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
      return { sent: false, reason: 'brevo_error' }
    }
  } catch (err) {
    console.error('[EMAIL] Brevo fetch failed', err)
    return { sent: false, reason: 'network_error' }
  }

  // ── 5. Log event (if userId provided) ─────────────────────────
  if (userId) {
    await supabase.from('email_events').insert({
      user_id: userId,
      type,
    })

    // ── 6. Update counter ────────────────────────────────────────
    let currentCount = 0
    const { data: profile } = await supabase
      .from('profiles')
      .select('emails_sent_today')
      .eq('id', userId)
      .single()

    if (profile?.emails_sent_today) {
      currentCount = profile.emails_sent_today
    }

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

  return { sent: true }
}
