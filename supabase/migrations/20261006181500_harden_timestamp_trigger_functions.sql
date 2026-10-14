-- Pre-commercial hardening: trigger-only timestamp functions do not need
-- a mutable search_path. Keep behavior identical while removing the
-- function_search_path_mutable warning.
create or replace function public.set_tapmarrakech_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.update_loyalty_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.update_promotions_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
