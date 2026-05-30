-- 011_create_encouragements_table.sql
-- Create encouragements table for Business users to encourage Free users to upgrade

CREATE TABLE IF NOT EXISTS encouragements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sender_id, target_id, DATE(created_at))
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_encouragements_sender ON encouragements(sender_id);
CREATE INDEX IF NOT EXISTS idx_encouragements_target ON encouragements(target_id);
CREATE INDEX IF NOT EXISTS idx_encouragements_conversation ON encouragements(conversation_id);
CREATE INDEX IF NOT EXISTS idx_encouragements_created_at ON encouragements(created_at DESC);

-- Enable RLS
ALTER TABLE encouragements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view encouragements they sent or received
CREATE POLICY "Users can view encouragements they sent or received" ON encouragements
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = target_id
  );

-- Users can insert encouragements (will be restricted to Business plan via app logic)
CREATE POLICY "Users can insert encouragements" ON encouragements
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Users can only delete their own encouragements (admin feature)
CREATE POLICY "Users can delete their own encouragements" ON encouragements
  FOR DELETE USING (auth.uid() = sender_id);
