# Security Checklist

Use this checklist before production go-live and after major changes.

## 1) Secrets Handling

- [ ] `.env.local` exists only locally; not committed.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is configured only in server runtime env.
- [ ] No client component imports `src/lib/supabase/admin.ts`.
- [ ] Rotate secrets if ever exposed.

Verification:
- Search codebase for `SUPABASE_SERVICE_ROLE_KEY` usage. It must appear only in server-side files.

## 2) Authentication

- [ ] `/login` requires valid Supabase email/password.
- [ ] Protected pages redirect unauthenticated users to `/login`.
- [ ] Auth state is read from cookies server-side.

Verification:
- Open protected route in incognito without session; confirm redirect to `/login`.

## 3) Authorization (RBAC)

- [ ] Roles are restricted to `admin`, `manager`, `staff`.
- [ ] `admin` and `manager` can manage categories/products/variants.
- [ ] `staff` can view catalog/orders and update order status only.
- [ ] `/settings/users` is admin-only.

Verification:
- Test each role against each page + mutation endpoint.

## 4) Database RLS

- [ ] RLS enabled on all tables:
  - `profiles`, `categories`, `products`, `product_variants`, `orders`, `order_items`
- [ ] Public reads only published+available product data.
- [ ] Public orders/order_items insert allowed; no public updates/deletes.
- [ ] No policy allows self-role escalation.

Verification:
- Use SQL editor to inspect `pg_policies`.
- Attempt forbidden operations with anon/authenticated tokens.

## 5) Mutation Hardening

- [ ] Every `/api/admin/*` mutation validates input with Zod.
- [ ] Every mutation enforces role authorization server-side.
- [ ] Every mutation uses centralized error handling and never returns stack traces.
- [ ] Rate limit is enabled for all admin mutation handlers.

Verification:
- Send malformed payloads and confirm 400 with safe JSON error.
- Send unauthorized requests and confirm 401/403.

## 6) Reliability Controls

- [ ] Optimistic concurrency applied to PATCH endpoints (`updated_at` checks).
- [ ] Order status endpoint is idempotent when status does not change.
- [ ] `order_items.price_at_time` is persisted as immutable snapshot data.
- [ ] Structured logs emitted for route authorization and unhandled errors.

Verification:
- Simulate stale `updatedAt` and confirm 409 conflict.
- Call status update twice with same status and confirm idempotent success.

## 7) Network Layer Defense-in-Depth

- [ ] Admin app uses dedicated subdomain.
- [ ] Cloudflare Access (or equivalent) protects admin ingress.
- [ ] App-level RBAC remains enabled even behind Access.

Verification:
- Attempt direct subdomain access without Access identity; confirm blocked.

