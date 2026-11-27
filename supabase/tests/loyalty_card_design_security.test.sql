begin;

select plan(7);

select ok(
  to_regclass('public.loyalty_card_design_drafts') is not null
  or position(
    'loyalty_card_design_drafts' in lower(pg_get_functiondef(
      'public.save_loyalty_card_builder_config(uuid,jsonb,text,text,text,text,text,text,integer,boolean)'::regprocedure
    ))
  ) = 0,
  'the save RPC never references a missing loyalty draft table'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'loyalty_card_designs'
      and column_name = 'published_at'
  )
  or (
    position('published_at' in lower(pg_get_functiondef(
      'public.save_loyalty_card_builder_config(uuid,jsonb,text,text,text,text,text,text,integer,boolean)'::regprocedure
    ))) = 0
    and position('published_at' in lower(pg_get_functiondef(
      'public.save_loyalty_card_design(uuid,text,text,text,text,text,text,integer,jsonb,boolean)'::regprocedure
    ))) = 0
  ),
  'card save RPCs do not reference a missing published_at column'
);

select ok(
  position(
    'd.published = true' in lower(pg_get_functiondef(
      'public.get_public_loyalty_card_config(uuid)'::regprocedure
    ))
  ) > 0,
  'legacy public card configuration only reads published designs'
);

select ok(
  position(
    'd.published = true' in lower(pg_get_functiondef(
      'public.get_public_loyalty_wallet_config(uuid)'::regprocedure
    ))
  ) > 0,
  'legacy public Wallet configuration only reads published designs'
);

select ok(
  position('#173d32' in lower(pg_get_functiondef(
    'public.get_public_loyalty_card_builder_config(uuid)'::regprocedure
  ))) = 0
  and position('#d3a84c' in lower(pg_get_functiondef(
    'public.get_public_loyalty_card_builder_config(uuid)'::regprocedure
  ))) = 0
  and position('#f7f7f3' in lower(pg_get_functiondef(
    'public.get_public_loyalty_card_builder_config(uuid)'::regprocedure
  ))) = 0,
  'public card builder SQL defaults no longer expose the legacy palette'
);

select ok(
  position('#173d32' in lower(pg_get_functiondef(
    'public.get_loyalty_card_builder_config(uuid)'::regprocedure
  ))) = 0
  and position('#d3a84c' in lower(pg_get_functiondef(
    'public.get_loyalty_card_builder_config(uuid)'::regprocedure
  ))) = 0
  and position('#f7f7f3' in lower(pg_get_functiondef(
    'public.get_loyalty_card_builder_config(uuid)'::regprocedure
  ))) = 0,
  'private card builder SQL defaults no longer expose the legacy palette'
);

select ok(
  (select column_default like '%#686D76%' from information_schema.columns
    where table_schema='public' and table_name='loyalty_card_designs' and column_name='primary_color')
  and (select column_default like '%#686D76%' from information_schema.columns
    where table_schema='public' and table_name='loyalty_card_designs' and column_name='secondary_color')
  and (select column_default like '%#050505%' from information_schema.columns
    where table_schema='public' and table_name='loyalty_card_designs' and column_name='background_color')
  and (select column_default like '%#686D76%' from information_schema.columns
    where table_schema='public' and table_name='loyalty_card_designs' and column_name='button_color'),
  'loyalty design table defaults use the Nardo palette'
);

select * from finish();
rollback;
