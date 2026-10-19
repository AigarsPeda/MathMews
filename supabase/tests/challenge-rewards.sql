-- Hosted rollback acceptance: every optional challenge in sandbox and production.
-- Creates one transaction-only account; no existing player is changed.
begin;
set local plpgsql.check_asserts=on;
select set_config('puzzle_reward_test.user_id',gen_random_uuid()::text,true);
insert into auth.users(id,is_anonymous,aud,role) values (current_setting('puzzle_reward_test.user_id')::uuid,true,'authenticated','authenticated');
select set_config('request.jwt.claim.sub',current_setting('puzzle_reward_test.user_id'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('puzzle_reward_test.user_id'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare env text; p record; w public.coin_wallets; balance_before bigint; first_balance bigint; replay_balance bigint; attempt text; checked integer:=0;
begin
 foreach env in array array['sandbox','production'] loop
  w:=public.initialize_my_game_wallet(env);
  for p in select * from (values
('v2-easy-addition-pair-hunt-1',4,2),
('v2-easy-numbers-number-baskets-1',4,2),
('v2-easy-patterns-stepping-stones-1',4,2),
('v2-medium-addition-pair-hunt-1',7,3),
('v2-medium-fractions-fraction-post-1',7,3),
('v2-medium-multiplication-seat-labels-1',7,3),
('v2-medium-operations-courier-maze-1',7,3),
('v2-hard-logic-pair-hunt-1',9,4),
('v2-hard-patterns-signal-gaps-1',9,4),
('v2-hard-operations-power-detour-1',9,4),
('v2-hard-percentages-camp-budget-1',9,4)
  ) as expected(puzzle_id,first_reward,replay_reward) loop
   balance_before:=w.balance;
   attempt:='challenge-reward-acceptance:'||p.puzzle_id;
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
 assert checked=22,'Not every challenge was tested in both environments';
end; $$;
reset role;
rollback;
select 'Optional challenge coin rewards passed: 11 challenges in both environments; first clears, replays and duplicate attempts verified; all fixtures rolled back.' as result, now() as verified_at;
