create or replace function public.get_responsible_loyalty_card_config(p_establishment_id uuid)
returns table(
  template_id text,
  primary_color text,
  secondary_color text,
  background_color text,
  text_color text,
  button_color text,
  border_radius integer,
  design_config jsonb,
  published boolean
)
language plpgsql stable security definer set search_path = public
as $function$
begin
  if auth.uid() is null
     or not public.user_has_establishment_access(p_establishment_id) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    d.template_id,
    d.primary_color,
    d.secondary_color,
    d.background_color,
    d.text_color,
    d.button_color,
    d.border_radius,
    coalesce(d.design_config, '{}'::jsonb),
    true
  from public.loyalty_card_designs d
  where d.establishment_id = p_establishment_id
    and d.published = true
  limit 1;

  if not found then
    return query
    select
      'luxury',
      '#173D32',
      '#D3A84C',
      '#F7F7F3',
      '#173D32',
      '#173D32',
      24,
      '{}'::jsonb,
      false;
  end if;
end;
$function$;

revoke all on function public.get_responsible_loyalty_card_config(uuid) from public;
grant execute on function public.get_responsible_loyalty_card_config(uuid) to authenticated;
