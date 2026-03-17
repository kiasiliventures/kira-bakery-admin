insert into public.cake_shapes (code, name, sort_order, is_active)
values
  ('round', 'Round', 0, true),
  ('heart', 'Heart', 1, true)
on conflict (code) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.cake_toppings (code, name, sort_order, is_active)
values
  ('fondant', 'Fondant', 0, true),
  ('butter_icing', 'Butter Icing', 1, true),
  ('mirror_glaze', 'Mirror Glaze', 2, true),
  ('whipped_cream', 'Whipped Cream', 3, true)
on conflict (code) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.cake_tier_options (code, name, tier_count, sort_order, is_active)
values
  ('1_tier', '1 Tier', 1, 0, true),
  ('2_tier', '2 Tiers', 2, 1, true)
on conflict (code) do update
set
  name = excluded.name,
  tier_count = excluded.tier_count,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.cake_sizes (code, name, sort_order, is_active)
values
  ('heart', 'Heart', 0, true),
  ('7.5_in', '7.5 inch', 1, true),
  ('8_in', '8 inch', 2, true),
  ('9.5_in', '9.5 inch', 3, true),
  ('10_in', '10 inch', 4, true),
  ('11_in', '11 inch', 5, true)
on conflict (code) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.cake_flavours (code, name, sort_order, is_active)
values
  ('vanilla', 'Vanilla', 0, true),
  ('marble', 'Marble', 1, true),
  ('chocolate', 'Chocolate', 2, true),
  ('lemon', 'Lemon', 3, true),
  ('strawberry', 'Strawberry', 4, true),
  ('blueberry', 'Blueberry', 5, true),
  ('pineapple', 'Pineapple', 6, true),
  ('orange', 'Orange', 7, true),
  ('mango', 'Mango', 8, true),
  ('peppermint', 'Peppermint', 9, true),
  ('bubble_gum', 'Bubble Gum', 10, true),
  ('caramel_toffee', 'Caramel Toffee', 11, true),
  ('caramel', 'Caramel', 12, true),
  ('toffee', 'Toffee', 13, true),
  ('coconut', 'Coconut', 14, true),
  ('carrot', 'Carrot', 15, true),
  ('banana', 'Banana', 16, true),
  ('sorghum_paste_fruit_cake', 'Sorghum Paste Fruit Cake', 17, true),
  ('fruit_cake', 'Fruit Cake', 18, true),
  ('black_forest', 'Black Forest', 19, true),
  ('white_forest', 'White Forest', 20, true),
  ('red_velvet', 'Red Velvet', 21, true)
on conflict (code) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

-- Price import note:
-- The converted PDF import now lives in:
-- supabase/seeds/202603170002_cake_price_pdf_import.sql
--
-- The scaffold below is kept for future manual imports or corrections.
-- You do not need to populate it if you run the generated PDF import file.
--
-- Special-case reminder from the request:
-- Black Forest, White Forest, and Red Velvet appear to only have whipped cream pricing.

with imported_prices (
  flavour_code,
  shape_code,
  size_code,
  tier_count,
  topping_code,
  weight_kg,
  price_ugx,
  source_note
) as (
  select
    cast(null as text) as flavour_code,
    cast(null as text) as shape_code,
    cast(null as text) as size_code,
    cast(null as integer) as tier_count,
    cast(null as text) as topping_code,
    cast(null as numeric(6,2)) as weight_kg,
    cast(null as integer) as price_ugx,
    cast(null as text) as source_note
  where false
  -- Example row:
  -- union all select 'vanilla', 'round', '8_in', 1, 'fondant', 2.00, 65000, null
  -- Paste the full PDF price matrix here.
)
insert into public.cake_prices (
  flavour_id,
  shape_id,
  size_id,
  tier_option_id,
  topping_id,
  weight_kg,
  price_ugx,
  source_note,
  is_active
)
select
  flavour.id,
  shape.id,
  size.id,
  tier_option.id,
  topping.id,
  imported_prices.weight_kg,
  imported_prices.price_ugx,
  imported_prices.source_note,
  true
from imported_prices
join public.cake_flavours flavour
  on flavour.code = imported_prices.flavour_code
join public.cake_shapes shape
  on shape.code = imported_prices.shape_code
join public.cake_sizes size
  on size.code = imported_prices.size_code
join public.cake_tier_options tier_option
  on tier_option.tier_count = imported_prices.tier_count
join public.cake_toppings topping
  on topping.code = imported_prices.topping_code
on conflict (
  flavour_id,
  shape_id,
  size_id,
  tier_option_id,
  topping_id
) do update
set
  weight_kg = excluded.weight_kg,
  price_ugx = excluded.price_ugx,
  source_note = excluded.source_note,
  is_active = excluded.is_active,
  updated_at = now();
