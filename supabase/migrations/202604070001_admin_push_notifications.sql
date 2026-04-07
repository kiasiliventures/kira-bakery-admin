create table if not exists public.admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create index if not exists idx_admin_push_subscriptions_user_id
  on public.admin_push_subscriptions(user_id);

drop trigger if exists trg_admin_push_subscriptions_updated_at on public.admin_push_subscriptions;
create trigger trg_admin_push_subscriptions_updated_at
before update on public.admin_push_subscriptions
for each row execute function public.set_updated_at();

alter table public.admin_push_subscriptions enable row level security;

create table if not exists public.admin_push_dispatches (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  notification_type text not null default 'new_paid_order',
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_type, order_id)
);

create index if not exists idx_admin_push_dispatches_status_next_attempt
  on public.admin_push_dispatches(status, next_attempt_at);

drop trigger if exists trg_admin_push_dispatches_updated_at on public.admin_push_dispatches;
create trigger trg_admin_push_dispatches_updated_at
before update on public.admin_push_dispatches
for each row execute function public.set_updated_at();

alter table public.admin_push_dispatches enable row level security;

create table if not exists public.admin_push_dispatch_receipts (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.admin_push_dispatches(id) on delete cascade,
  subscription_id uuid not null references public.admin_push_subscriptions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (dispatch_id, subscription_id)
);

create index if not exists idx_admin_push_dispatch_receipts_dispatch
  on public.admin_push_dispatch_receipts(dispatch_id);

alter table public.admin_push_dispatch_receipts enable row level security;

create or replace function public.enqueue_admin_paid_order_push_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_payment_status text := lower(trim(coalesce(old.payment_status, '')));
  next_payment_status text := lower(trim(coalesce(new.payment_status, '')));
begin
  if tg_op = 'INSERT' then
    previous_payment_status := '';
  end if;

  if next_payment_status in ('paid', 'completed')
    and previous_payment_status not in ('paid', 'completed') then
    insert into public.admin_push_dispatches (order_id, notification_type)
    values (new.id, 'new_paid_order')
    on conflict (notification_type, order_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_enqueue_admin_paid_order_push on public.orders;
create trigger trg_orders_enqueue_admin_paid_order_push
after insert or update of payment_status on public.orders
for each row execute function public.enqueue_admin_paid_order_push_dispatch();

create or replace function public.claim_admin_push_dispatches(
  p_limit integer default 10,
  p_order_id uuid default null
)
returns setof public.admin_push_dispatches
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
begin
  return query
  with candidates as (
    select d.id
    from public.admin_push_dispatches d
    where (
      (
        d.status = 'pending'
        and d.next_attempt_at <= now()
      )
      or (
        d.status = 'processing'
        and d.last_attempt_at is not null
        and d.last_attempt_at <= now() - interval '5 minutes'
      )
    )
    and (p_order_id is null or d.order_id = p_order_id)
    order by d.created_at asc
    limit normalized_limit
    for update skip locked
  )
  update public.admin_push_dispatches as d
  set
    status = 'processing',
    attempt_count = d.attempt_count + 1,
    last_attempt_at = now(),
    last_error = null,
    updated_at = now()
  from candidates
  where d.id = candidates.id
  returning d.*;
end;
$$;
