-- Correct the membership role check for employee sessions.
-- establishment_staff uses OWNER/MANAGER/STAFF; profiles separately use role='employee'.
CREATE OR REPLACE FUNCTION public.get_active_employee_session_establishment(p_session_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_establishment uuid;
BEGIN
  SELECT es.establishment_id
  INTO v_establishment
  FROM public.employee_sessions es
  JOIN public.establishment_staff st
    ON st.user_id = es.employee_id
   AND st.establishment_id = es.establishment_id
   AND st.active = true
   AND st.role = 'STAFF'
  JOIN public.profiles p
    ON p.id = es.employee_id
   AND p.role = 'employee'
  WHERE es.token_hash = encode(digest(trim(p_session_token), 'sha256'), 'hex')
    AND es.expires_at > now()
    AND EXISTS (
      SELECT 1
      FROM public.employee_access_codes ec
      WHERE ec.user_id = es.employee_id
        AND ec.establishment_id = es.establishment_id
        AND ec.active = true
    )
  LIMIT 1;

  RETURN v_establishment;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_active_employee_session_establishment(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_employee_session_establishment(text) TO service_role;
