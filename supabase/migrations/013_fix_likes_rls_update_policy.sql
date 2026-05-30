-- 013_fix_likes_rls_update_policy.sql
-- Fix RLS policy on likes table to allow the recipient (liked_id) to mark
-- a like as viewed. Without this, the notification badge stays stuck at 1+
-- because the SELECT works but the UPDATE silently affects 0 rows.

-- Make sure RLS is enabled on likes
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Drop any existing UPDATE policies to avoid conflicts
DROP POLICY IF EXISTS "Users can update own likes" ON likes;
DROP POLICY IF EXISTS "Users can update likes they received" ON likes;
DROP POLICY IF EXISTS "Users can update is_viewed on received likes" ON likes;

-- Allow BOTH the liker AND the liked user to UPDATE likes.
-- The liker may need to undo / change their like.
-- The liked user needs to mark is_viewed = true to clear the badge.
CREATE POLICY "Users can update own or received likes" ON likes
  FOR UPDATE
  USING (auth.uid() = liker_id OR auth.uid() = liked_id)
  WITH CHECK (auth.uid() = liker_id OR auth.uid() = liked_id);

-- Same defensive fix on matches in case the same pattern bites us there.
-- (matches is_viewed update by either user1_id or user2_id)
DROP POLICY IF EXISTS "Users can update own matches" ON matches;
DROP POLICY IF EXISTS "Users can update matches they belong to" ON matches;

CREATE POLICY "Users can update own matches" ON matches
  FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id)
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);
