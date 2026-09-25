create table if not exists public.loyalty_card_design_drafts (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null unique references public.establishments(id) on delete cascade,
  template_id text not null default 'luxury',
  primary_color text not null default '#173D32',
  secondary_color text not null default '#D3A84C',
  background_color text not null default '#F7F7F3',
  text_color text not null default '#173D32',
  button_color text not null default '#173D32',
  border_radius integer not null default 24,
  design_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.loyalty_card_design_drafts enable row level security;

drop policy if exists loyalty_card_design_drafts_no_direct_access on public.loyalty_card_design_drafts;
create policy loyalty_card_design_drafts_no_direct_access
on public.loyalty_card_design_drafts
for all to authenticated
using (false)
with check (false);

create or replace function public.get_loyalty_card_builder_config(p_establishment_id uuid)
returns table(template_id text, primary_color text, secondary_color text, background_color text, text_color text, button_color text, border_radius integer, design_config jsonb, published boolean)
language plpgsql stable security definer set search_path = public
as $function$
begin
  if auth.uid() is null or not (public.is_tapmarrakech_admin() or public.user_has_establishment_access(p_establishment_id)) then
    raise exception 'Not authorized';
  end if;

  return query
  select d.template_id,d.primary_color,d.secondary_color,d.background_color,d.text_color,d.button_color,d.border_radius,coalesce(d.design_config,'{}'::jsonb),false
  from public.loyalty_card_design_drafts d
  where d.establishment_id=p_establishment_id
  limit 1;

  if found then return; end if;

  return query
  select d.template_id,d.primary_color,d.secondary_color,d.background_color,d.text_color,d.button_color,d.border_radius,coalesce(d.design_config,'{}'::jsonb),true
  from public.loyalty_card_designs d
  where d.establishment_id=p_establishment_id and d.published=true
  limit 1;

  if not found then
    return query select 'luxury','#173D32','#D3A84C','#F7F7F3','#173D32','#173D32',24,'{}'::jsonb,false;
  end if;
end;
$function$;

revoke all on function public.get_loyalty_card_builder_config(uuid) from public;
grant execute on function public.get_loyalty_card_builder_config(uuid) to authenticated;

create or replace function public.save_loyalty_card_builder_config(
  p_establishment_id uuid,p_design_config jsonb,p_template_id text,p_primary_color text,p_secondary_color text,
  p_background_color text,p_text_color text,p_button_color text,p_border_radius integer,p_published boolean
)
returns void language plpgsql security definer set search_path = public
as $function$
begin
  if auth.uid() is null or not (public.is_tapmarrakech_admin() or public.user_has_establishment_access(p_establishment_id)) then
    raise exception 'Not authorized';
  end if;
  if p_border_radius < 8 or p_border_radius > 40 then raise exception 'Rayon invalide'; end if;

  if p_published then
    insert into public.loyalty_card_designs(
      establishment_id,template_id,primary_color,secondary_color,background_color,text_color,button_color,
      border_radius,design_config,published,published_at,updated_at
    )
    values(
      p_establishment_id,p_template_id,p_primary_color,p_secondary_color,p_background_color,p_text_color,p_button_color,
      p_border_radius,coalesce(p_design_config,'{}'::jsonb),true,now(),now()
    )
    on conflict(establishment_id) do update set
      template_id=excluded.template_id,primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,
      background_color=excluded.background_color,text_color=excluded.text_color,button_color=excluded.button_color,
      border_radius=excluded.border_radius,design_config=excluded.design_config,published=true,published_at=now(),updated_at=now();

    delete from public.loyalty_card_design_drafts where establishment_id=p_establishment_id;
  else
    insert into public.loyalty_card_design_drafts(
      establishment_id,template_id,primary_color,secondary_color,background_color,text_color,button_color,
      border_radius,design_config,updated_at
    )
    values(
      p_establishment_id,p_template_id,p_primary_color,p_secondary_color,p_background_color,p_text_color,p_button_color,
      p_border_radius,coalesce(p_design_config,'{}'::jsonb),now()
    )
    on conflict(establishment_id) do update set
      template_id=excluded.template_id,primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,
      background_color=excluded.background_color,text_color=excluded.text_color,button_color=excluded.button_color,
      border_radius=excluded.border_radius,design_config=excluded.design_config,updated_at=now();
  end if;
end;
$function$;

revoke all on function public.save_loyalty_card_builder_config(uuid,jsonb,text,text,text,text,text,text,integer,boolean) from public;
grant execute on function public.save_loyalty_card_builder_config(uuid,jsonb,text,text,text,text,text,text,integer,boolean) to authenticated;

create or replace function public.get_employee_loyalty_card_config(p_session_token text)
returns table(template_id text, primary_color text, secondary_color text, background_color text, text_color text, button_color text, border_radius integer, design_config jsonb, published boolean)
language plpgsql stable security definer set search_path = public
as $function$
declare v_establishment_id uuid;
begin
  select s.establishment_id into v_establishment_id
  from public.employee_sessions s
  where s.token_hash=encode(digest(trim(p_session_token),'sha256'),'hex') and s.expires_at>now()
  limit 1;
  if v_establishment_id is null then return; end if;

  return query
  select d.template_id,d.primary_color,d.secondary_color,d.background_color,d.text_color,d.button_color,d.border_radius,coalesce(d.design_config,'{}'::jsonb),true
  from public.loyalty_card_designs d
  where d.establishment_id=v_establishment_id and d.published=true
  limit 1;

  if not found then
    return query select 'luxury','#173D32','#D3A84C','#F7F7F3','#173D32','#173D32',24,'{}'::jsonb,false;
  end if;
end;
$function$;

create or replace function public.get_public_loyalty_card_config(p_access_token uuid)
returns table(template_id text, primary_color text, secondary_color text, background_color text, text_color text, button_color text, border_radius integer, design_config jsonb, published boolean)
language sql stable security definer set search_path = public
as $function$
  select coalesce(d.template_id,'luxury'),coalesce(d.primary_color,'#173D32'),coalesce(d.secondary_color,'#D3A84C'),
         coalesce(d.background_color,'#F7F7F3'),coalesce(d.text_color,'#173D32'),coalesce(d.button_color,'#173D32'),
         coalesce(d.border_radius,24),coalesce(d.design_config,'{}'::jsonb),coalesce(d.published,false)
  from public.loyalty_customer_links l
  join public.loyalty_customers c on c.id=l.customer_id
  left join public.loyalty_card_designs d on d.establishment_id=c.establishment_id and d.published=true
  where l.access_token=p_access_token
  limit 1;
$function$;

revoke all on function public.get_public_loyalty_card_config(uuid) from public;
grant execute on function public.get_public_loyalty_card_config(uuid) to anon, authenticated;
