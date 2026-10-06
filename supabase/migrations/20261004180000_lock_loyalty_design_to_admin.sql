-- Commercial audit: loyalty card design is an admin-only capability.
-- Responsible users may manage loyalty program parameters, but must never be able
-- to publish or modify the loyalty card visual design through the RPC.
create or replace function public.save_loyalty_card_builder_config(
  p_establishment_id uuid,
  p_design_config jsonb,
  p_template_id text,
  p_primary_color text,
  p_secondary_color text,
  p_background_color text,
  p_text_color text,
  p_button_color text,
  p_border_radius integer,
  p_published boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not public.is_tapmarrakech_admin()
     or not public.user_has_establishment_access(p_establishment_id) then
    raise exception 'Not authorized';
  end if;

  if p_border_radius < 8 or p_border_radius > 40 then
    raise exception 'Rayon invalide';
  end if;

  if p_published then
    insert into public.loyalty_card_designs(
      establishment_id,template_id,primary_color,secondary_color,background_color,
      text_color,button_color,border_radius,design_config,published,published_at,updated_at
    )
    values(
      p_establishment_id,p_template_id,p_primary_color,p_secondary_color,p_background_color,
      p_text_color,p_button_color,p_border_radius,coalesce(p_design_config,'{}'::jsonb),true,now(),now()
    )
    on conflict(establishment_id) do update set
      template_id=excluded.template_id,
      primary_color=excluded.primary_color,
      secondary_color=excluded.secondary_color,
      background_color=excluded.background_color,
      text_color=excluded.text_color,
      button_color=excluded.button_color,
      border_radius=excluded.border_radius,
      design_config=excluded.design_config,
      published=true,
      published_at=now(),
      updated_at=now();

    delete from public.loyalty_card_design_drafts
    where establishment_id=p_establishment_id;
  else
    insert into public.loyalty_card_design_drafts(
      establishment_id,template_id,primary_color,secondary_color,background_color,
      text_color,button_color,border_radius,design_config,updated_at
    )
    values(
      p_establishment_id,p_template_id,p_primary_color,p_secondary_color,p_background_color,
      p_text_color,p_button_color,p_border_radius,coalesce(p_design_config,'{}'::jsonb),now()
    )
    on conflict(establishment_id) do update set
      template_id=excluded.template_id,
      primary_color=excluded.primary_color,
      secondary_color=excluded.secondary_color,
      background_color=excluded.background_color,
      text_color=excluded.text_color,
      button_color=excluded.button_color,
      border_radius=excluded.border_radius,
      design_config=excluded.design_config,
      updated_at=now();
  end if;
end;
$$;


-- Legacy design RPC must enforce the same admin-only rule.
create or replace function public.save_loyalty_card_design(
  p_establishment_id uuid,
  p_template_id text,
  p_primary_color text,
  p_secondary_color text,
  p_background_color text,
  p_text_color text,
  p_button_color text,
  p_border_radius integer,
  p_design_config jsonb default '{}'::jsonb,
  p_published boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not public.is_tapmarrakech_admin()
     or not public.user_has_establishment_access(p_establishment_id) then
    raise exception 'Not authorized';
  end if;

  if p_border_radius < 8 or p_border_radius > 40 then
    raise exception 'Rayon invalide';
  end if;

  insert into public.loyalty_card_designs(
    establishment_id,template_id,primary_color,secondary_color,background_color,
    text_color,button_color,border_radius,design_config,published,published_at,updated_at
  )
  values(
    p_establishment_id,p_template_id,p_primary_color,p_secondary_color,p_background_color,
    p_text_color,p_button_color,p_border_radius,coalesce(p_design_config,'{}'::jsonb),
    coalesce(p_published,false),
    case when p_published then now() else null end,
    now()
  )
  on conflict(establishment_id) do update set
    template_id=excluded.template_id,
    primary_color=excluded.primary_color,
    secondary_color=excluded.secondary_color,
    background_color=excluded.background_color,
    text_color=excluded.text_color,
    button_color=excluded.button_color,
    border_radius=excluded.border_radius,
    design_config=excluded.design_config,
    published=excluded.published,
    published_at=case when excluded.published then coalesce(public.loyalty_card_designs.published_at,now()) else null end,
    updated_at=now();
end;
$$;
