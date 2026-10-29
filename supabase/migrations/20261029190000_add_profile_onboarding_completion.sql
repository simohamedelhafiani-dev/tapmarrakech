ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

COMMENT ON COLUMN public.profiles.onboarding_completed_at IS
  'Timestamp when the user completed the KELYANI onboarding flow.';
