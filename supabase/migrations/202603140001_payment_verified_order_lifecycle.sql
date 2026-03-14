begin;

alter table public.orders
  add column if not exists payment_provider text,
  add column if not exists payment_reference text,
  add column if not exists payment_redirect_url text,
  add column if not exists paid_at timestamptz,
  add column if not exists order_tracking_id text,
  add column if not exists inventory_deducted_at timestamptz;

create index if not exists idx_orders_payment_status on public.orders(payment_status);
create unique index if not exists idx_orders_order_tracking_id
  on public.orders(order_tracking_id)
  where order_tracking_id is not null;

update public.orders
set
  status = case
    when lower(coalesce(status, '')) in ('completed', 'delivered') then 'Completed'
    when lower(coalesce(status, '')) in ('ready', 'ready_for_pickup') then 'Ready'
    when lower(coalesce(status, '')) = 'cancelled' then 'Cancelled'
    when lower(coalesce(payment_status, '')) in ('failed', 'payment_failed', 'reversed') then 'Payment Failed'
    when lower(coalesce(payment_status, '')) = 'paid' then 'Paid'
    when lower(coalesce(status, '')) in ('approved', 'in progress', 'preparing', 'out_for_delivery', 'paid') then 'Paid'
    else 'Pending Payment'
  end,
  order_status = case
    when lower(coalesce(status, '')) in ('completed', 'delivered') then 'completed'
    when lower(coalesce(status, '')) in ('ready', 'ready_for_pickup') then 'ready'
    when lower(coalesce(status, '')) = 'cancelled' then 'cancelled'
    when lower(coalesce(payment_status, '')) in ('failed', 'payment_failed', 'reversed') then 'payment_failed'
    when lower(coalesce(payment_status, '')) = 'paid' then 'paid'
    when lower(coalesce(status, '')) in ('approved', 'in progress', 'preparing', 'out_for_delivery', 'paid') then 'paid'
    else 'pending_payment'
  end;

update public.orders
set inventory_deducted_at = coalesce(inventory_deducted_at, paid_at, updated_at, created_at)
where inventory_deducted_at is null
  and status in ('Paid', 'Ready', 'Completed');

create or replace function public.deduct_inventory_for_order(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
begin
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
end;
$$;

create or replace function public.sync_order_payment_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_state text := lower(trim(coalesce(new.payment_status, '')));
  status_state text := lower(trim(coalesce(new.status, '')));
  transition_time timestamptz := now();
begin
  if payment_state in ('paid', 'completed') then
    if new.inventory_deducted_at is null then
      perform public.deduct_inventory_for_order(new.id);
      new.inventory_deducted_at := transition_time;
    end if;

    if status_state not in ('ready', 'completed', 'cancelled') then
      new.status := 'Paid';
    end if;

    if lower(trim(coalesce(new.order_status, ''))) not in ('ready', 'completed', 'cancelled') then
      new.order_status := 'paid';
    end if;

    new.paid_at := coalesce(new.paid_at, transition_time);
    return new;
  end if;

  if payment_state in ('failed', 'payment_failed', 'reversed') then
    if status_state not in ('ready', 'completed', 'cancelled') then
      new.status := 'Payment Failed';
    end if;

    if lower(trim(coalesce(new.order_status, ''))) not in ('ready', 'completed', 'cancelled') then
      new.order_status := 'payment_failed';
    end if;

    return new;
  end if;

  if payment_state in ('cancelled', 'canceled', 'invalid') then
    if status_state <> 'completed' then
      new.status := 'Cancelled';
    end if;

    if lower(trim(coalesce(new.order_status, ''))) <> 'completed' then
      new.order_status := 'cancelled';
    end if;

    return new;
  end if;

  if status_state not in ('paid', 'ready', 'completed', 'cancelled', 'payment failed') then
    new.status := 'Pending Payment';
  end if;

  if lower(trim(coalesce(new.order_status, ''))) not in ('paid', 'ready', 'completed', 'cancelled', 'payment_failed') then
    new.order_status := 'pending_payment';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_sync_payment_lifecycle on public.orders;
create trigger trg_orders_sync_payment_lifecycle
before insert or update on public.orders
for each row execute function public.sync_order_payment_lifecycle();

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
  transition_time timestamptz := now();
  requested_status text := lower(trim(coalesce(p_next_status, '')));
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

  if lower(trim(coalesce(existing_order.status, ''))) = requested_status then
    return existing_order;
  end if;

  if requested_status = 'ready' then
    if existing_order.status <> 'Paid' then
      raise exception 'only paid orders can move to ready';
    end if;

    update public.orders
    set
      status = 'Ready',
      order_status = 'ready',
      updated_at = transition_time
    where id = p_order_id
    returning * into existing_order;

    return existing_order;
  end if;

  if requested_status = 'completed' then
    if existing_order.status <> 'Ready' then
      raise exception 'only ready orders can move to completed';
    end if;

    update public.orders
    set
      status = 'Completed',
      order_status = 'completed',
      updated_at = transition_time
    where id = p_order_id
    returning * into existing_order;

    return existing_order;
  end if;

  if requested_status = 'cancelled' then
    if not public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]) then
      raise exception 'only admin or manager can cancel orders';
    end if;

    if existing_order.status = 'Completed' then
      raise exception 'completed orders cannot be cancelled';
    end if;

    update public.orders
    set
      status = 'Cancelled',
      order_status = 'cancelled',
      updated_at = transition_time
    where id = p_order_id
    returning * into existing_order;

    return existing_order;
  end if;

  raise exception 'unsupported order status transition';
end;
$$;

grant execute on function public.admin_transition_order_status(uuid, text, timestamptz) to authenticated;

commit;
