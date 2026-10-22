-- Commercial hardening: loyalty management RPCs are not public APIs.
-- Keep authenticated execution; function bodies enforce admin/responsible authorization.
-- Apply each privilege restriction only if that exact overload exists in this schema.
do $$
declare
  v_signature text;
  v_signatures constant text[] := array[
    'public.save_loyalty_program_settings(uuid,text,integer,text,text,numeric,integer,numeric,text,boolean,integer)',
    'public.create_loyalty_reward(uuid,text,text,integer,text,numeric,numeric)',
    'public.update_loyalty_reward(uuid,text,text,integer,text,numeric,numeric,boolean)',
    'public.delete_loyalty_reward(uuid)',
    'public.update_loyalty_reward_schedule(uuid,text[])'
  ];
begin
  foreach v_signature in array v_signatures loop
    if to_regprocedure(v_signature) is not null then
      execute format('revoke execute on function %s from anon, public', to_regprocedure(v_signature));
    end if;
  end loop;
end;
$$;
