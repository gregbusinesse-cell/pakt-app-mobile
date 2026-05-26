-- ============================================
-- Fix Missing RLS INSERT Policies
-- ============================================
-- Problem: likes, swipes tables had no INSERT policies,
-- blocking users from creating new records

-- ============================================
-- 1. FIX LIKES — Add missing INSERT policy
-- ============================================
DROP POLICY IF EXISTS "Users can insert likes" ON likes;

CREATE POLICY "Users can insert likes" ON likes
  FOR INSERT WITH CHECK (auth.uid() = liker_id);

-- ============================================
-- 2. VERIFY SWIPES has INSERT policy (should exist)
-- ============================================
DROP POLICY IF EXISTS "Users can create swipes" ON swipes;

CREATE POLICY "Users can create swipes" ON swipes
  FOR INSERT WITH CHECK (auth.uid() = swiper_id);

-- ============================================
-- 3. VERIFY profile_views has INSERT policy
-- ============================================
DROP POLICY IF EXISTS "Users can insert own views" ON profile_views;

CREATE POLICY "Users can insert own views" ON profile_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- ============================================
-- 4. Verify blocked_users has INSERT policy
-- ============================================
DROP POLICY IF EXISTS "Users can block users" ON blocked_users;
DROP POLICY IF EXISTS "Users can create blocks" ON blocked_users;

CREATE POLICY "Users can create blocks" ON blocked_users
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- ============================================
-- 5. Verify conversations has proper INSERT
-- ============================================
-- Should already exist from 003, but verify
DROP POLICY IF EXISTS "Participants can insert conversations" ON conversations;

CREATE POLICY "Participants can insert conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- ============================================
-- 6. Verify messages has proper INSERT
-- ============================================
DROP POLICY IF EXISTS "Users can send messages" ON messages;

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
