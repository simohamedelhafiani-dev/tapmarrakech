-- Google Business reviews must only be attributed after an explicit per-location mapping.
alter table public.google_business_locations
  add column if not exists mapped_establishment_id uuid null
  references public.establishments(id) on delete set null;

create index if not exists google_business_locations_mapped_establishment_idx
  on public.google_business_locations(mapped_establishment_id);

comment on column public.google_business_locations.mapped_establishment_id is
  'Kelyani establishment explicitly matched to this Google Business Profile location. NULL means unassigned; reviews must not be attributed to any establishment.';
