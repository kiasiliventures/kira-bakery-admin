-- Normalize the shared orders schema toward the client/PWA contract
-- and enable realtime publication for admin live updates.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'orders'
  ) then
    alter table public.orders
      add column if not exists total_ugx integer,
      add column if not exists status text,
      add column if not exists delivery_method text,
      add column if not exists phone text,
      add column if not exists email text,
      add column if not exists address text,
      add column if not exists delivery_date date,
      add column if not exists notes text;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'total_price'
  ) then
    execute '
      update public.orders
      set total_ugx = coalesce(total_ugx, round(total_price)::integer)
      where total_ugx is null
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'order_status'
  ) then
    execute '
      update public.orders
      set status = coalesce(
        status,
        case
          when order_status in (''pending'', ''confirmed'') then ''Pending''
          when order_status in (''preparing'', ''out_for_delivery'') then ''In Progress''
          when order_status = ''ready_for_pickup'' then ''Ready''
          when order_status in (''completed'', ''delivered'') then ''Delivered''
          else ''Pending''
        end
      )
      where status is null
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'customer_phone'
  ) then
    execute '
      update public.orders
      set phone = coalesce(phone, customer_phone)
      where phone is null
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'customer_email'
  ) then
    execute '
      update public.orders
      set email = coalesce(email, customer_email)
      where email is null
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'delivery_address'
  ) then
    execute '
      update public.orders
      set address = coalesce(address, delivery_address)
      where address is null
    ';
  end if;
end
$$;

update public.orders
set delivery_method = case when coalesce(nullif(trim(address), ''), '') = '' then 'pickup' else 'delivery' end
where delivery_method is null;

update public.orders
set total_ugx = 0
where total_ugx is null;

update public.orders
set status = 'Pending'
where status is null;

alter table public.orders
  alter column total_ugx set not null,
  alter column status set not null,
  alter column status set default 'Pending',
  alter column delivery_method set default 'pickup',
  alter column phone drop not null;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'order_items'
  ) then
    alter table public.order_items
      add column if not exists name text,
      add column if not exists image text,
      add column if not exists price_ugx integer,
      add column if not exists selected_size text,
      add column if not exists selected_flavor text;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_items'
      and column_name = 'price_at_time'
  ) then
    execute '
      update public.order_items
      set price_ugx = coalesce(price_ugx, round(price_at_time)::integer)
      where price_ugx is null
    ';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'image_url'
  ) then
    execute '
      update public.order_items oi
      set
        name = coalesce(oi.name, p.name),
        image = coalesce(oi.image, p.image_url, '''')
      from public.products p
      where oi.product_id::text = p.id::text
        and (oi.name is null or oi.image is null)
    ';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'image'
  ) then
    execute '
      update public.order_items oi
      set
        name = coalesce(oi.name, p.name),
        image = coalesce(oi.image, p.image, '''')
      from public.products p
      where oi.product_id::text = p.id::text
        and (oi.name is null or oi.image is null)
    ';
  end if;
end
$$;

update public.order_items
set name = coalesce(name, 'Product'),
    image = coalesce(image, ''),
    price_ugx = coalesce(price_ugx, 0);

alter table public.order_items
  alter column name set not null,
  alter column image set not null,
  alter column price_ugx set not null;

do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception
    when duplicate_object then
      null;
    when undefined_object then
      null;
  end;

  begin
    alter publication supabase_realtime add table public.order_items;
  exception
    when duplicate_object then
      null;
    when undefined_object then
      null;
  end;
end
$$;
