-- 007_phase3_reports_and_improvements.sql
-- Phase 3: User reports system and message improvements

-- 1. Create user_reports table for moderation
CREATE TABLE IF NOT EXISTS user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  reason VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, reviewed, dismissed, actioned
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_taken TEXT
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_reports_reported_id ON user_reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter_id ON user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_created_at ON user_reports(created_at DESC);

-- 2. Add is_deleted column to messages (soft delete for user privacy)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 3. Add conversation_metadata for muted/archived status
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'is_muted'
  ) THEN
    ALTER TABLE conversations ADD COLUMN is_muted BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE conversations ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 4. Create conversation_participant_metadata for per-user settings
CREATE TABLE IF NOT EXISTS conversation_participant_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_muted BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conv_participant_user_id ON conversation_participant_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_participant_conv_id ON conversation_participant_metadata(conversation_id);

-- 5. RLS policies for user_reports
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- Users can view reports they made or reports about them
CREATE POLICY "Users can view own reports" ON user_reports
  FOR SELECT USING (
    auth.uid() = reporter_id OR auth.uid() = reported_id OR
    auth.uid() IN (SELECT id FROM profiles WHERE email IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
    ) AND subscription_plan = 'business_pro')
  );

-- Users can create reports
CREATE POLICY "Users can create reports" ON user_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- 6. RLS policies for conversation_participant_metadata
ALTER TABLE conversation_participant_metadata ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own metadata
CREATE POLICY "Users can manage own conversation metadata" ON conversation_participant_metadata
  FOR ALL USING (auth.uid() = user_id);

-- 7. Update messages RLS to respect soft deletes
DO $$
BEGIN
  -- Drop existing policy if it exists
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can view conversation messages') THEN
    DROP POLICY "Users can view conversation messages" ON messages;
  END IF;

  -- Create new policy that handles soft deletes
  CREATE POLICY "Users can view non-deleted conversation messages" ON messages
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM conversations
        WHERE id = messages.conversation_id
        AND (user1_id = auth.uid() OR user2_id = auth.uid())
      ) AND NOT is_deleted
    );
END $$;

-- 8. Create function to mark conversation as read
CREATE OR REPLACE FUNCTION mark_conversation_as_read(conv_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE conversation_participant_metadata
  SET last_read_at = NOW()
  WHERE conversation_id = conv_id AND user_id = auth.uid();

  UPDATE messages
  SET is_read = TRUE
  WHERE conversation_id = conv_id
  AND sender_id != auth.uid();
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger to auto-create conversation participant metadata on new conversation
CREATE OR REPLACE FUNCTION create_conversation_participants()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO conversation_participant_metadata (conversation_id, user_id)
  VALUES (NEW.id, NEW.user1_id);

  INSERT INTO conversation_participant_metadata (conversation_id, user_id)
  VALUES (NEW.id, NEW.user2_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_conversation_participants ON conversations;
CREATE TRIGGER trigger_create_conversation_participants
AFTER INSERT ON conversations
FOR EACH ROW
EXECUTE FUNCTION create_conversation_participants();
