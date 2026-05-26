-- 006_phase2_referrals_and_status.sql
-- Phase 2: Add referrals system and online status tracking

-- 1. Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) NOT NULL UNIQUE,
  referral_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on user_id to ensure one referral entry per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals(user_id);

-- Create index on referral_code for lookups
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

-- 2. Add subscription_plan column to profiles (rename from plan if exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_plan'
  ) THEN
    -- If plan column exists, copy it to subscription_plan
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'plan'
    ) THEN
      ALTER TABLE profiles ADD COLUMN subscription_plan VARCHAR(20) DEFAULT 'free';
      UPDATE profiles SET subscription_plan = plan WHERE plan IS NOT NULL;
      ALTER TABLE profiles DROP COLUMN plan;
    ELSE
      ALTER TABLE profiles ADD COLUMN subscription_plan VARCHAR(20) DEFAULT 'free';
    END IF;
  END IF;
END $$;

-- 3. Add last_active_at column to profiles for online status tracking
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_active_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Create index on last_active_at for efficient sorting
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at ON profiles(last_active_at DESC);

-- 4. Create blocked_users table (mentioned in plan as critical bug fix)
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);

-- 5. Update conversation table to include metadata (if not already exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'last_message_at'
  ) THEN
    ALTER TABLE conversations ADD COLUMN last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- 6. RLS policies for referrals table
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Users can view their own referral data
CREATE POLICY "Users can view own referrals" ON referrals
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own referral count
CREATE POLICY "Users can update own referrals" ON referrals
  FOR UPDATE USING (auth.uid() = user_id);

-- 7. RLS policies for blocked_users table
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- Users can view blocks they created or blocks affecting them
CREATE POLICY "Users can view blocks they created or blocks against them" ON blocked_users
  FOR SELECT USING (
    auth.uid() = blocker_id OR auth.uid() = blocked_id
  );

-- Users can create blocks
CREATE POLICY "Users can create blocks" ON blocked_users
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Users can delete their own blocks
CREATE POLICY "Users can delete their own blocks" ON blocked_users
  FOR DELETE USING (auth.uid() = blocker_id);
