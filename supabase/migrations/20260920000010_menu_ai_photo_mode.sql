alter table public.establishments
  add column if not exists menu_ai_photo_mode text not null default 'with_photos';

alter table public.establishments
  drop constraint if exists establishments_menu_ai_photo_mode_check;

alter table public.establishments
  add constraint establishments_menu_ai_photo_mode_check
  check (menu_ai_photo_mode in ('with_photos', 'without_photos'));

comment on column public.establishments.menu_ai_photo_mode is
  'Controls whether the AI premium menu displays product photos.';
