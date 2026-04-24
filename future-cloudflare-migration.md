# Future Cloudflare Migration

Status: keep this file untracked. Do not commit it until the migration approach is fully confirmed.

## Current assessment

This admin app is more Cloudflare-friendly than the bakery storefront, but it is still not a casual free-plan target. It can become a paid Workers candidate after targeted cleanup.

## Migration goal

Prepare `kira-bakery-admin` for a later Cloudflare paid deployment while keeping staff workflows stable.

## Main risks

1. Auth/session and route-guard logic add request overhead.
2. Product image upload/validation uses file buffers.
3. Internal auth helpers use `node:crypto` and `Buffer`.
4. Payment reverify and push-notification helpers add operational complexity.

## Implementation plan

### Phase 1: Clean up runtime assumptions

1. Audit internal auth helpers.
   - Review `src/lib/internal-auth.ts`.
   - Replace Node-only assumptions where practical.
   - Document any remaining Node compatibility requirement.

2. Review auth guard path.
   - Review `proxy.ts` and auth helper files.
   - Make sure the guard path is as small as possible.
   - Remove any work that does not need to happen on every guarded request.

3. Review image upload route.
   - Review `src/app/api/admin/products/[id]/image/route.ts`.
   - Keep validation simple.
   - Avoid image processing during request handling.

### Phase 2: Isolate complexity

1. Separate payment reverify helpers from ordinary admin page rendering.
2. Keep push and notification work clearly separated from UI request paths.
3. Prefer API or background-style boundaries for operational side effects.

### Phase 3: Add Cloudflare deployment scaffolding

1. Install OpenNext Cloudflare adapter.
2. Install `wrangler`.
3. Add config files with comments.
4. Document env mapping and secrets.

### Phase 4: Validate key admin flows

1. Login.
2. Orders list.
3. Order detail.
4. Product edit.
5. Product image upload.
6. Payment reverify.

### Phase 5: Rollout plan

1. Keep Vercel as rollback.
2. Use a preview environment first.
3. Only cut over after an internal admin test session covers the full core workflow.

## Recommendation

Do not make this the first bakery repo to migrate. It is a later step after the simpler repos and after the storefront decision is settled.

## Definition of done

- Login works.
- Orders and products work.
- Image upload works.
- Preview logs show no runtime compatibility failures.
