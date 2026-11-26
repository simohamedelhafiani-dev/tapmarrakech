begin;

select plan(5);

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

select * from finish();
rollback;
