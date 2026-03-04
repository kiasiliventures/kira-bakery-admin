-- KiRA Bakery Admin: schema + RLS + policy baseline
-- Run in Supabase SQL editor or via Supabase CLI migrations.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'manager', 'staff');
  end if;
end$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.app_role not null default 'staff',
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  description text,
  image_url text,
  is_available boolean not null default true,
  is_featured boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  delivery_address text,
  order_status text not null default 'pending',
  payment_status text not null default 'unpaid',
  total_price numeric(10,2) not null check (total_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity int not null check (quantity > 0),
  price_at_time numeric(10,2) not null check (price_at_time >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_products_published_available on public.products(is_published, is_available);
create index if not exists idx_variants_product_id on public.product_variants(product_id);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_profiles_role on public.profiles(role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists trg_product_variants_updated_at on public.product_variants;
create trigger trg_product_variants_updated_at
before update on public.product_variants
for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.enforce_staff_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_role() = 'staff' then
    if new.total_price is distinct from old.total_price
      or new.payment_status is distinct from old.payment_status
      or new.customer_name is distinct from old.customer_name
      or new.customer_phone is distinct from old.customer_phone
      or new.customer_email is distinct from old.customer_email
      or new.delivery_address is distinct from old.delivery_address then
      raise exception 'staff can only update order_status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_staff_order_update on public.orders;
create trigger trg_enforce_staff_order_update
before update on public.orders
for each row execute function public.enforce_staff_order_update();

create or replace function public.current_profile_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.has_role(roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = any(roles), false);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, coalesce(new.email, ''), 'staff')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Profiles policies
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.has_role(array['admin'::public.app_role]));

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles for update
to authenticated
using (public.has_role(array['admin'::public.app_role]))
with check (public.has_role(array['admin'::public.app_role]));

-- Categories policies
drop policy if exists "categories_public_read_published_available" on public.categories;
create policy "categories_public_read_published_available"
on public.categories for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    where p.category_id = categories.id
      and p.is_published = true
      and p.is_available = true
  )
  or public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role])
);

drop policy if exists "categories_admin_manager_crud" on public.categories;
create policy "categories_admin_manager_crud"
on public.categories for all
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]))
with check (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]));

-- Products policies
drop policy if exists "products_public_read_published_available" on public.products;
create policy "products_public_read_published_available"
on public.products for select
to anon, authenticated
using (
  (is_published = true and is_available = true)
  or public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role])
);

drop policy if exists "products_admin_manager_crud" on public.products;
create policy "products_admin_manager_crud"
on public.products for all
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]))
with check (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]));

-- Variants policies
drop policy if exists "variants_public_read_published_available" on public.product_variants;
create policy "variants_public_read_published_available"
on public.product_variants for select
to anon, authenticated
using (
  (
    is_available = true
    and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.is_published = true
        and p.is_available = true
    )
  )
  or public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role])
);

drop policy if exists "variants_admin_manager_crud" on public.product_variants;
create policy "variants_admin_manager_crud"
on public.product_variants for all
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]))
with check (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]));

-- Orders policies
drop policy if exists "orders_public_insert" on public.orders;
create policy "orders_public_insert"
on public.orders for insert
to anon, authenticated
with check (true);

drop policy if exists "orders_staff_admin_manager_read" on public.orders;
create policy "orders_staff_admin_manager_read"
on public.orders for select
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role]));

drop policy if exists "orders_staff_admin_manager_update" on public.orders;
create policy "orders_staff_admin_manager_update"
on public.orders for update
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role]))
with check (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role]));

drop policy if exists "orders_admin_manager_delete" on public.orders;
create policy "orders_admin_manager_delete"
on public.orders for delete
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]));

-- Order items policies
drop policy if exists "order_items_public_insert" on public.order_items;
create policy "order_items_public_insert"
on public.order_items for insert
to anon, authenticated
with check (true);

drop policy if exists "order_items_staff_admin_manager_read" on public.order_items;
create policy "order_items_staff_admin_manager_read"
on public.order_items for select
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role]));

-- Storage bucket for product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_write" on storage.objects;
create policy "product_images_admin_write"
on storage.objects for all
to authenticated
using (
  bucket_id = 'product-images'
  and public.has_role(array['admin'::public.app_role, 'manager'::public.app_role])
)
with check (
  bucket_id = 'product-images'
  and public.has_role(array['admin'::public.app_role, 'manager'::public.app_role])
);
