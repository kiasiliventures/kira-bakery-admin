-- Restrict admin rate-limit RPC access to the service role only.

revoke execute on function public.consume_admin_rate_limit(text, integer, integer) from public;
revoke execute on function public.consume_admin_rate_limit(text, integer, integer) from anon;
revoke execute on function public.consume_admin_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.consume_admin_rate_limit(text, integer, integer) to service_role;

-- The RPC is security definer, so clients should not need direct table access.
revoke all on table public.admin_rate_limits from public;
revoke all on table public.admin_rate_limits from anon;
revoke all on table public.admin_rate_limits from authenticated;
grant all on table public.admin_rate_limits to service_role;
