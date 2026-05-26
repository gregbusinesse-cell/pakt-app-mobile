-- 008_phase4_preferences_and_filters.sql
-- Phase 4: User preferences and filtering system

-- 1. Add preference columns to profiles table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'min_age'
  ) THEN
    ALTER TABLE profiles ADD COLUMN min_age INTEGER DEFAULT 15;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'max_age'
  ) THEN
    ALTER TABLE profiles ADD COLUMN max_age INTEGER DEFAULT 99;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'max_distance_km'
  ) THEN
    ALTER TABLE profiles ADD COLUMN max_distance_km INTEGER DEFAULT 10000;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'preferred_skills'
  ) THEN
    ALTER TABLE profiles ADD COLUMN preferred_skills JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 2. Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_profiles_age ON profiles(age);
CREATE INDEX IF NOT EXISTS idx_profiles_city_lat ON profiles(city_lat);
CREATE INDEX IF NOT EXISTS idx_profiles_city_lng ON profiles(city_lng);
CREATE INDEX IF NOT EXISTS idx_profiles_preferences ON profiles USING gin (preferred_skills);

-- 3. Create a view for easy profile filtering
CREATE OR REPLACE VIEW profiles_visible_to_user AS
SELECT
  p.*,
  (
    SELECT COUNT(*)
    FROM likes l
    WHERE l.liked_id = p.id AND l.liker_id = auth.uid()
  ) as liked_by_current_user,
  (
    SELECT COUNT(*)
    FROM dislikes d
    WHERE d.disliked_id = p.id AND d.disliker_id = auth.uid()
  ) as disliked_by_current_user,
  (
    SELECT EXISTS(
      SELECT 1 FROM blocked_users
      WHERE (blocker_id = auth.uid() AND blocked_id = p.id)
      OR (blocker_id = p.id AND blocked_id = auth.uid())
    )
  ) as is_blocked
FROM profiles p
WHERE p.id != auth.uid()
AND p.is_suspended = FALSE
AND NOT EXISTS (
  SELECT 1 FROM blocked_users
  WHERE (blocker_id = auth.uid() AND blocked_id = p.id)
  OR (blocker_id = p.id AND blocked_id = auth.uid())
);

-- 4. Create function to get filtered profiles based on preferences
CREATE OR REPLACE FUNCTION get_filtered_profiles(
  p_user_id UUID,
  p_use_filters BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID, first_name VARCHAR, age INTEGER, city VARCHAR,
  city_lat FLOAT8, city_lng FLOAT8, photos TEXT[],
  bio TEXT, interests TEXT[], skills JSONB, subscription_plan VARCHAR,
  distance_km FLOAT8, liked BOOLEAN, disliked BOOLEAN, is_blocked BOOLEAN
) AS $$
DECLARE
  v_user_lat FLOAT8;
  v_user_lng FLOAT8;
  v_min_age INTEGER;
  v_max_age INTEGER;
  v_max_distance INTEGER;
  v_preferred_skills JSONB;
  v_is_business_pro BOOLEAN;
BEGIN
  -- Get current user's location and preferences
  SELECT city_lat, city_lng, min_age, max_age, max_distance_km, preferred_skills,
         (subscription_plan = 'business_pro')
  INTO v_user_lat, v_user_lng, v_min_age, v_max_age, v_max_distance, v_preferred_skills, v_is_business_pro
  FROM profiles
  WHERE id = p_user_id;

  -- If user is not Business Pro, use unlimited filters
  IF NOT v_is_business_pro THEN
    v_min_age := 15;
    v_max_age := 99;
    v_max_distance := 10000;
    v_preferred_skills := '[]'::jsonb;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.age,
    p.city,
    p.city_lat,
    p.city_lng,
    p.photos,
    p.bio,
    p.interests,
    p.skills,
    p.subscription_plan,
    CASE
      WHEN v_user_lat IS NOT NULL AND v_user_lng IS NOT NULL
      AND p.city_lat IS NOT NULL AND p.city_lng IS NOT NULL
      THEN ROUND(CAST(
        (
          acos(
            sin(radians(v_user_lat)) * sin(radians(p.city_lat)) +
            cos(radians(v_user_lat)) * cos(radians(p.city_lat)) *
            cos(radians(v_user_lng - p.city_lng))
          ) * 6371
        ) AS NUMERIC
      ), 1)::FLOAT8
      ELSE NULL
    END as distance_km,
    (
      SELECT COUNT(*) > 0
      FROM likes l
      WHERE l.liked_id = p.id AND l.liker_id = p_user_id
    ) as liked,
    (
      SELECT COUNT(*) > 0
      FROM dislikes d
      WHERE d.disliked_id = p.id AND d.disliker_id = p_user_id
    ) as disliked,
    (
      SELECT EXISTS(
        SELECT 1 FROM blocked_users
        WHERE (blocker_id = p_user_id AND blocked_id = p.id)
        OR (blocker_id = p.id AND blocked_id = p_user_id)
      )
    ) as is_blocked
  FROM profiles p
  WHERE p.id != p_user_id
    AND p.is_suspended = FALSE
    AND p.age >= v_min_age
    AND p.age <= v_max_age
    AND NOT EXISTS (
      SELECT 1 FROM blocked_users
      WHERE (blocker_id = p_user_id AND blocked_id = p.id)
      OR (blocker_id = p.id AND blocked_id = p_user_id)
    )
    AND (
      -- If skills filter is empty, show all; otherwise match by skills
      jsonb_array_length(v_preferred_skills) = 0
      OR (
        p.skills IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(p.skills) AS skill
          WHERE skill ->> 'name' = ANY(jsonb_array_elements_text(v_preferred_skills))
        )
      )
    )
  ORDER BY
    CASE
      WHEN v_user_lat IS NOT NULL AND v_user_lng IS NOT NULL
      AND p.city_lat IS NOT NULL AND p.city_lng IS NOT NULL
      THEN acos(
        sin(radians(v_user_lat)) * sin(radians(p.city_lat)) +
        cos(radians(v_user_lat)) * cos(radians(p.city_lat)) *
        cos(radians(v_user_lng - p.city_lng))
      ) * 6371
      ELSE 0
    END ASC;
END;
$$ LANGUAGE plpgsql;

-- 5. RLS policy - profiles can update their own preferences
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
