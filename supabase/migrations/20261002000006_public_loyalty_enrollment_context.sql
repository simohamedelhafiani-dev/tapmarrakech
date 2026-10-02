-- Public read-only context for the permanent establishment enrollment URL.
-- No table or column changes.

create or replace function public.get_public_loyalty_enrollment_context(
  p_establishment_id uuid
)
returns table(
  establishment_name text
)
language sql
stable
security definer
set search_path = public
as $function$
  select e.name
  from public.establishments e
  join public.loyalty_settings s
    on s.establishment_id = e.id
  where e.id = p_establishment_id
    and coalesce(s.enabled, false) = true
  limit 1;
$function$;

revoke all on function public.get_public_loyalty_enrollment_context(uuid) from public;
grant execute on function public.get_public_loyalty_enrollment_context(uuid) to anon, authenticated;
