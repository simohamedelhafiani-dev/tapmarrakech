-- Wallet design catalogue: drafts are private to the establishment; only published, provider-ready designs are returned to customers.
create table if not exists public.loyalty_wallet_design_catalog (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  design_key text not null,
  display_name text not null,
  design_config jsonb not null default '{}'::jsonb,
  publication_status text not null default 'draft'
    check (publication_status in ('draft','pending_validation','published','error','archived')),
  google_class_id text,
  google_review_status text,
  apple_pass_type_id text,
  apple_ready boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, design_key)
);

create index if not exists loyalty_wallet_design_catalog_customer_idx
  on public.loyalty_wallet_design_catalog (establishment_id, publication_status);

alter table public.loyalty_wallet_design_catalog enable row level security;

drop policy if exists wallet_design_catalog_owner_manage on public.loyalty_wallet_design_catalog;
create policy wallet_design_catalog_owner_manage
on public.loyalty_wallet_design_catalog
for all to authenticated
using (public.is_tapmarrakech_admin() or public.user_owns_establishment(establishment_id))
with check (public.is_tapmarrakech_admin() or public.user_owns_establishment(establishment_id));

drop policy if exists wallet_design_catalog_staff_read on public.loyalty_wallet_design_catalog;
create policy wallet_design_catalog_staff_read
on public.loyalty_wallet_design_catalog
for select to authenticated
using (
  public.is_tapmarrakech_admin()
  or public.user_owns_establishment(establishment_id)
  or exists (
    select 1 from public.establishment_staff es
    where es.establishment_id = loyalty_wallet_design_catalog.establishment_id
      and es.user_id = auth.uid() and es.active = true
  )
);

revoke all on public.loyalty_wallet_design_catalog from anon;
grant select, insert, update, delete on public.loyalty_wallet_design_catalog to authenticated;

create or replace function public.get_public_loyalty_wallet_designs(p_access_token uuid)
returns table (
  id uuid, design_key text, display_name text, design_config jsonb,
  google_class_id text, google_review_status text, apple_ready boolean
)
language sql stable security definer set search_path = ''
as $function$
  select d.id, d.design_key, d.display_name, d.design_config,
         d.google_class_id, d.google_review_status, d.apple_ready
  from public.loyalty_customer_links l
  join public.loyalty_customers c on c.id = l.customer_id
  join public.loyalty_wallet_design_catalog d on d.establishment_id = c.establishment_id
  where l.access_token = p_access_token
    and d.publication_status = 'published'
    and ((d.google_class_id is not null and upper(coalesce(d.google_review_status,'')) = 'APPROVED') or d.apple_ready = true)
  order by d.published_at desc nulls last, d.created_at;
$function$;

revoke all on function public.get_public_loyalty_wallet_designs(uuid) from public;
grant execute on function public.get_public_loyalty_wallet_designs(uuid) to anon, authenticated;

create or replace function public.get_public_loyalty_wallet_design(p_access_token uuid, p_design_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $function$
  select jsonb_build_object(
    'id', d.id, 'design_key', d.design_key, 'display_name', d.display_name,
    'design_config', d.design_config, 'googleClassId', d.google_class_id,
    'googleClassStatus', d.google_review_status, 'appleReady', d.apple_ready
  )
  from public.loyalty_customer_links l
  join public.loyalty_customers c on c.id = l.customer_id
  join public.loyalty_wallet_design_catalog d on d.establishment_id = c.establishment_id
  where l.access_token = p_access_token and d.id = p_design_id
    and d.publication_status = 'published'
    and ((d.google_class_id is not null and upper(coalesce(d.google_review_status,'')) = 'APPROVED') or d.apple_ready = true)
  limit 1;
$function$;

revoke all on function public.get_public_loyalty_wallet_design(uuid, uuid) from public;
grant execute on function public.get_public_loyalty_wallet_design(uuid, uuid) to anon, authenticated;
