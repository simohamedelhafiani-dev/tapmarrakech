create or replace function public.save_loyalty_referral_draft(
  p_establishment_id uuid,
  p_config jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_enabled boolean;
  v_referrer_type text;
  v_referee_type text;
  v_referrer_value numeric;
  v_referee_value numeric;
  v_max_referrals integer;
  v_normalized_config jsonb;
begin
  if not public.user_has_establishment_access(p_establishment_id) then
    raise exception 'Accès refusé';
  end if;

  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'Configuration de parrainage invalide';
  end if;

  v_enabled := coalesce((p_config ->> 'enabled')::boolean, false);
  v_referrer_type := upper(coalesce(nullif(p_config ->> 'referrer_bonus_type', ''), 'POINTS'));
  v_referee_type := upper(coalesce(nullif(p_config ->> 'referee_bonus_type', ''), 'POINTS'));
  v_referrer_value := greatest(coalesce((p_config ->> 'referrer_bonus_value')::numeric, (p_config ->> 'referrer_bonus_points')::numeric, 0), 0);
  v_referee_value := greatest(coalesce((p_config ->> 'referee_bonus_value')::numeric, (p_config ->> 'referee_bonus_points')::numeric, 0), 0);

  if v_referrer_type not in ('POINTS','STAMP','REDUCTION') or v_referee_type not in ('POINTS','STAMP','REDUCTION') then
    raise exception 'Type de bonus de parrainage invalide';
  end if;
  if v_referrer_value > 1000000 or v_referee_value > 1000000 then
    raise exception 'Valeur de bonus trop élevée';
  end if;
  if v_enabled and v_referrer_value <= 0 then
    raise exception 'Le bonus du parrain doit être supérieur à 0';
  end if;
  if v_referee_value < 0 then
    raise exception 'Le bonus du filleul est invalide';
  end if;
  if v_referrer_type in ('POINTS','STAMP') and v_referrer_value <> trunc(v_referrer_value) then
    raise exception 'La valeur du bonus du parrain doit être un entier';
  end if;
  if v_referee_type in ('POINTS','STAMP') and v_referee_value <> trunc(v_referee_value) then
    raise exception 'La valeur du bonus du filleul doit être un entier';
  end if;
  if v_referrer_type = 'REDUCTION' and (v_referrer_value <= 0 or v_referrer_value > 100) then
    raise exception 'La réduction du parrain doit être comprise entre 1 et 100 %%';
  end if;
  if v_referee_type = 'REDUCTION' and (v_referee_value < 0 or v_referee_value > 100) then
    raise exception 'La réduction du filleul doit être comprise entre 0 et 100 %%';
  end if;

  if p_config ? 'max_referrals' and p_config ->> 'max_referrals' is not null then
    v_max_referrals := (p_config ->> 'max_referrals')::integer;
    if v_max_referrals < 0 or v_max_referrals > 1000000 then
      raise exception 'La limite de parrainages est invalide';
    end if;
  else
    v_max_referrals := null;
  end if;

  v_normalized_config := jsonb_build_object(
    'enabled', v_enabled,
    'referrer_bonus_type', v_referrer_type,
    'referrer_bonus_value', v_referrer_value,
    'referee_bonus_type', v_referee_type,
    'referee_bonus_value', v_referee_value,
    'max_referrals', v_max_referrals,
    'referrer_bonus_points', case when v_referrer_type = 'POINTS' then v_referrer_value::integer else 0 end,
    'referee_bonus_points', case when v_referee_type = 'POINTS' then v_referee_value::integer else 0 end
  );

  update public.loyalty_settings
  set referral_draft_config = v_normalized_config,
      updated_at = now()
  where establishment_id = p_establishment_id;

  if not found then
    insert into public.loyalty_settings (establishment_id, program_type, referral_draft_config)
    values (p_establishment_id, 'POINTS_REWARD', v_normalized_config);
  end if;
end;
$function$;