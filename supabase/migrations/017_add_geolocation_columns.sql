-- 017_add_geolocation_columns.sql
-- Add latitude and longitude columns for distance-based filtering

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'lat'
  ) THEN
    ALTER TABLE profiles ADD COLUMN lat NUMERIC(10, 6);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'lon'
  ) THEN
    ALTER TABLE profiles ADD COLUMN lon NUMERIC(10, 6);
  END IF;
END $$;

-- Create index for efficient distance-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_lat_lon ON profiles(lat, lon);
