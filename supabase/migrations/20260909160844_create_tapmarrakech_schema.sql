/*
# Create TapMarrakech multi-tenant review platform

1. New Tables
- `profiles`: account profile linked to Supabase Auth.
- `establishments`: owner-managed venues and public review settings.
- `reviews`: ratings and private negative feedback submitted by customers.
- `analytics_events`: durable event stream for scans, ratings, redirects, and submissions.

2. Security
- Row Level Security is enabled on every table.
- Authenticated owners can only access their own profile and establishment data.
- Public visitors can read only the fields needed to render a venue page and can submit reviews/events, but cannot read customer feedback.

3. Important Notes
- Establishment ownership is inherited by child records through an ownership EXISTS check.
- Public establishment reads are intentional because the public route is identified by slug.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  google_review_url text NOT NULL DEFAULT '',
  redirect_threshold integer NOT NULL DEFAULT 4 CHECK (redirect_threshold BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  type text NOT NULL DEFAULT 'negative' CHECK (type IN ('positive', 'negative')),
  comment text,
  name text,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'Nouveau' CHECK (status IN ('Nouveau', 'En cours', 'Traité')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('page_view', 'rating_selected', 'google_redirect', 'negative_feedback', 'review_submitted')),
  rating integer CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS establishments_user_id_idx ON public.establishments(user_id);
CREATE INDEX IF NOT EXISTS establishments_slug_idx ON public.establishments(slug);
CREATE INDEX IF NOT EXISTS reviews_establishment_created_idx ON public.reviews(establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_establishment_created_idx ON public.analytics_events(establishment_id, created_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "establishments_public_select" ON public.establishments;
CREATE POLICY "establishments_public_select" ON public.establishments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "establishments_owner_insert" ON public.establishments;
CREATE POLICY "establishments_owner_insert" ON public.establishments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "establishments_owner_update" ON public.establishments;
CREATE POLICY "establishments_owner_update" ON public.establishments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "establishments_owner_delete" ON public.establishments;
CREATE POLICY "establishments_owner_delete" ON public.establishments FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_public_insert" ON public.reviews;
CREATE POLICY "reviews_public_insert" ON public.reviews FOR INSERT TO anon, authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id));
DROP POLICY IF EXISTS "reviews_owner_select" ON public.reviews;
CREATE POLICY "reviews_owner_select" ON public.reviews FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.user_id = auth.uid()));
DROP POLICY IF EXISTS "reviews_owner_update" ON public.reviews;
CREATE POLICY "reviews_owner_update" ON public.reviews FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.user_id = auth.uid()));
DROP POLICY IF EXISTS "reviews_owner_delete" ON public.reviews;
CREATE POLICY "reviews_owner_delete" ON public.reviews FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.user_id = auth.uid()));

DROP POLICY IF EXISTS "analytics_public_insert" ON public.analytics_events;
CREATE POLICY "analytics_public_insert" ON public.analytics_events FOR INSERT TO anon, authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id));
DROP POLICY IF EXISTS "analytics_owner_select" ON public.analytics_events;
CREATE POLICY "analytics_owner_select" ON public.analytics_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.user_id = auth.uid()));
DROP POLICY IF EXISTS "analytics_owner_update" ON public.analytics_events;
CREATE POLICY "analytics_owner_update" ON public.analytics_events FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.user_id = auth.uid()));
DROP POLICY IF EXISTS "analytics_owner_delete" ON public.analytics_events;
CREATE POLICY "analytics_owner_delete" ON public.analytics_events FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_id AND e.user_id = auth.uid()));
