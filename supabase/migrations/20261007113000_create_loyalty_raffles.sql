create table if not exists public.loyalty_raffles (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  title text not null, description text, prize_name text not null, prize_description text,
  starts_at timestamptz not null default now(), draw_at timestamptz not null,
  winners_count integer not null default 1 check (winners_count between 1 and 100),
  participation_mode text not null default 'ALL_ENROLLED' check (participation_mode in ('ALL_ENROLLED')),
  reward_validity_mode text not null default 'DATE_RANGE' check (reward_validity_mode in ('ONE_DAY','DATE_RANGE','DAYS_AFTER_DRAW')),
  reward_valid_from timestamptz, reward_valid_until timestamptz, reward_valid_days integer,
  reservation_required boolean not null default false, single_use boolean not null default true,
  non_cumulative boolean not null default true,
  status text not null default 'SCHEDULED' check (status in ('DRAFT','SCHEDULED','DRAWN','CANCELLED')),
  drawn_at timestamptz, created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint loyalty_raffles_draw_after_start check (draw_at > starts_at),
  constraint loyalty_raffles_validity_dates check (
    (reward_validity_mode='ONE_DAY' and reward_valid_from is not null and reward_valid_until is not null and reward_valid_until >= reward_valid_from)
    or (reward_validity_mode='DATE_RANGE' and reward_valid_from is not null and reward_valid_until is not null and reward_valid_until > reward_valid_from)
    or (reward_validity_mode='DAYS_AFTER_DRAW' and reward_valid_days between 1 and 365)
  )
);

create table if not exists public.loyalty_raffle_entries (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references public.loyalty_raffles(id) on delete cascade,
  customer_id uuid not null references public.loyalty_customers(id) on delete cascade,
  tickets integer not null default 1 check (tickets > 0),
  created_at timestamptz not null default now(),
  unique (raffle_id, customer_id)
);

create table if not exists public.loyalty_raffle_winners (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references public.loyalty_raffles(id) on delete cascade,
  customer_id uuid not null references public.loyalty_customers(id) on delete cascade,
  rank integer not null check (rank > 0), claim_token uuid not null default gen_random_uuid() unique,
  prize_name text not null, prize_description text, valid_from timestamptz not null, valid_until timestamptz not null,
  reservation_required boolean not null default false, single_use boolean not null default true, non_cumulative boolean not null default true,
  status text not null default 'PENDING' check (status in ('PENDING','REDEEMED','EXPIRED')),
  redeemed_at timestamptz, redeemed_by uuid, created_at timestamptz not null default now(),
  unique (raffle_id, customer_id)
);

create index if not exists loyalty_raffles_establishment_status_idx on public.loyalty_raffles(establishment_id,status,draw_at);
create index if not exists loyalty_raffle_entries_raffle_idx on public.loyalty_raffle_entries(raffle_id);
create index if not exists loyalty_raffle_winners_customer_idx on public.loyalty_raffle_winners(customer_id,status,valid_until);

alter table public.loyalty_raffles enable row level security;
alter table public.loyalty_raffle_entries enable row level security;
alter table public.loyalty_raffle_winners enable row level security;

drop policy if exists loyalty_raffles_select_access on public.loyalty_raffles;
create policy loyalty_raffles_select_access on public.loyalty_raffles for select to authenticated using (public.user_has_establishment_access(establishment_id));
drop policy if exists loyalty_raffles_write_manager on public.loyalty_raffles;
create policy loyalty_raffles_write_manager on public.loyalty_raffles for all to authenticated
using (public.is_tapmarrakech_admin() or public.is_establishment_responsible(establishment_id))
with check (public.is_tapmarrakech_admin() or public.is_establishment_responsible(establishment_id));

drop policy if exists loyalty_raffle_entries_access on public.loyalty_raffle_entries;
create policy loyalty_raffle_entries_access on public.loyalty_raffle_entries for select to authenticated
using (exists(select 1 from public.loyalty_raffles r where r.id=raffle_id and public.user_has_establishment_access(r.establishment_id)));

drop policy if exists loyalty_raffle_winners_access on public.loyalty_raffle_winners;
create policy loyalty_raffle_winners_access on public.loyalty_raffle_winners for select to authenticated
using (exists(select 1 from public.loyalty_raffles r where r.id=raffle_id and public.user_has_establishment_access(r.establishment_id)));

create or replace function public.get_loyalty_raffles(p_establishment_id uuid)
returns table(id uuid,title text,description text,prize_name text,prize_description text,starts_at timestamptz,draw_at timestamptz,winners_count integer,participation_mode text,reward_validity_mode text,reward_valid_from timestamptz,reward_valid_until timestamptz,reward_valid_days integer,reservation_required boolean,single_use boolean,non_cumulative boolean,status text,drawn_at timestamptz,participant_count bigint,winner_count bigint)
language sql stable security definer set search_path=public as $$
select r.id,r.title,r.description,r.prize_name,r.prize_description,r.starts_at,r.draw_at,r.winners_count,r.participation_mode,r.reward_validity_mode,r.reward_valid_from,r.reward_valid_until,r.reward_valid_days,r.reservation_required,r.single_use,r.non_cumulative,r.status,r.drawn_at,
(select count(*) from public.loyalty_raffle_entries e where e.raffle_id=r.id),(select count(*) from public.loyalty_raffle_winners w where w.raffle_id=r.id)
from public.loyalty_raffles r where r.establishment_id=p_establishment_id and public.user_has_establishment_access(p_establishment_id) order by r.draw_at desc;
$$;

create or replace function public.create_loyalty_raffle(p_establishment_id uuid,p_title text,p_description text,p_prize_name text,p_prize_description text,p_starts_at timestamptz,p_draw_at timestamptz,p_winners_count integer,p_reward_validity_mode text,p_reward_valid_from timestamptz,p_reward_valid_until timestamptz,p_reward_valid_days integer,p_reservation_required boolean,p_single_use boolean,p_non_cumulative boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
if not(public.is_tapmarrakech_admin() or public.is_establishment_responsible(p_establishment_id)) then raise exception 'not_authorized'; end if;
insert into public.loyalty_raffles(establishment_id,title,description,prize_name,prize_description,starts_at,draw_at,winners_count,reward_validity_mode,reward_valid_from,reward_valid_until,reward_valid_days,reservation_required,single_use,non_cumulative,status,created_by)
values(p_establishment_id,trim(p_title),nullif(trim(coalesce(p_description,'')),''),trim(p_prize_name),nullif(trim(coalesce(p_prize_description,'')),''),p_starts_at,p_draw_at,p_winners_count,p_reward_validity_mode,p_reward_valid_from,p_reward_valid_until,p_reward_valid_days,p_reservation_required,p_single_use,p_non_cumulative,'SCHEDULED',auth.uid()) returning id into v_id;
return v_id;
end; $$;

create or replace function public.cancel_loyalty_raffle(p_raffle_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_est uuid;
begin
select establishment_id into v_est from public.loyalty_raffles where id=p_raffle_id;
if v_est is null or not(public.is_tapmarrakech_admin() or public.is_establishment_responsible(v_est)) then raise exception 'not_authorized'; end if;
update public.loyalty_raffles set status='CANCELLED',updated_at=now() where id=p_raffle_id and status='SCHEDULED';
end; $$;

create or replace function public.process_due_loyalty_raffles()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; vf timestamptz; vu timestamptz; n integer:=0;
begin
for r in select * from public.loyalty_raffles where status='SCHEDULED' and draw_at<=now() order by draw_at for update skip locked loop
insert into public.loyalty_raffle_entries(raffle_id,customer_id,tickets)
select r.id,c.id,1 from public.loyalty_customers c where c.establishment_id=r.establishment_id and c.created_at<=r.draw_at on conflict(raffle_id,customer_id) do nothing;
if r.reward_validity_mode='DAYS_AFTER_DRAW' then vf:=r.draw_at; vu:=r.draw_at+make_interval(days=>r.reward_valid_days); else vf:=r.reward_valid_from; vu:=r.reward_valid_until; end if;
insert into public.loyalty_raffle_winners(raffle_id,customer_id,rank,prize_name,prize_description,valid_from,valid_until,reservation_required,single_use,non_cumulative)
select r.id,e.customer_id,row_number() over(order by random()),r.prize_name,r.prize_description,vf,vu,r.reservation_required,r.single_use,r.non_cumulative
from public.loyalty_raffle_entries e where e.raffle_id=r.id order by random() limit r.winners_count on conflict(raffle_id,customer_id) do nothing;
insert into public.loyalty_card_notifications(establishment_id,customer_id,title,message,type,expires_at)
select r.establishment_id,w.customer_id,'🎉 Félicitations, vous avez gagné !','Vous avez gagné « '||w.prize_name||' ». Votre récompense est valable du '||to_char(w.valid_from,'DD/MM/YYYY')||' au '||to_char(w.valid_until,'DD/MM/YYYY')||case when w.reservation_required then '. Réservation obligatoire.' else '.' end,'REWARD',w.valid_until from public.loyalty_raffle_winners w where w.raffle_id=r.id;
update public.loyalty_raffle_winners set status='EXPIRED' where raffle_id=r.id and valid_until<now();
update public.loyalty_raffles set status='DRAWN',drawn_at=now(),updated_at=now() where id=r.id;
n:=n+1;
end loop; return n;
end; $$;

create or replace function public.get_public_loyalty_raffle_winners(p_access_token uuid)
returns table(id uuid,raffle_id uuid,title text,prize_name text,prize_description text,valid_from timestamptz,valid_until timestamptz,reservation_required boolean,single_use boolean,non_cumulative boolean,status text,claim_token uuid,drawn_at timestamptz)
language sql stable security definer set search_path=public as $$
select w.id,w.raffle_id,r.title,w.prize_name,w.prize_description,w.valid_from,w.valid_until,w.reservation_required,w.single_use,w.non_cumulative,w.status,w.claim_token,r.drawn_at
from public.loyalty_raffle_winners w join public.loyalty_raffles r on r.id=w.raffle_id join public.loyalty_customer_links l on l.customer_id=w.customer_id
where l.access_token=p_access_token and (w.status='PENDING' or w.redeemed_at is not null) order by w.created_at desc;
$$;

create or replace function public.redeem_loyalty_raffle_winner(p_winner_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_est uuid; v_until timestamptz; v_status text;
begin
select r.establishment_id,w.valid_until,w.status into v_est,v_until,v_status from public.loyalty_raffle_winners w join public.loyalty_raffles r on r.id=w.raffle_id where w.id=p_winner_id for update;
if v_est is null or not(public.is_tapmarrakech_admin() or public.is_establishment_responsible(v_est)) then raise exception 'not_authorized'; end if;
if v_status<>'PENDING' then raise exception 'reward_not_pending'; end if;
if v_until<now() then update public.loyalty_raffle_winners set status='EXPIRED' where id=p_winner_id; raise exception 'reward_expired'; end if;
update public.loyalty_raffle_winners set status='REDEEMED',redeemed_at=now(),redeemed_by=auth.uid() where id=p_winner_id;
end; $$;

revoke all on function public.process_due_loyalty_raffles() from public;
grant execute on function public.process_due_loyalty_raffles() to postgres;


revoke all on function public.get_loyalty_raffles(uuid) from public;
grant execute on function public.get_loyalty_raffles(uuid) to authenticated;
revoke all on function public.create_loyalty_raffle(uuid,text,text,text,text,timestamptz,timestamptz,integer,text,timestamptz,timestamptz,integer,boolean,boolean,boolean) from public;
grant execute on function public.create_loyalty_raffle(uuid,text,text,text,text,timestamptz,timestamptz,integer,text,timestamptz,timestamptz,integer,boolean,boolean,boolean) to authenticated;
revoke all on function public.cancel_loyalty_raffle(uuid) from public;
grant execute on function public.cancel_loyalty_raffle(uuid) to authenticated;
revoke all on function public.redeem_loyalty_raffle_winner(uuid) from public;
grant execute on function public.redeem_loyalty_raffle_winner(uuid) to authenticated;
grant execute on function public.get_public_loyalty_raffle_winners(uuid) to anon, authenticated;
