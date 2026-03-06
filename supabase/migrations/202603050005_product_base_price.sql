-- Product-level price for admin editing and client consumption.

alter table public.products
add column if not exists base_price numeric(10,2) not null default 0 check (base_price >= 0);

-- Backfill from the lowest available variant price when present.
update public.products p
set base_price = coalesce(
  (
    select min(v.price)
    from public.product_variants v
    where v.product_id = p.id
  ),
  p.base_price
);
