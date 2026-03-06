-- Tighten shared DB access and add proper category update tracking.

alter table public.categories
add column if not exists updated_at timestamptz not null default now();

update public.categories
set updated_at = created_at
where updated_at is null or updated_at <> created_at;

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop policy if exists "orders_public_insert" on public.orders;
drop policy if exists "order_items_public_insert" on public.order_items;
