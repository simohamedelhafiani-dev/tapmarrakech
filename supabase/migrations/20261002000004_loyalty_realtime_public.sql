-- Enable Supabase Realtime for public loyalty publication tables.
alter publication supabase_realtime add table public.loyalty_card_designs;
alter publication supabase_realtime add table public.loyalty_settings;

-- Realtime postgres_changes evaluates the row through RLS. The public card already
-- receives these values through SECURITY DEFINER RPCs, so expose only published
-- design rows to anonymous readers; write access remains unchanged.
alter table public.loyalty_card_designs enable row level security;

drop policy if exists loyalty_card_designs_public_published_select on public.loyalty_card_designs;

create policy loyalty_card_designs_public_published_select
on public.loyalty_card_designs
for select
to anon, authenticated
using (
  published = true
  and exists (
    select 1
    from public.establishments e
    where e.id = loyalty_card_designs.establishment_id
  )
);