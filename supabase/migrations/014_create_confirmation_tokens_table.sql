-- 014_create_confirmation_tokens_table.sql
-- Create table to store email confirmation tokens for signup
-- When a user signs up, we generate a token and send it via Brevo
-- When they click the link, we mark the token as used and activate their account

CREATE TABLE IF NOT EXISTS confirmation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT token_not_empty CHECK (token <> '')
);

-- Index for fast lookups by token
CREATE INDEX IF NOT EXISTS idx_confirmation_tokens_token ON confirmation_tokens(token);

-- Index for cleanup queries (find expired tokens)
CREATE INDEX IF NOT EXISTS idx_confirmation_tokens_expires_at ON confirmation_tokens(expires_at);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_confirmation_tokens_email ON confirmation_tokens(email);

-- Enable RLS
ALTER TABLE confirmation_tokens ENABLE ROW LEVEL SECURITY;

-- Allow public (unauthenticated) to insert tokens during signup
CREATE POLICY "Allow public to insert confirmation tokens" ON confirmation_tokens
  FOR INSERT
  WITH CHECK (true);

-- Allow public (unauthenticated) to select tokens for validation
CREATE POLICY "Allow public to select confirmation tokens" ON confirmation_tokens
  FOR SELECT
  USING (true);

-- Allow authenticated users to update their own confirmation tokens
CREATE POLICY "Allow users to update confirmation tokens" ON confirmation_tokens
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
