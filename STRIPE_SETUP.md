# Stripe Setup - PAKT Production

## Overview
This document explains the Stripe subscription setup for PAKT production environment.

---

## Environment Variables

These variables MUST be configured in **Supabase Dashboard → Project Settings → Environment Variables**:

### Production Keys (sk_live_*)

⚠️ **NEVER commit real keys to git!** Set these in Supabase Dashboard only.

```
STRIPE_SECRET_KEY = sk_live_[YOUR_SECRET_KEY_HERE]

STRIPE_PRICE_ID_BUSINESS = price_[YOUR_BUSINESS_PRICE_ID]

STRIPE_PRICE_ID_PRO = price_[YOUR_PRO_PRICE_ID]

STRIPE_WEBHOOK_SECRET = whsec_[YOUR_WEBHOOK_SECRET]
```

**To set variables in Supabase:**
1. Go to Supabase Dashboard
2. Project Settings → Environment Variables
3. Add each variable with its real value from Stripe
4. Save and redeploy functions

---

## Stripe Webhook Configuration

### 1. Set Webhook Endpoint in Stripe Dashboard

Go to: **Stripe Dashboard → Developers → Webhooks → Add endpoint**

**Endpoint URL:**
```
https://[PROJECT-ID].functions.supabase.co/stripe-webhook
```

Replace `[PROJECT-ID]` with your actual Supabase project ID.

**Example:**
```
https://cpgnczuqhwdoalgyezvr.functions.supabase.co/stripe-webhook
```

### 2. Select Events to Listen

Enable these events:
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`
- ✅ `invoice.payment_succeeded`

### 3. Get Webhook Secret

After creating the endpoint, Stripe will provide a **Signing secret** (starts with `whsec_`).

Copy this and set it as `STRIPE_WEBHOOK_SECRET` in Supabase.

---

## Payment Flow

### Upgrade (Business/Pro)

1. User clicks "Passer Business" or "Passer Business Pro" in settings
2. App calls `create-checkout` edge function
3. Stripe Checkout opens
4. After payment, Stripe redirects to `https://pakt-sigma.vercel.app/payment/mobile-success`
5. Success page calls `confirm-payment` to activate plan
6. Webhook also updates subscription status in real-time

### Downgrade (Free)

1. User clicks "Passer à Gratuit"
2. Confirmation dialog appears
3. App calls `cancel-subscription` edge function
4. Function cancels Stripe subscription + downgrades to free in Supabase
5. Webhook `customer.subscription.deleted` event syncs the change

---

## Database Schema

Required columns in `profiles` table:

```sql
-- Subscription fields
stripe_customer_id TEXT          -- Stripe customer ID
stripe_subscription_id TEXT      -- Current subscription ID
subscription_plan TEXT          -- 'free', 'business', 'business_pro'
subscription_status TEXT        -- 'active', 'inactive', 'cancelled'
plan TEXT                       -- (legacy, kept for compatibility)
```

---

## Edge Functions

### 1. `create-checkout`
Creates a Stripe Checkout session for buying a plan.

**Called by:** `app/(app)/settings/index.tsx` → `handleUpgrade()`

**Handles:**
- Creating Stripe customer if needed
- Creating checkout session
- Storing metadata (user_id, plan, price_id)

### 2. `confirm-payment`
Confirms payment after user returns from Stripe Checkout.

**Called by:** `app/payment/success.tsx`

**Handles:**
- Verifying checkout session with Stripe
- Updating Supabase profile with new plan
- Handling errors gracefully (webhook will sync as backup)

### 3. `cancel-subscription`
Cancels Stripe subscription and downgrades to free.

**Called by:** `app/(app)/settings/index.tsx` → `handleDowngradeToFree()`

**Handles:**
- Cancelling Stripe subscription
- Updating Supabase plan to 'free'
- Error handling with user alerts

### 4. `stripe-webhook`
Real-time sync of Stripe events to Supabase.

**Triggered by:** Stripe (webhook endpoint)

**Handles:**
- `customer.subscription.created` → activate plan
- `customer.subscription.updated` → update plan/status
- `customer.subscription.deleted` → downgrade to free
- `invoice.payment_succeeded` → log payment (subscription already updated)

---

## Testing Checklist

Before production launch:

- [ ] All environment variables set in Supabase dashboard
- [ ] Webhook endpoint configured in Stripe
- [ ] Webhook signing secret saved in Supabase
- [ ] Test upgrade path: Free → Business → Pro
- [ ] Test downgrade path: Pro → Free
- [ ] Test webhook sync: Cancel subscription in Stripe dashboard, verify Supabase updates
- [ ] Test error handling: Cancel payment in Stripe Checkout
- [ ] Verify email confirmations sent (if enabled)
- [ ] Check Stripe logs for successful webhook deliveries

---

## Troubleshooting

**Webhook not delivering?**
- Check Stripe Dashboard → Developers → Webhooks → Event deliveries
- Verify endpoint URL is correct
- Ensure webhook secret is correctly set in Supabase

**User not getting plan activated?**
- Check Supabase logs: `Dashboard → Logs → Edge Functions → confirm-payment`
- Check Stripe logs for successful subscription creation
- Verify metadata is being passed correctly

**Downgrade not working?**
- Check Supabase logs: `Dashboard → Logs → Edge Functions → cancel-subscription`
- Verify stripe_subscription_id exists in user's profile
- Ensure STRIPE_SECRET_KEY is correct

---

## Important Notes

⚠️ **Do NOT use test keys (sk_test_*) in production**

✅ **Always use live keys (sk_live_*)**

✅ **Keep webhook secret secure** - never commit it to git

✅ **Monitor Stripe logs regularly** for webhook failures

✅ **Test thoroughly** before launching to production
