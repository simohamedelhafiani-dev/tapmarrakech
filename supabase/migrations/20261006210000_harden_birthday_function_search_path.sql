CREATE OR REPLACE FUNCTION public.normalize_loyalty_customer_birthday()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
begin
  if new.birth_date is not null then
    new.birth_day := extract(day from new.birth_date)::smallint;
    new.birth_month := extract(month from new.birth_date)::smallint;
    new.birth_date := null;
  end if;
  if new.birth_day is not null and new.birth_month is not null then
    if new.birth_day > 29 and new.birth_month = 2 then
      raise exception 'Jour de naissance invalide';
    end if;
  end if;
  return new;
end;
$function$;
