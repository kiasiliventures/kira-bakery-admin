-- Ensure products are published by default and backfill older rows.
-- Public visibility already follows stock_quantity > 0 policy.

alter table public.products
alter column is_published set default true;

update public.products
set is_published = true
where stock_quantity > 0
  and is_published = false;
