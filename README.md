# KiRA Bakery Admin (`kira-bakery-admin`)

Production-ready admin dashboard for KiRA Bakery.

## Stack

- Next.js 16+ (App Router)
- TypeScript strict mode
- Tailwind CSS
- Supabase (Postgres, Auth, Storage)
- Zod validation
- Route Handlers for all admin mutations
- ESLint + Prettier

## Security Model (Summary)

- Auth: Supabase email/password.
- Authorization: server-side role checks via `profiles.role`.
- Roles: `admin`, `manager`, `staff`.
- All admin writes are server-side only through `/api/admin/*`.
- `SUPABASE_SERVICE_ROLE_KEY` is used only in server route handlers.
- RLS enabled on all tables.
- Rate limiting + centralized error handling + structured logging.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file:

```bash
cp .env.example .env.local
```

3. Set required variables in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

4. Apply SQL migration:

- Run `supabase/migrations/202603040001_initial_admin_schema.sql` in Supabase SQL editor.

5. Start the app:

```bash
npm run dev
```

6. Open `http://localhost:3000/login`.

## First Admin User (Safe Bootstrap)

1. Create a normal user via Supabase Auth (email/password).
2. Confirm user exists in `auth.users`.
3. Ensure `profiles` row exists (trigger creates it automatically).
4. In Supabase SQL editor, elevate exactly one trusted account:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin-email@example.com';
```

5. Sign in to `/login` with that account.

Important:
- Do not expose service role keys to browser/client bundles.
- Do not assign `admin` broadly.

## API Mutation Endpoints

- `POST /api/admin/categories`
- `PATCH /api/admin/categories/:id`
- `POST /api/admin/products`
- `PATCH /api/admin/products/:id`
- `POST /api/admin/products/:id/image`
- `POST /api/admin/variants`
- `PATCH /api/admin/variants/:id`
- `PATCH /api/admin/orders/:id/status`
- `PATCH /api/admin/users/:id/role` (admin only)

All endpoints:
- Validate with Zod.
- Authenticate from cookies.
- Authorize by role.
- Write with service role key server-side.
- Return typed JSON.

## Vercel Deployment

1. Import this repository in Vercel.
2. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy with:
   - Build command: `npm run build`
   - Output: Next.js default
4. Verify `/login`, `/`, `/orders`, `/products`, `/categories`, `/settings/users`.

## Cloudflare Access Recommendation (Admin Subdomain)

Recommended defense-in-depth for production:

1. Serve admin on dedicated subdomain:
   - `admin.kirabakery.com`
2. Put subdomain behind Cloudflare Access.
3. Require identity provider login before traffic reaches Vercel.
4. Keep Supabase role checks enabled (Cloudflare Access is additive, not replacement).

## Security Notes (Enforced Where)

- Route handlers enforce auth+role server-side.
- RLS policies enforce row access at DB layer.
- `profiles.role` is not user-editable by non-admin users.
- Staff can update `orders.order_status` only (DB trigger + API contract).
- Public order creation allowed via RLS insert policies.

See `SECURITY.md` for verification checklist.

