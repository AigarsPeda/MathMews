-- Transaction-only accounts; verifies real RPC payouts without touching players.
begin;
set local plpgsql.check_asserts=on;
create temp table timed_reward_cases on commit drop as
 select gen_random_uuid() as user_id,t.level_id,t.puzzle_ids[1] as first_id,
   sum(c.first_reward)*2 as first_reward,sum(c.replay_reward)*2 as replay_reward,
   min(c.replay_reward) as ordinary_replay
 from wallet_private.timed_challenge_catalog t
 join wallet_private.puzzle_catalog c on c.puzzle_id=any(t.puzzle_ids)
 group by t.level_id,t.puzzle_ids;
insert into auth.users(id) select user_id from timed_reward_cases;
grant select on timed_reward_cases to authenticated;
set local role authenticated;
do $$
declare p record; env text; w public.coin_wallets; expected bigint; i integer;
begin
 foreach env in array array['sandbox','production'] loop
  for p in select * from timed_reward_cases loop
   perform set_config('request.jwt.claim.sub',p.user_id::text,true);
   w:=public.claim_timed_challenge_coins(env,p.level_id,'timed-first');
   assert w.balance=p.first_reward,'Timed first clear must pay double for the entire scope';
   w:=public.claim_timed_challenge_coins(env,p.level_id,'timed-first');
   assert w.balance=p.first_reward,'Retrying a delivery must not duplicate coins';
   w:=public.claim_timed_challenge_coins(env,p.level_id,'timed-replay');
   expected:=p.first_reward+p.replay_reward;
   assert w.balance=expected,'Timed replay uses double replay rates for every puzzle';
   w:=public.claim_puzzle_coins(env,p.first_id,'ordinary-after-timed');
   assert w.balance=expected+p.ordinary_replay,'Timed payout records ordinary first clears too';
   begin
    perform public.claim_timed_challenge_coins(env,'unknown-level','unknown');
    raise exception 'Unknown scope was accepted';
   exception when raise_exception then
    if sqlerrm<>'Unknown timed level' then raise; end if;
   end;
   begin
    perform public.claim_puzzle_coins(env,p.first_id,'timed-first');
    raise exception 'A timed claim ID was reused for an ordinary claim';
   exception when raise_exception then
    if sqlerrm<>'Attempt already used' then raise; end if;
   end;
  end loop;
 end loop;
 select * into p from timed_reward_cases limit 1;
 perform set_config('request.jwt.claim.sub',p.user_id::text,true);
 for i in 1..100 loop
  w:=public.claim_timed_challenge_coins('sandbox',p.level_id,'cap-'||i);
  assert w.balance<=1000,'Timed and ordinary rewards share the existing daily cap';
 end loop;
 assert w.balance=1000,'The daily cap is applied to the combined credit';
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.claim_timed_challenge_coins('sandbox',p.level_id,'unauthenticated');
  raise exception 'Unauthenticated claim was accepted';
 exception when insufficient_privilege then null;
 end;
end; $$;
reset role;
rollback;
