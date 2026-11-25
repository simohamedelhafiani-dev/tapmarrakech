-- Explicit, server-side Smart Nearby consent, separate from marketing and notification consent.
alter table public.loyalty_customers
  add column if not exists gps_consent boolean not null default false,
  add column if not exists gps_consent_at timestamptz,
  add column if not exists gps_consent_revoked_at timestamptz;

create or replace function public.set_public_loyalty_gps_consent(
  p_access_token uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_customer_id uuid;
begin
  if p_access_token is null or p_enabled is null then
    raise exception 'invalid_gps_consent_request' using errcode = '22023';
  end if;

  select l.customer_id
    into v_customer_id
  from public.loyalty_customer_links l
  where l.access_token = p_access_token
  limit 1;

  if v_customer_id is null then
    return false;
  end if;

  update public.loyalty_customers
  set gps_consent = p_enabled,
      gps_consent_at = case when p_enabled then now() else gps_consent_at end,
      gps_consent_revoked_at = case when p_enabled then null else now() end,
      updated_at = now()
  where id = v_customer_id;

  return found;
end;
$$;

revoke all on function public.set_public_loyalty_gps_consent(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_public_loyalty_gps_consent(uuid, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
