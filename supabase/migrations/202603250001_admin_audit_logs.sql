begin;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role public.app_role,
  request_ip text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  outcome text not null check (outcome in ('succeeded', 'failed', 'rejected', 'pending', 'noop')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_entity_created_idx
  on public.admin_audit_logs(entity_type, entity_id, created_at desc);

create index if not exists admin_audit_logs_actor_created_idx
  on public.admin_audit_logs(actor_user_id, created_at desc);

create index if not exists admin_audit_logs_action_created_idx
  on public.admin_audit_logs(action, created_at desc);

alter table public.admin_audit_logs enable row level security;

commit;
