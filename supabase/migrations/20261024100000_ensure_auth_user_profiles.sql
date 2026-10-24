-- Ensure every Supabase Auth user has a least-privilege application profile.
-- This migration is for review on the working branch only; it is not applied to production.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    'responsible'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = CASE
          WHEN public.profiles.name = '' THEN EXCLUDED.name
          ELSE public.profiles.name
        END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user_profile();

-- Repair orphaned accounts using the least-privileged standard role.
-- Existing profile roles are preserved; no account is granted admin access.
INSERT INTO public.profiles (id, email, name, role)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data ->> 'name', ''),
  'responsible'
FROM auth.users AS u
LEFT JOIN public.profiles AS p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
