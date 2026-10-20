-- Add the settings consumed by the automatic reply webhook and admin UI.
-- Enabling auto-reply starts a fresh cutoff so historical reviews are not published retroactively.
alter table public.google_business_settings
  add column if not exists auto_reply_min_rating integer not null default 4,
  add column if not exists auto_reply_activated_at timestamptz;

alter table public.google_business_settings
  drop constraint if exists google_business_settings_auto_reply_min_rating_check;

alter table public.google_business_settings
  add constraint google_business_settings_auto_reply_min_rating_check
  check (auto_reply_min_rating between 1 and 5);

-- Existing enabled configurations start from the migration time, not from their historical update timestamp.
update public.google_business_settings
set auto_reply_activated_at = now()
where auto_reply_enabled = true
  and auto_reply_activated_at is null;

update public.google_business_settings
set auto_reply_activated_at = null
where auto_reply_enabled = false
  and auto_reply_activated_at is not null;

create or replace function public.set_google_business_auto_reply_activation_cutoff()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.auto_reply_enabled then
    if tg_op = 'INSERT' then
      new.auto_reply_activated_at := coalesce(new.auto_reply_activated_at, now());
    elsif old.auto_reply_enabled is distinct from true then
      new.auto_reply_activated_at := now();
    else
      new.auto_reply_activated_at := coalesce(new.auto_reply_activated_at, now());
    end if;
  else
    new.auto_reply_activated_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_google_business_auto_reply_activation_cutoff
  on public.google_business_settings;

create trigger trg_google_business_auto_reply_activation_cutoff
before insert or update
on public.google_business_settings
for each row
execute function public.set_google_business_auto_reply_activation_cutoff();
