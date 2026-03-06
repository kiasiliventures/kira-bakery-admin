# Kira Bakery Admin

Premium minimal admin UI built with Next.js 16, TypeScript strict, Tailwind CSS, and reusable shadcn-style components.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Open:

`http://localhost:3000`

## Main routes

- `/` Dashboard Overview
- `/products` Manage Products
- `/products/[id]` Edit Product
- `/inventory` Inventory & Stock Management
- `/orders` Order Board

## Optional Supabase seed

Apply migration `supabase/migrations/202603050001_seed_mock_admin_data.sql` after the initial schema migration to load sample categories, products, variants, and orders.
