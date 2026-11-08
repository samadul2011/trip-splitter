-- =============================================================================
-- TRIP EXPENSE SPLITTER - NEON POSTGRESQL SCHEMA & INITIAL USERS
-- =============================================================================
-- Note: The Next.js app also auto-runs this schema on first connection,
-- or you can run it directly in the Neon SQL Editor (https://console.neon.tech).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Table: profiles (Users managed by Admin)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Table: trips
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Table: trip_members (many-to-many)
CREATE TABLE IF NOT EXISTS trip_members (
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (trip_id, user_id)
);

-- 4. Table: expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  paid_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_profiles_name_lower ON profiles (LOWER(full_name));
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members (user_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON trip_members (trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON expenses (trip_id);

-- =============================================================================
-- HOW TO ADD USERS MANUALLY (ADMIN)
-- =============================================================================
-- You can insert users directly with their name and password:
INSERT INTO profiles (full_name, password_hash)
VALUES
  ('Sabuj', '123456'),
  ('Limon', '123456'),
  ('Arian', '123456'),
  ('Samadul', '635504'),
  ('Tanha', '123456'),
  ('Sabina', '123456'),
  ('Luto', '123456')
ON CONFLICT (full_name) DO NOTHING;

