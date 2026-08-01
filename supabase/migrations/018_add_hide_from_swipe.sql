-- Allows hiding specific profiles (e.g. test/demo accounts) from the swipe
-- feed without deleting them or suspending the account.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hide_from_swipe BOOLEAN NOT NULL DEFAULT false;

UPDATE profiles
SET hide_from_swipe = true
WHERE email IN (
  'fosterliam307@gmail.com',
  'nicholaswane8@gmail.com',
  'brooksolivia182@gmail.com'
);
