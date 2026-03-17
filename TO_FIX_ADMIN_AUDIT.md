# Admin Audit Follow-Ups

Date: 2026-03-08

This file tracks issues found during a security and usability audit that should be addressed later.

## Accepted Decision

- Manual staff order approval is no longer part of the live order flow.
  Reason: payment is now handled through Pesapal verification, and inventory deduction happens after verified payment instead of manual approval.
  Note: any future operational safeguard should be evaluated against the automated payment lifecycle rather than restoring the old approve/cancel workflow.

## To Fix

### Security

- Add CSRF protection for cookie-authenticated mutation routes.
  Current state: admin API routes authorize using the current Supabase session cookie, but there is no explicit Origin/Referer or CSRF-token validation.
  Updated assessment:
  - current risk is lower than first assumed because the installed `@supabase/ssr` defaults use `SameSite=Lax`
  - however, the app still relies on cookie behavior rather than explicit request validation
  Impact: risk is reduced, but not intentionally controlled by the app.
  Likely touchpoints:
  - `src/lib/http/admin-route.ts`
  - `src/app/api/auth/logout/route.ts`
  - any other mutating authenticated routes

- Review auth cookie hardening.
  Current state:
  - Supabase SSR defaults currently include `SameSite=Lax`
  - current defaults also expose cookies/session state without `httpOnly`
  Impact:
  - CSRF risk is lowered by `Lax`
  - XSS impact is worse if browser-readable auth/session cookies remain necessary
  Likely touchpoints:
  - `src/lib/supabase/browser.ts`
  - `src/lib/supabase/server.ts`
  - Supabase SSR cookie configuration strategy

### Reliability

- Remove locale-based hydration mismatch risk on the orders page.
  Current state: `new Date(order.created_at).toLocaleString()` is rendered in a client component.
  Impact: server-rendered and client-rendered output can differ by locale/timezone and produce hydration warnings.
  Likely touchpoint:
  - `src/components/admin/order-status-manager.tsx`
  Preferred direction:
  - format on the server and pass a stable string, or
  - render a deterministic format first, then enhance on the client after mount.

- Make batch product creation more transactional.
  Current state: products are created first, then images upload separately from the browser.
  Impact: partial success can leave products created without images.
  Likely touchpoints:
  - `src/app/api/admin/products/route.ts`
  - `src/components/admin/product-manager.tsx`
  Preferred direction:
  - move create + image upload into one orchestrated server flow, or
  - add rollback/cleanup for failed image uploads, or
  - explicitly support draft/no-image creation as a first-class state.

- Replace orders-page realtime route refresh with local state reconciliation.
  Current state: the full orders page still uses realtime events to drive `router.refresh()` and also refreshes immediately after manual order actions.
  Impact: heavier route-level re-fetch work, duplicate refreshes after manual actions, and unnecessary load as order activity increases.
  Likely touchpoints:
  - `src/components/admin/order-status-manager.tsx`
  - `src/components/admin/use-orders-realtime.ts`
  - `src/lib/orders-realtime.ts`
  Preferred direction:
  - mirror the newer dashboard recent-orders approach
  - patch affected orders in client state by order id
  - keep route refresh only as a fallback/recovery path

- Improve failed-load behavior for admin order/dashboard data.
  Current state: several server queries can silently fall back to empty/zero-like UI instead of showing a visible failure state.
  Impact: operators may see "No orders found" or misleading dashboard numbers during transient backend failures.
  Likely touchpoints:
  - `src/lib/supabase/queries.ts`
  - `src/app/(admin)/orders/page.tsx`
  - `src/app/(admin)/page.tsx`
  - `src/components/admin/order-status-manager.tsx`
  - `src/components/admin/dashboard-recent-orders.tsx`
  Preferred direction:
  - surface explicit loading/retry/error states
  - distinguish "empty data" from "failed refresh"

- Add timeout/abort protection to payment reverification.
  Current state: payment reverification depends on an external storefront payment-status request without explicit timeout or abort handling.
  Impact: slow upstream responses can hang operator actions and cause avoidable retries under operational pressure.
  Likely touchpoints:
  - `src/lib/payments/storefront.ts`
  - `src/app/api/admin/orders/[id]/reverify-payment/route.ts`
  Preferred direction:
  - add `AbortController` timeout handling
  - return clearer operator-facing retry guidance for slow upstream failures

- Revisit realtime fallback polling behavior.
  Current state: when realtime disconnects or times out, the admin realtime layer falls back to periodic refresh-driven recovery.
  Impact: acceptable as a safety net, but still expensive if reconnect issues happen during service hours.
  Likely touchpoints:
  - `src/lib/orders-realtime.ts`
  - `src/components/admin/use-orders-realtime.ts`
  Preferred direction:
  - keep fallback behavior, but reduce the amount of route-level work it triggers
  - consider targeted reconciliation before full refresh when possible

- Plan for larger order volume in the admin queries.
  Current state: order reads are capped to the newest 100 orders and eagerly include nested order items.
  Impact: fine for current expected traffic, but this becomes the next scaling wall as admin volume grows.
  Likely touchpoints:
  - `src/lib/supabase/queries.ts`
  - `src/app/(admin)/orders/page.tsx`
  Preferred direction:
  - add pagination/filtering for the orders page
  - reduce unnecessary nested data on list views where possible

### Usability

- Add proper client-side validation to the edit product page.
  Current state: invalid values mostly fail only after a server round trip.
  Impact: weaker editing UX and less clear recovery when fields are incomplete or malformed.
  Likely touchpoint:
  - `src/components/admin/product-detail-manager.tsx`
  Preferred direction:
  - validate category, name, price, and stock before submit
  - show field-level errors, not only a general status message
  - disable save when required fields are invalid

- Improve product search/filter behavior for larger catalogs.
  Current state: search only matches product name and description.
  Impact: harder admin workflows as catalog size grows.
  Likely touchpoint:
  - `src/components/admin/product-manager.tsx`
  Possible improvements:
  - include category in search
  - add stock-state filtering
  - optionally add exact product ID/reference search

- Rework dashboard KPI freshness and consistency.
  Current state: the recent-orders widget now updates locally, but dashboard KPIs still depend on broader route/server query behavior and are not aligned with the lighter realtime path.
  Impact: operators can get a live-feeling recent-orders list while summary cards lag or use different query assumptions.
  Likely touchpoints:
  - `src/app/(admin)/page.tsx`
  - `src/lib/supabase/queries.ts`
  Preferred direction:
  - define whether KPI cards should be realtime, periodic, or manual refresh
  - give them a dedicated lightweight update path if realtime accuracy is required

### Maintainability

- Revisit admin image rendering strategy.
  Current state: admin product views use plain `<img>` tags to avoid `next/image` hostname and hydration issues.
  Impact: acceptable short term, but image handling is now a workaround rather than a clean long-term solution.
  Likely touchpoints:
  - `src/components/admin/product-manager.tsx`
  - `src/components/admin/product-detail-manager.tsx`
  Preferred direction:
  - either keep `<img>` intentionally and document that choice for admin surfaces, or
  - implement a stable image component strategy that works with Supabase URLs and local previews.

- Consider cross-tab coordination for admin realtime consumers.
  Current state: realtime subscription sharing is per browser tab/runtime, not across multiple tabs.
  Impact: low for the current one-computer operational model, but duplicated work returns if staff workflows later involve multiple open admin tabs.
  Likely touchpoints:
  - `src/lib/orders-realtime.ts`
  Preferred direction:
  - defer unless the ops model changes
  - if needed later, coordinate across tabs with browser primitives instead of duplicating subscriptions/work

## Missing Coverage

- Add automated tests for admin auth, order status transitions, and product CRUD flows.
  Current state: no test/spec coverage was found for these critical flows.
  Impact: regressions are likely to be caught late and manually.

## Hardening Plan

### Phase 1: Immediate App-Level Protection

- Add `Origin` validation to all authenticated mutation routes.
  Scope:
  - `POST`
  - `PATCH`
  - `PUT`
  - `DELETE`
  Implementation direction:
  - centralize this inside `src/lib/http/admin-route.ts`
  - reject requests when `Origin` is missing or does not match the app origin, unless there is an explicit safe exception

- Add the same protection to logout.
  Scope:
  - `src/app/api/auth/logout/route.ts`
  Reason:
  - logout is state-changing and should not rely only on cookie behavior

### Phase 2: Cookie Hardening Review

- Confirm the final production cookie attributes used by Supabase auth in deployment.
  Verify:
  - `SameSite`
  - `Secure`
  - `HttpOnly`
  - domain/path behavior

- Keep `SameSite=Lax` at minimum.
  If product flows allow it, evaluate stricter settings where possible.

- Investigate whether auth/session cookies can be made `HttpOnly` without breaking current login/session flows.
  Note:
  - this may require a broader auth architecture change
  - do not change this blindly without validating Supabase browser-session behavior

### Phase 3: Defense in Depth

- Add explicit request validation for mutating routes even if cookie policy already helps.
  Examples:
  - strict content-type expectations
  - optional anti-CSRF token for sensitive admin actions
  - tighter route-level audit logging for failed origin checks

- Re-audit XSS exposure after cookie strategy is finalized.
  Reason:
  - browser-readable auth/session state increases the blast radius of any future XSS issue
