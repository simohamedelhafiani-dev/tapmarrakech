ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Existing profiles with a usable name are treated as already onboarded.
-- Only accounts created after this migration will start with a NULL completion timestamp.
UPDATE public.profiles
SET onboarding_completed_at = now()
WHERE onboarding_completed_at IS NULL
  AND length(trim(coalesce(name, ''))) >= 2;

COMMENT ON COLUMN public.profiles.onboarding_completed_at IS
  'Timestamp when the user completed the KELYANI onboarding flow.';
