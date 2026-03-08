-- Move inventory deduction from order item insertion to explicit order approval.
-- Workflow:
-- Pending -> Approved (deduct inventory exactly once)
-- Pending -> Cancelled (no deduction)
-- Approved -> Ready

alter table public.orders
add column if not exists inventory_deducted_at timestamptz;

update public.orders
set status = case
  when status in ('Pending', 'pending', 'confirmed') then 'Pending'
  when status in ('Approved', 'approved', 'In Progress', 'preparing', 'out_for_delivery') then 'Approved'
  when status in ('Ready', 'ready', 'ready_for_pickup', 'Delivered', 'completed', 'delivered') then 'Ready'
  when status in ('Cancelled', 'cancelled') then 'Cancelled'
  else coalesce(status, 'Pending')
end;

alter table public.orders
  alter column status set default 'Pending';

drop trigger if exists trg_order_items_decrement_product_stock on public.order_items;
drop function if exists public.decrement_product_stock_on_order_item_insert();

create or replace function public.admin_transition_order_status(
  p_order_id uuid,
  p_next_status text,
  p_expected_updated_at timestamptz default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_order public.orders%rowtype;
  item record;
  transition_time timestamptz := now();
begin
  if not public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role]) then
    raise exception 'insufficient permissions';
  end if;

  select *
    into existing_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order not found';
  end if;

  if p_expected_updated_at is not null and existing_order.updated_at <> p_expected_updated_at then
    raise exception 'order was modified concurrently';
  end if;

  if p_next_status = existing_order.status then
    return existing_order;
  end if;

  if p_next_status = 'Approved' then
    if existing_order.status <> 'Pending' then
      raise exception 'only pending orders can be approved';
    end if;

    if existing_order.inventory_deducted_at is null then
      for item in
        select product_id, sum(quantity)::int as quantity
        from public.order_items
        where order_id = p_order_id
          and product_id is not null
        group by product_id
        order by product_id
      loop
        update public.products
        set stock_quantity = stock_quantity - item.quantity
        where id = item.product_id
          and stock_quantity >= item.quantity;

        if not found then
          raise exception 'insufficient stock for product %', item.product_id;
        end if;
      end loop;
    end if;

    update public.orders
    set
      status = 'Approved',
      inventory_deducted_at = coalesce(existing_order.inventory_deducted_at, transition_time),
      updated_at = transition_time
    where id = p_order_id
    returning * into existing_order;

    return existing_order;
  end if;

  if p_next_status = 'Cancelled' then
    if existing_order.status <> 'Pending' then
      raise exception 'only pending orders can be cancelled';
    end if;

    update public.orders
    set
      status = 'Cancelled',
      updated_at = transition_time
    where id = p_order_id
    returning * into existing_order;

    return existing_order;
  end if;

  if p_next_status = 'Ready' then
    if existing_order.status <> 'Approved' then
      raise exception 'only approved orders can move to ready';
    end if;

    update public.orders
    set
      status = 'Ready',
      updated_at = transition_time
    where id = p_order_id
    returning * into existing_order;

    return existing_order;
  end if;

  raise exception 'unsupported order status transition';
end;
$$;

grant execute on function public.admin_transition_order_status(uuid, text, timestamptz) to authenticated;
