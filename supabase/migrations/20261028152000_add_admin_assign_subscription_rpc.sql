-- Admin-only RPC used by the billing screen to assign or update an establishment plan.
create or replace function public.assign_subscription_to_establishment(
  p_establishment_id uuid,
  p_plan_id uuid,
  p_status text,
  p_trial_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_plan_name text;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Accès réservé à un administrateur' using errcode = '42501';
  end if;

  if p_status not in ('trial', 'active', 'past_due', 'unpaid', 'canceled') then
    raise exception 'Statut d’abonnement invalide' using errcode = '22023';
  end if;

  if p_trial_days is null or p_trial_days < 0 or p_trial_days > 365 then
    raise exception 'La durée d’essai doit être comprise entre 0 et 365 jours' using errcode = '22023';
  end if;

  if not exists (select 1 from public.establishments e where e.id = p_establishment_id) then
    raise exception 'Établissement introuvable' using errcode = 'P0002';
  end if;

  select sp.name into v_plan_name
  from public.subscription_plans sp
  where sp.id = p_plan_id and sp.active = true;

  if v_plan_name is null then
    raise exception 'Pack introuvable ou inactif' using errcode = 'P0002';
  end if;

  insert into public.subscriptions (
    establishment_id, plan_id, status, started_at, trial_days,
    current_period_end, canceled_at, updated_at
  )
  values (
    p_establishment_id, p_plan_id, p_status, now(), p_trial_days,
    case when p_status = 'trial' and p_trial_days > 0
      then now() + make_interval(days => p_trial_days) else null end,
    case when p_status = 'canceled' then now() else null end,
    now()
  )
  on conflict (establishment_id) do update set
    plan_id = excluded.plan_id,
    status = excluded.status,
    started_at = now(),
    trial_days = excluded.trial_days,
    current_period_end = excluded.current_period_end,
    canceled_at = excluded.canceled_at,
    updated_at = now()
  returning * into v_subscription;

  return jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription.id,
    'establishment_id', v_subscription.establishment_id,
    'plan_id', v_subscription.plan_id,
    'plan_name', v_plan_name,
    'status', v_subscription.status,
    'trial_days', v_subscription.trial_days,
    'current_period_end', v_subscription.current_period_end
  );
end;
$$;

revoke all on function public.assign_subscription_to_establishment(uuid, uuid, text, integer) from public, anon;
grant execute on function public.assign_subscription_to_establishment(uuid, uuid, text, integer) to authenticated;

notify pgrst, 'reload schema';
