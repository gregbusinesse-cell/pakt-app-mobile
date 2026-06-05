-- 015_referral_rewards_and_subscription_dates.sql
-- Add subscription end date tracking and referral rewards claiming system

-- 1. Add subscription_end_date and subscription_status to profiles if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_end_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_end_date TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'active';
  END IF;
END $$;

-- 2. Alter referrals table to support new schema (referred_id, referral_code, status)
-- First, check if it uses the old schema and migrate if needed
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'referrals' AND column_name = 'user_id'
  ) THEN
    -- Old schema exists, we need to migrate
    -- For now, we'll keep the old schema and add new columns
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'referrals' AND column_name = 'referred_id'
    ) THEN
      ALTER TABLE referrals ADD COLUMN referred_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
      ALTER TABLE referrals ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
    END IF;
  END IF;
END $$;

-- 3. Create referral_rewards_claimed table to track which rewards have been claimed
CREATE TABLE IF NOT EXISTS referral_rewards_claimed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  required_count INTEGER NOT NULL,
  plan_type VARCHAR(20) NOT NULL,
  days_added INTEGER NOT NULL,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, required_count)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_referral_rewards_claimed_user_id ON referral_rewards_claimed(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_claimed_claimed_at ON referral_rewards_claimed(claimed_at DESC);

-- 4. RLS policies for referral_rewards_claimed table
ALTER TABLE referral_rewards_claimed ENABLE ROW LEVEL SECURITY;

-- Users can view their own claimed rewards
CREATE POLICY "Users can view own claimed rewards" ON referral_rewards_claimed
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert rewards (from edge function)
CREATE POLICY "Service role can insert rewards" ON referral_rewards_claimed
  FOR INSERT WITH CHECK (true);
