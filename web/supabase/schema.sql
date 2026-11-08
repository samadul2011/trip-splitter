-- =============================================================================
-- TRIP EXPENSE SPLITTER - SUPABASE POSTGRESQL SCHEMA & RLS POLICIES
-- =============================================================================
-- Run this entire script in the Supabase SQL Editor (https://supabase.com/dashboard)

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- Table: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: trips
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: trip_members (many-to-many)
CREATE TABLE IF NOT EXISTS public.trip_members (
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (trip_id, user_id)
);

-- Table: expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  paid_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON public.trip_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON public.trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON public.expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON public.expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_lower ON public.profiles(LOWER(full_name));

-- =============================================================================
-- 2. AUTO-CREATE PROFILE TRIGGER (WHEN ADMIN ADDS USER IN SUPABASE AUTH)
-- =============================================================================
-- When you create a user in Supabase Auth (e.g., email: "rahim@tripapp.com"),
-- this trigger automatically creates a row in `public.profiles` with `full_name`
-- taken from user metadata (`full_name`) or capitalized from the email prefix ("Rahim").

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  derived_name TEXT;
BEGIN
  derived_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    INITCAP(SPLIT_PART(NEW.email, '@', 1))
  );

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, derived_name)
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 3. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
-- =============================================================================
-- Using SECURITY DEFINER helpers prevents infinite recursion between `trips`
-- and `trip_members` RLS policies.

CREATE OR REPLACE FUNCTION public.is_trip_member(_trip_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_members
    WHERE trip_id = _trip_id
      AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_trip_creator(_trip_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trips
    WHERE id = _trip_id
      AND created_by = _user_id
  );
$$;

-- =============================================================================
-- 4. ENABLE RLS & CREATE POLICIES
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES POLICIES ----
-- Authenticated users can view all profiles (needed to search/add members & display names)
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert/update their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---- TRIPS POLICIES ----
-- Users can only see trips they are members of (or created)
DROP POLICY IF EXISTS "Users can view trips they belong to" ON public.trips;
CREATE POLICY "Users can view trips they belong to"
  ON public.trips
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_trip_member(id, auth.uid())
  );

-- Authenticated users can create trips where created_by is themselves
DROP POLICY IF EXISTS "Users can create trips" ON public.trips;
CREATE POLICY "Users can create trips"
  ON public.trips
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Trip members or creator can mark trip as completed / update trip
DROP POLICY IF EXISTS "Trip members can update trip" ON public.trips;
CREATE POLICY "Trip members can update trip"
  ON public.trips
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_trip_member(id, auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.is_trip_member(id, auth.uid())
  );

-- ---- TRIP_MEMBERS POLICIES ----
-- Users can view members of trips they belong to (or created)
DROP POLICY IF EXISTS "Users can view members of their trips" ON public.trip_members;
CREATE POLICY "Users can view members of their trips"
  ON public.trip_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_trip_member(trip_id, auth.uid())
    OR public.is_trip_creator(trip_id, auth.uid())
  );

-- Trip creator or existing member can add members to the trip
DROP POLICY IF EXISTS "Trip creator or members can add trip members" ON public.trip_members;
CREATE POLICY "Trip creator or members can add trip members"
  ON public.trip_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_trip_creator(trip_id, auth.uid())
    OR public.is_trip_member(trip_id, auth.uid())
  );

-- ---- EXPENSES POLICIES ----
-- Users can only view expenses of trips they are members of
DROP POLICY IF EXISTS "Trip members can view expenses" ON public.expenses;
CREATE POLICY "Trip members can view expenses"
  ON public.expenses
  FOR SELECT
  TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()));

-- Users can only add expenses paid by themselves to trips they are members of
DROP POLICY IF EXISTS "Trip members can insert own expenses" ON public.expenses;
CREATE POLICY "Trip members can insert own expenses"
  ON public.expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    paid_by = auth.uid()
    AND public.is_trip_member(trip_id, auth.uid())
  );

