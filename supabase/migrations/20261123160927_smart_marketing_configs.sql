-- Smart Marketing Center settings. Safe, tenant-scoped configuration only.
create table if not exists public.smart_marketing_configs (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  smart_id text not null check (smart_id in ('winback','nearby','birthday','reward','vip','progress','happyhour','challenge','referral','comeback')),
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, smart_id)
);
create index if not exists smart_marketing_configs_establishment_idx on public.smart_marketing_configs(establishment_id);
create or replace function public.smart_marketing_configs_set_updated_at()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  if tg_op = 'INSERT' then new.created_at = now(); else new.created_at = old.created_at; end if;
  return new;
end;
$$;
drop trigger if exists smart_marketing_configs_updated_at on public.smart_marketing_configs;
create trigger smart_marketing_configs_updated_at before insert or update on public.smart_marketing_configs for each row execute function public.smart_marketing_configs_set_updated_at();
alter table public.smart_marketing_configs enable row level security;
drop policy if exists smart_marketing_configs_read_access on public.smart_marketing_configs;
create policy smart_marketing_configs_read_access on public.smart_marketing_configs for select to authenticated using (public.user_has_establishment_access(establishment_id));
drop policy if exists smart_marketing_configs_insert_manager on public.smart_marketing_configs;
create policy smart_marketing_configs_insert_manager on public.smart_marketing_configs for insert to authenticated with check (public.is_tapmarrakech_admin() or public.is_establishment_responsible(establishment_id) or public.user_owns_establishment(establishment_id));
drop policy if exists smart_marketing_configs_update_manager on public.smart_marketing_configs;
create policy smart_marketing_configs_update_manager on public.smart_marketing_configs for update to authenticated using (public.is_tapmarrakech_admin() or public.is_establishment_responsible(establishment_id) or public.user_owns_establishment(establishment_id)) with check (public.is_tapmarrakech_admin() or public.is_establishment_responsible(establishment_id) or public.user_owns_establishment(establishment_id));
drop policy if exists smart_marketing_configs_delete_manager on public.smart_marketing_configs;
create policy smart_marketing_configs_delete_manager on public.smart_marketing_configs for delete to authenticated using (public.is_tapmarrakech_admin() or public.is_establishment_responsible(establishment_id) or public.user_owns_establishment(establishment_id));
grant select, insert, update, delete on public.smart_marketing_configs to authenticated;
