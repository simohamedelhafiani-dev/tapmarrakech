-- Restore the discount-card table that exists in production but was absent from the
-- versioned migration history. Balances are mutated only through audited SECURITY DEFINER RPCs.
create table if not exists public.loyalty_discount_cards (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  customer_id uuid not null references public.loyalty_customers(id) on delete cascade,
  discount_percent numeric not null check (discount_percent > 0 and discount_percent <= 100),
  valid_from timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'USED', 'EXPIRED', 'CANCELLED')),
  qr_token uuid not null unique default gen_random_uuid(),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists loyalty_discount_cards_customer_idx
  on public.loyalty_discount_cards(customer_id, created_at desc);

alter table public.loyalty_discount_cards enable row level security;
drop policy if exists loyalty_discount_cards_select on public.loyalty_discount_cards;
create policy loyalty_discount_cards_select on public.loyalty_discount_cards
  for select to authenticated
  using (public.user_has_establishment_access(establishment_id));

revoke all on public.loyalty_discount_cards from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on public.loyalty_discount_cards from authenticated;
grant select on public.loyalty_discount_cards to authenticated;
grant all on public.loyalty_discount_cards to service_role;
