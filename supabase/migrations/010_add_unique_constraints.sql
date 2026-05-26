-- ============================================
-- Add Missing UNIQUE Constraints
-- ============================================
-- Problem: swipes table created without UNIQUE(swiper_id, target_id)
-- This breaks ON CONFLICT upsert operations

-- 1. Add UNIQUE constraint to swipes if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'swipes'
    AND indexname = 'swipes_swiper_id_target_id_key'
  ) THEN
    ALTER TABLE swipes ADD CONSTRAINT swipes_swiper_id_target_id_key UNIQUE (swiper_id, target_id);
  END IF;
END $$;

-- 2. Verify likes UNIQUE constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'likes'
    AND indexname = 'likes_liker_id_liked_id_key'
  ) THEN
    ALTER TABLE likes ADD CONSTRAINT likes_liker_id_liked_id_key UNIQUE (liker_id, liked_id);
  END IF;
END $$;

-- 3. Verify profile_views UNIQUE constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'profile_views'
    AND indexname = 'profile_views_viewer_id_viewed_id_key'
  ) THEN
    ALTER TABLE profile_views ADD CONSTRAINT profile_views_viewer_id_viewed_id_key UNIQUE (viewer_id, viewed_id);
  END IF;
END $$;

-- 4. Verify referrals UNIQUE constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'referrals'
    AND indexname = 'referrals_referrer_id_referred_id_key'
  ) THEN
    ALTER TABLE referrals ADD CONSTRAINT referrals_referrer_id_referred_id_key UNIQUE (referrer_id, referred_id);
  END IF;
END $$;
