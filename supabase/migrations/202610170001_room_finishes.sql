-- Additional room finishes. Existing room ownership and prices stay intact.
begin;
insert into wallet_private.store_catalog(kind,item_id,price) values
('room','room16',52),
('room','room17',52),
('room','room18',56),
('room','room19',56),
('room','room20',48),
('room','room21',52),
('room','room22',56),
('room','room23',56),
('room','room24',60),
('room','room25',48),
('room','room26',56),
('room','room27',56),
('room','room28',52),
('room','room29',56),
('room','room30',56)
on conflict(kind,item_id) do update set price=excluded.price;
commit;
