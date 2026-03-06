-- Durable admin rate limiting across instances.

create table if not exists public.admin_rate_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.admin_rate_limits enable row level security;

create or replace function public.consume_admin_rate_limit(
  rate_key text,
  max_requests integer,
  window_seconds integer
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.admin_rate_limits%rowtype;
  now_ts timestamptz := now();
  reset_at timestamptz;
begin
  if max_requests <= 0 or window_seconds <= 0 then
    raise exception 'invalid rate limit configuration';
  end if;

  loop
    select *
      into current_row
    from public.admin_rate_limits
    where key = rate_key
    for update;

    if not found then
      begin
        insert into public.admin_rate_limits (key, window_started_at, request_count)
        values (rate_key, now_ts, 1);

        return query select true, 0;
        return;
      exception
        when unique_violation then
          -- Another request inserted the row first. Loop and lock it.
      end;
    elsif current_row.window_started_at + make_interval(secs => window_seconds) <= now_ts then
      update public.admin_rate_limits
      set window_started_at = now_ts,
          request_count = 1
      where key = rate_key;

      return query select true, 0;
      return;
    elsif current_row.request_count >= max_requests then
      reset_at := current_row.window_started_at + make_interval(secs => window_seconds);

      return query
      select false, greatest(1, ceil(extract(epoch from (reset_at - now_ts)))::integer);
      return;
    else
      update public.admin_rate_limits
      set request_count = current_row.request_count + 1
      where key = rate_key;

      return query select true, 0;
      return;
    end if;
  end loop;
end;
$$;
