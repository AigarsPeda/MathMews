-- One-time, 48-hour room promotion requested on 2026-10-17.
-- Guard existing promotions. Expiry restores normal pricing automatically.
with sale as (
  update wallet_private.store_catalog
  set sale_price = floor(price * 0.75)::integer,
      sale_starts_at = now(),
      sale_ends_at = now() + interval '48 hours',
      sale_label = 'Autumn sale'
  where kind = 'room' and price > 0 and sale_price is null
  returning item_id, price, sale_price, sale_starts_at, sale_ends_at
)
select count(*) as rooms_discounted,
       min(sale_starts_at) as starts_at,
       max(sale_ends_at) as ends_at,
       min(price) as lowest_original_price,
       max(price) as highest_original_price,
       min(sale_price) as lowest_sale_price,
       max(sale_price) as highest_sale_price
from sale;
