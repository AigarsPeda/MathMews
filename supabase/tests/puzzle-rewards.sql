-- Hosted rollback acceptance: every boss stage in sandbox and production.
-- Creates one transaction-only account per difficulty; no existing player is changed.
-- Keep the 1000-coin daily limit intact while testing all first clears and replays.
begin;
set local plpgsql.check_asserts=on;
select set_config('puzzle_reward_test.users',jsonb_build_object('easy',gen_random_uuid(),'medium',gen_random_uuid(),'hard',gen_random_uuid())::text,true);
insert into auth.users(id,is_anonymous,aud,role)
 select value::uuid,true,'authenticated','authenticated' from jsonb_each_text(current_setting('puzzle_reward_test.users')::jsonb);
set local role authenticated;
do $$
declare env text; p record; w public.coin_wallets; balance_before bigint; first_balance bigint; replay_balance bigint; attempt text; checked integer:=0;
begin
 foreach env in array array['sandbox','production'] loop
  for p in select * from (values
('v2-easy-addition-picnic-1',8,4),
('v2-easy-addition-picnic-2',8,4),
('v2-easy-addition-picnic-3',8,4),
('v2-easy-multiplication-shelves-1',8,4),
('v2-easy-multiplication-shelves-2',8,4),
('v2-easy-multiplication-shelves-3',8,4),
('v2-easy-numbers-train-1',8,4),
('v2-easy-numbers-train-2',8,4),
('v2-easy-numbers-train-3',8,4),
('v2-easy-subtraction-boats-1',8,4),
('v2-easy-subtraction-boats-2',8,4),
('v2-easy-subtraction-boats-3',8,4),
('v2-easy-patterns-music-1',8,4),
('v2-easy-patterns-music-2',8,4),
('v2-easy-patterns-music-3',8,4),
('v2-easy-fractions-kite-1',8,4),
('v2-easy-fractions-kite-2',8,4),
('v2-easy-fractions-kite-3',8,4),
('v2-medium-division-parcels-1',14,6),
('v2-medium-division-parcels-2',14,6),
('v2-medium-division-parcels-3',14,6),
('v2-medium-operations-lanterns-1',14,6),
('v2-medium-operations-lanterns-2',14,6),
('v2-medium-operations-lanterns-3',14,6),
('v2-medium-addition-tickets-1',14,6),
('v2-medium-addition-tickets-2',14,6),
('v2-medium-addition-tickets-3',14,6),
('v2-medium-subtraction-lift-1',14,6),
('v2-medium-subtraction-lift-2',14,6),
('v2-medium-subtraction-lift-3',14,6),
('v2-medium-multiplication-theatre-1',14,6),
('v2-medium-multiplication-theatre-2',14,6),
('v2-medium-multiplication-theatre-3',14,6),
('v2-medium-fractions-fountain-1',14,6),
('v2-medium-fractions-fountain-2',14,6),
('v2-medium-fractions-fountain-3',14,6),
('v2-hard-fractions-garden-1',18,8),
('v2-hard-fractions-garden-2',18,8),
('v2-hard-fractions-garden-3',18,8),
('v2-hard-percentages-shop-1',18,8),
('v2-hard-percentages-shop-2',18,8),
('v2-hard-percentages-shop-3',18,8),
('v2-hard-operations-observatory-1',18,8),
('v2-hard-operations-observatory-2',18,8),
('v2-hard-operations-observatory-3',18,8),
('v2-hard-patterns-signal-1',18,8),
('v2-hard-patterns-signal-2',18,8),
('v2-hard-patterns-signal-3',18,8),
('v2-hard-measurement-shelter-1',18,8),
('v2-hard-measurement-shelter-2',18,8),
('v2-hard-measurement-shelter-3',18,8),
('v2-hard-logic-vault-1',18,8),
('v2-hard-logic-vault-2',18,8),
('v2-hard-logic-vault-3',18,8)
  ) as expected(puzzle_id,first_reward,replay_reward) loop
   perform set_config('request.jwt.claim.sub',current_setting('puzzle_reward_test.users')::jsonb->>split_part(p.puzzle_id,'-',2),true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',auth.uid(),'role','authenticated')::text,true);
   w:=public.initialize_my_game_wallet(env);
   balance_before:=w.balance;
   attempt:='boss-reward-acceptance:'||p.puzzle_id;
   w:=public.claim_puzzle_coins(env,p.puzzle_id,attempt||':first');
   first_balance:=balance_before+p.first_reward;
   assert w.balance=first_balance,env||' first reward wrong for '||p.puzzle_id;
   w:=public.claim_puzzle_coins(env,p.puzzle_id,attempt||':first');
   assert w.balance=first_balance,env||' duplicate first attempt paid twice';
   w:=public.claim_puzzle_coins(env,p.puzzle_id,attempt||':replay');
   replay_balance:=first_balance+p.replay_reward;
   assert w.balance=replay_balance,env||' replay reward wrong for '||p.puzzle_id;
   w:=public.claim_puzzle_coins(env,p.puzzle_id,attempt||':replay');
   assert w.balance=replay_balance,env||' duplicate replay attempt paid twice';
   checked:=checked+1;
  end loop;
 end loop;
 assert checked=108,'Not every boss stage was tested in both environments';
end; $$;
reset role;
rollback;
select 'Boss coin rewards passed: 54 stages in both environments; first clears, replays and duplicate attempts verified; all fixtures rolled back.' as result, now() as verified_at;
