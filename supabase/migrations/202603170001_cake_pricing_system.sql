create table if not exists public.cake_flavours (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cake_shapes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cake_sizes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cake_toppings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cake_tier_options (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  tier_count int not null unique check (tier_count > 0),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cake_prices (
  id uuid primary key default gen_random_uuid(),
  flavour_id uuid not null references public.cake_flavours(id) on delete restrict,
  shape_id uuid not null references public.cake_shapes(id) on delete restrict,
  size_id uuid not null references public.cake_sizes(id) on delete restrict,
  tier_option_id uuid not null references public.cake_tier_options(id) on delete restrict,
  topping_id uuid not null references public.cake_toppings(id) on delete restrict,
  weight_kg numeric(6,2) not null check (weight_kg > 0),
  price_ugx integer not null check (price_ugx >= 0),
  source_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cake_prices_valid_combination_unique unique (
    flavour_id,
    shape_id,
    size_id,
    tier_option_id,
    topping_id
  )
);

create table if not exists public.cake_custom_requests (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  email text,
  notes text,
  request_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'quoted', 'closed')),
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cake_custom_requests_request_payload_is_object
    check (jsonb_typeof(request_payload) = 'object')
);

create index if not exists idx_cake_flavours_active_sort_order
  on public.cake_flavours(is_active, sort_order, name);
create index if not exists idx_cake_shapes_active_sort_order
  on public.cake_shapes(is_active, sort_order, name);
create index if not exists idx_cake_sizes_active_sort_order
  on public.cake_sizes(is_active, sort_order, name);
create index if not exists idx_cake_toppings_active_sort_order
  on public.cake_toppings(is_active, sort_order, name);
create index if not exists idx_cake_tier_options_active_sort_order
  on public.cake_tier_options(is_active, sort_order, tier_count);
create index if not exists idx_cake_prices_active_lookup
  on public.cake_prices(is_active, shape_id, size_id, tier_option_id, topping_id, flavour_id);
create index if not exists idx_cake_custom_requests_status_created_at
  on public.cake_custom_requests(status, created_at desc);

drop trigger if exists trg_cake_flavours_updated_at on public.cake_flavours;
create trigger trg_cake_flavours_updated_at
before update on public.cake_flavours
for each row execute function public.set_updated_at();

drop trigger if exists trg_cake_shapes_updated_at on public.cake_shapes;
create trigger trg_cake_shapes_updated_at
before update on public.cake_shapes
for each row execute function public.set_updated_at();

drop trigger if exists trg_cake_sizes_updated_at on public.cake_sizes;
create trigger trg_cake_sizes_updated_at
before update on public.cake_sizes
for each row execute function public.set_updated_at();

drop trigger if exists trg_cake_toppings_updated_at on public.cake_toppings;
create trigger trg_cake_toppings_updated_at
before update on public.cake_toppings
for each row execute function public.set_updated_at();

drop trigger if exists trg_cake_tier_options_updated_at on public.cake_tier_options;
create trigger trg_cake_tier_options_updated_at
before update on public.cake_tier_options
for each row execute function public.set_updated_at();

drop trigger if exists trg_cake_prices_updated_at on public.cake_prices;
create trigger trg_cake_prices_updated_at
before update on public.cake_prices
for each row execute function public.set_updated_at();

drop trigger if exists trg_cake_custom_requests_updated_at on public.cake_custom_requests;
create trigger trg_cake_custom_requests_updated_at
before update on public.cake_custom_requests
for each row execute function public.set_updated_at();

alter table public.cake_flavours enable row level security;
alter table public.cake_shapes enable row level security;
alter table public.cake_sizes enable row level security;
alter table public.cake_toppings enable row level security;
alter table public.cake_tier_options enable row level security;
alter table public.cake_prices enable row level security;
alter table public.cake_custom_requests enable row level security;

drop policy if exists "cake_flavours_public_read_active" on public.cake_flavours;
create policy "cake_flavours_public_read_active"
on public.cake_flavours for select
to anon, authenticated
using (is_active = true);

drop policy if exists "cake_flavours_staff_read_all" on public.cake_flavours;
create policy "cake_flavours_staff_read_all"
on public.cake_flavours for select
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role]));

drop policy if exists "cake_flavours_admin_manager_write" on public.cake_flavours;
create policy "cake_flavours_admin_manager_write"
on public.cake_flavours for all
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]))
with check (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]));

drop policy if exists "cake_shapes_public_read_active" on public.cake_shapes;
create policy "cake_shapes_public_read_active"
on public.cake_shapes for select
to anon, authenticated
using (is_active = true);

drop policy if exists "cake_shapes_staff_read_all" on public.cake_shapes;
create policy "cake_shapes_staff_read_all"
on public.cake_shapes for select
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role]));

drop policy if exists "cake_shapes_admin_manager_write" on public.cake_shapes;
create policy "cake_shapes_admin_manager_write"
on public.cake_shapes for all
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]))
with check (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]));

drop policy if exists "cake_sizes_public_read_active" on public.cake_sizes;
create policy "cake_sizes_public_read_active"
on public.cake_sizes for select
to anon, authenticated
using (is_active = true);

drop policy if exists "cake_sizes_staff_read_all" on public.cake_sizes;
create policy "cake_sizes_staff_read_all"
on public.cake_sizes for select
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role]));

drop policy if exists "cake_sizes_admin_manager_write" on public.cake_sizes;
create policy "cake_sizes_admin_manager_write"
on public.cake_sizes for all
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]))
with check (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]));

drop policy if exists "cake_toppings_public_read_active" on public.cake_toppings;
create policy "cake_toppings_public_read_active"
on public.cake_toppings for select
to anon, authenticated
using (is_active = true);

drop policy if exists "cake_toppings_staff_read_all" on public.cake_toppings;
create policy "cake_toppings_staff_read_all"
on public.cake_toppings for select
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role]));

drop policy if exists "cake_toppings_admin_manager_write" on public.cake_toppings;
create policy "cake_toppings_admin_manager_write"
on public.cake_toppings for all
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]))
with check (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]));

drop policy if exists "cake_tier_options_public_read_active" on public.cake_tier_options;
create policy "cake_tier_options_public_read_active"
on public.cake_tier_options for select
to anon, authenticated
using (is_active = true);

drop policy if exists "cake_tier_options_staff_read_all" on public.cake_tier_options;
create policy "cake_tier_options_staff_read_all"
on public.cake_tier_options for select
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role]));

drop policy if exists "cake_tier_options_admin_manager_write" on public.cake_tier_options;
create policy "cake_tier_options_admin_manager_write"
on public.cake_tier_options for all
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]))
with check (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]));

drop policy if exists "cake_prices_public_read_active" on public.cake_prices;
create policy "cake_prices_public_read_active"
on public.cake_prices for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.cake_flavours flavour
    where flavour.id = cake_prices.flavour_id
      and flavour.is_active = true
  )
  and exists (
    select 1
    from public.cake_shapes shape
    where shape.id = cake_prices.shape_id
      and shape.is_active = true
  )
  and exists (
    select 1
    from public.cake_sizes size
    where size.id = cake_prices.size_id
      and size.is_active = true
  )
  and exists (
    select 1
    from public.cake_tier_options tier_option
    where tier_option.id = cake_prices.tier_option_id
      and tier_option.is_active = true
  )
  and exists (
    select 1
    from public.cake_toppings topping
    where topping.id = cake_prices.topping_id
      and topping.is_active = true
  )
);

drop policy if exists "cake_prices_staff_read_all" on public.cake_prices;
create policy "cake_prices_staff_read_all"
on public.cake_prices for select
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role]));

drop policy if exists "cake_prices_admin_manager_write" on public.cake_prices;
create policy "cake_prices_admin_manager_write"
on public.cake_prices for all
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]))
with check (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]));

drop policy if exists "cake_custom_requests_staff_read_all" on public.cake_custom_requests;
create policy "cake_custom_requests_staff_read_all"
on public.cake_custom_requests for select
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role]));

drop policy if exists "cake_custom_requests_admin_manager_write" on public.cake_custom_requests;
create policy "cake_custom_requests_admin_manager_write"
on public.cake_custom_requests for all
to authenticated
using (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]))
with check (public.has_role(array['admin'::public.app_role, 'manager'::public.app_role]));
