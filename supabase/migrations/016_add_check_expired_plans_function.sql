-- 016_add_check_expired_plans_function.sql
-- Create check_expired_plans function to restore original plans after reward expiration

CREATE OR REPLACE FUNCTION check_expired_plans()
RETURNS void AS $$
BEGIN
  -- Trouver les plans expirés, restaurer le plan original ET réinitialiser les filtres
  UPDATE profiles
  SET
    subscription_plan = pe.original_plan,
    -- Réinitialiser les filtres avancés quand le plan Business Pro expire
    min_age = 15,
    max_age = 99,
    max_distance_km = 100000,
    preferred_skills = '[]'::jsonb
  FROM plan_expirations pe
  WHERE profiles.id = pe.user_id
    AND pe.expires_at <= NOW();

  -- Supprimer les enregistrements expirés
  DELETE FROM plan_expirations
  WHERE expires_at <= NOW();

  RAISE NOTICE 'check_expired_plans: Restored expired plans at %', NOW();
END;
$$ LANGUAGE plpgsql;
