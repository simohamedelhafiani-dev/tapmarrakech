-- Self-service Premium trial for newly registered responsible users.
-- The authenticated user never receives admin privileges.
create or replace function public.create_establishment_with_premium_trial(
  p_name text,
  p_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_establishment_id uuid;
  v_plan_id uuid;
  v_started_at timestamptz := now();
  v_period_end timestamptz := now() + interval '30 days';
  v_name text := nullif(trim(p_name), '');
  v_slug text := lower(trim(p_slug));
begin
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  if v_name is null or length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'Le nom de l’établissement doit contenir entre 2 et 120 caractères' using errcode = '22023';
  end if;

  if v_slug is null or v_slug !~ '^[a-z0-9]+([a-z0-9-]*[a-z0-9])?$' or length(v_slug) > 80 then
    raise exception 'Identifiant public invalide' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.role = 'responsible'
  ) then
    raise exception 'Ce parcours est réservé aux comptes responsables' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.establishments e where e.user_id = v_user_id
  ) or exists (
    select 1 from public.establishment_staff es
    where es.user_id = v_user_id and es.active = true
  ) then
    raise exception 'Un établissement est déjà associé à ce compte' using errcode = '23505';
  end if;

  select sp.id into v_plan_id
  from public.subscription_plans sp
  where lower(sp.name) = 'premium' and sp.active = true
  limit 1;

  if v_plan_id is null then
    raise exception 'L’offre Premium est indisponible pour le moment' using errcode = 'P0002';
  end if;

  insert into public.establishments (user_id, name, slug)
  values (v_user_id, v_name, v_slug)
  returning id into v_establishment_id;

  insert into public.establishment_staff (establishment_id, user_id, role, active)
  values (v_establishment_id, v_user_id, 'OWNER', true)
  on conflict do nothing;

  insert into public.subscriptions (
    establishment_id, plan_id, status, started_at, current_period_end, trial_days
  )
  values (
    v_establishment_id, v_plan_id, 'trial', v_started_at, v_period_end, 30
  );

  return jsonb_build_object(
    'success', true,
    'establishment_id', v_establishment_id,
    'plan_name', 'Premium',
    'status', 'trial',
    'trial_days', 30,
    'started_at', v_started_at,
    'current_period_end', v_period_end
  );
end;
$$;

revoke all on function public.create_establishment_with_premium_trial(text, text) from public;
revoke all on function public.create_establishment_with_premium_trial(text, text) from anon;
grant execute on function public.create_establishment_with_premium_trial(text, text) to authenticated;
