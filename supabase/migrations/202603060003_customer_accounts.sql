-- Separate customer accounts from admin/staff profiles.
-- Public signups should default to customers, not staff.

create table if not exists public.customers (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  phone text,
  default_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

alter table public.customers enable row level security;

drop policy if exists "customers_select_self_or_admin" on public.customers;
create policy "customers_select_self_or_admin"
on public.customers for select
to authenticated
using (
  id = auth.uid()
  or public.has_role(array['admin'::public.app_role, 'manager'::public.app_role])
);

drop policy if exists "customers_update_self_or_admin" on public.customers;
create policy "customers_update_self_or_admin"
on public.customers for update
to authenticated
using (
  id = auth.uid()
  or public.has_role(array['admin'::public.app_role, 'manager'::public.app_role])
)
with check (
  id = auth.uid()
  or public.has_role(array['admin'::public.app_role, 'manager'::public.app_role])
);

drop policy if exists "customers_insert_self" on public.customers;
create policy "customers_insert_self"
on public.customers for insert
to authenticated
with check (
  id = auth.uid()
  or public.has_role(array['admin'::public.app_role, 'manager'::public.app_role])
);

alter table public.orders
add column if not exists customer_id uuid references auth.users(id) on delete set null;

create index if not exists idx_orders_customer_id on public.orders(customer_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := lower(coalesce(new.raw_app_meta_data->>'role', ''));
  full_name_value text := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
begin
  if requested_role in ('admin', 'manager', 'staff')
    and coalesce((new.raw_app_meta_data->>'provisioned_by_admin')::boolean, false) then
    insert into public.profiles (id, email, role)
    values (new.id, coalesce(new.email, ''), requested_role::public.app_role)
    on conflict (id) do update
      set email = excluded.email,
          role = excluded.role;
  else
    insert into public.customers (id, email, full_name)
    values (new.id, coalesce(new.email, ''), full_name_value)
    on conflict (id) do update
      set email = excluded.email,
          full_name = coalesce(excluded.full_name, public.customers.full_name),
          updated_at = now();
  end if;

  return new;
end;
$$;
