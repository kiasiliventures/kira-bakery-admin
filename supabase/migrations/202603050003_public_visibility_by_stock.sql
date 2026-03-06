-- Public visibility should be stock-driven.
-- If stock_quantity is 0, products/variants/categories are hidden from public reads.

drop policy if exists "categories_public_read_published_available" on public.categories;
create policy "categories_public_read_in_stock"
on public.categories for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    where p.category_id = categories.id
      and p.stock_quantity > 0
  )
  or public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role])
);

drop policy if exists "products_public_read_published_available" on public.products;
create policy "products_public_read_in_stock"
on public.products for select
to anon, authenticated
using (
  (stock_quantity > 0)
  or public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role])
);

drop policy if exists "variants_public_read_published_available" on public.product_variants;
create policy "variants_public_read_in_stock"
on public.product_variants for select
to anon, authenticated
using (
  (
    is_available = true
    and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.stock_quantity > 0
    )
  )
  or public.has_role(array['admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role])
);
