-- 016_add_check_expired_plans_function.sql
-- Create check_expired_plans function to restore original plans after reward expiration

-- Create function to check and restore expired plans
CREATE OR REPLACE FUNCTION check_expired_plans()
RETURNS void AS $$
BEGIN
  -- Find all expired temporary plans and restore them
  UPDATE profiles
  SET subscription_plan = original_plan
  WHERE id IN (
    SELECT DISTINCT user_id FROM plan_expirations
    WHERE expires_at <= NOW()
  );

  -- Delete expired plan records
  DELETE FROM plan_expirations
  WHERE expires_at <= NOW();

  -- Log the operation
  RAISE NOTICE 'check_expired_plans: Restored expired plans at %', NOW();
END;
$$ LANGUAGE plpgsql;
