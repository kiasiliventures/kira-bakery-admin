-- Inventory automation:
-- 1) Track stock per product
-- 2) Derive product availability from stock (not manual)
-- 3) Decrement stock automatically when order_items are inserted

alter table public.products
add column if not exists stock_quantity int not null default 0 check (stock_quantity >= 0);

update public.products
set stock_quantity = case when is_available then 1 else 0 end
where stock_quantity = 0;

create or replace function public.sync_product_availability_from_stock()
returns trigger
language plpgsql
as $$
begin
  new.is_available = (new.stock_quantity > 0);
  return new;
end;
$$;

drop trigger if exists trg_products_sync_availability_from_stock on public.products;
create trigger trg_products_sync_availability_from_stock
before insert or update on public.products
for each row execute function public.sync_product_availability_from_stock();

create or replace function public.decrement_product_stock_on_order_item_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stock int;
begin
  select stock_quantity
    into current_stock
  from public.products
  where id = new.product_id
  for update;

  if current_stock is null then
    raise exception 'product not found for stock deduction';
  end if;

  if current_stock < new.quantity then
    raise exception 'insufficient stock for product %', new.product_id;
  end if;

  update public.products
  set stock_quantity = stock_quantity - new.quantity
  where id = new.product_id;

  return new;
end;
$$;

drop trigger if exists trg_order_items_decrement_product_stock on public.order_items;
create trigger trg_order_items_decrement_product_stock
before insert on public.order_items
for each row execute function public.decrement_product_stock_on_order_item_insert();
