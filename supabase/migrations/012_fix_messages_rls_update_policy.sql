-- 012_fix_messages_rls_update_policy.sql
-- Fix RLS policies for messages table to allow marking messages as read
-- This addresses the issue where messages couldn't be updated to mark them as read

-- First, ensure conversations table has the correct column structure
DO $$
BEGIN
  -- Check if conversations table needs to be updated
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'participant1_id'
  ) THEN
    ALTER TABLE conversations RENAME COLUMN participant1_id TO user1_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'participant2_id'
  ) THEN
    ALTER TABLE conversations RENAME COLUMN participant2_id TO user2_id;
  END IF;
END $$;

-- Drop existing message policies and recreate them correctly
DROP POLICY IF EXISTS "Users can see messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update messages" ON messages;

-- SELECT: Users can see all messages in conversations they participate in
CREATE POLICY "Users can see messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- INSERT: Users can only send messages themselves
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- UPDATE: Users can update messages in conversations they participate in
-- This allows marking messages as read by updating the is_read field
CREATE POLICY "Users can update messages" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
