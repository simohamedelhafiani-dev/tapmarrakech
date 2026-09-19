-- AI-generated premium menu design stored per establishment.
alter table public.establishments
  add column if not exists menu_ai_design jsonb;

create index if not exists establishments_menu_ai_design_gin_idx
  on public.establishments using gin (menu_ai_design);

comment on column public.establishments.menu_ai_design is
  'Structured AI-generated premium menu presentation configuration.';
