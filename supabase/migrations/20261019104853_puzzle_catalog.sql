-- Generated puzzle registrations; existing rewards are preserved.
begin;
insert into wallet_private.puzzle_catalog(puzzle_id,first_reward,replay_reward) values
('v2-easy-numbers-number-baskets-1',4,2),
('v2-easy-patterns-stepping-stones-1',4,2),
('v2-medium-fractions-fraction-post-1',7,3),
('v2-medium-multiplication-seat-labels-1',7,3),
('v2-medium-operations-courier-maze-1',7,3),
('v2-hard-patterns-signal-gaps-1',9,4),
('v2-hard-operations-power-detour-1',9,4),
('v2-hard-percentages-camp-budget-1',9,4)
on conflict(puzzle_id) do nothing;
commit;
