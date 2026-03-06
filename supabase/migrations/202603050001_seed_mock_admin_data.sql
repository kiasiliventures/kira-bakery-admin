-- Seed data for Kira Bakery Admin demo UI
-- Run after: 202603040001_initial_admin_schema.sql

begin;

insert into public.categories (id, name, sort_order)
values
  ('11111111-1111-1111-1111-111111111111', 'Cakes', 1),
  ('22222222-2222-2222-2222-222222222222', 'Pastries', 2),
  ('33333333-3333-3333-3333-333333333333', 'Bread', 3),
  ('44444444-4444-4444-4444-444444444444', 'Specials', 4)
on conflict (id) do update
set name = excluded.name,
    sort_order = excluded.sort_order;

insert into public.products
  (id, category_id, name, description, image_url, is_available, is_featured, is_published)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '11111111-1111-1111-1111-111111111111',
    'Signature Vanilla Cake',
    'Soft vanilla sponge layered with fresh cream.',
    'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=500&q=80',
    true,
    true,
    true
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '22222222-2222-2222-2222-222222222222',
    'Butter Croissant',
    'Flaky butter croissant baked at sunrise.',
    'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=500&q=80',
    true,
    false,
    true
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '11111111-1111-1111-1111-111111111111',
    'Chocolate Fudge Cake',
    'Dark cocoa cake with smooth ganache finish.',
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=500&q=80',
    true,
    true,
    true
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    '33333333-3333-3333-3333-333333333333',
    'Sourdough Loaf',
    'Long-fermented loaf with crisp crust.',
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=500&q=80',
    true,
    false,
    true
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5',
    '22222222-2222-2222-2222-222222222222',
    'Fruit Danish',
    'Custard pastry topped with seasonal fruit.',
    'https://images.unsplash.com/photo-1509365465985-25d11c17e812?auto=format&fit=crop&w=500&q=80',
    true,
    false,
    true
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6',
    '44444444-4444-4444-4444-444444444444',
    'Red Velvet Slice',
    'Classic red velvet with cream cheese frosting.',
    'https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?auto=format&fit=crop&w=500&q=80',
    true,
    false,
    true
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7',
    '22222222-2222-2222-2222-222222222222',
    'Greek Yoghurt Cup',
    'Fresh yoghurt cup with fruit puree swirl.',
    'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=500&q=80',
    true,
    false,
    true
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8',
    '44444444-4444-4444-4444-444444444444',
    'Pepperoni Pizza',
    'Stone-baked crust with premium toppings.',
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=500&q=80',
    true,
    false,
    true
  )
on conflict (id) do update
set category_id = excluded.category_id,
    name = excluded.name,
    description = excluded.description,
    image_url = excluded.image_url,
    is_available = excluded.is_available,
    is_featured = excluded.is_featured,
    is_published = excluded.is_published;

insert into public.product_variants (id, product_id, name, price, is_available, sort_order)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '6 inch Vanilla', 60000, true, 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '8 inch Chocolate', 85000, true, 2),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Classic', 8500, true, 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '8 inch Chocolate', 95000, true, 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'Large Loaf', 18000, true, 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'Single', 12000, true, 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', 'Slice', 14000, true, 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7', 'Cup', 9000, true, 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb009', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8', '10 inch', 48000, true, 1)
on conflict (id) do update
set product_id = excluded.product_id,
    name = excluded.name,
    price = excluded.price,
    is_available = excluded.is_available,
    sort_order = excluded.sort_order;

insert into public.orders
  (id, customer_name, customer_phone, customer_email, delivery_address, order_status, payment_status, total_price)
values
  ('cccccccc-cccc-cccc-cccc-ccccccccc001', 'Anita K.', '+256700000001', 'anita@example.com', 'Kololo', 'pending', 'paid', 98000),
  ('cccccccc-cccc-cccc-cccc-ccccccccc002', 'Joel M.', '+256700000002', 'joel@example.com', null, 'preparing', 'paid', 42000),
  ('cccccccc-cccc-cccc-cccc-ccccccccc003', 'Sarah N.', '+256700000003', 'sarah@example.com', null, 'ready', 'paid', 121000),
  ('cccccccc-cccc-cccc-cccc-ccccccccc004', 'Michael P.', '+256700000004', 'michael@example.com', 'Ntinda', 'delivered', 'paid', 56000),
  ('cccccccc-cccc-cccc-cccc-ccccccccc005', 'Amina R.', '+256700000005', 'amina@example.com', 'Naguru', 'pending', 'unpaid', 72000)
on conflict (id) do update
set customer_name = excluded.customer_name,
    customer_phone = excluded.customer_phone,
    customer_email = excluded.customer_email,
    delivery_address = excluded.delivery_address,
    order_status = excluded.order_status,
    payment_status = excluded.payment_status,
    total_price = excluded.total_price;

insert into public.order_items (id, order_id, product_id, variant_id, quantity, price_at_time)
values
  ('dddddddd-dddd-dddd-dddd-ddddddddd001', 'cccccccc-cccc-cccc-cccc-ccccccccc001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002', 1, 85000),
  ('dddddddd-dddd-dddd-dddd-ddddddddd002', 'cccccccc-cccc-cccc-cccc-ccccccccc001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003', 1, 8500),
  ('dddddddd-dddd-dddd-dddd-ddddddddd003', 'cccccccc-cccc-cccc-cccc-ccccccccc002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb009', 1, 42000),
  ('dddddddd-dddd-dddd-dddd-ddddddddd004', 'cccccccc-cccc-cccc-cccc-ccccccccc003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb004', 1, 95000),
  ('dddddddd-dddd-dddd-dddd-ddddddddd005', 'cccccccc-cccc-cccc-cccc-ccccccccc004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb005', 2, 18000),
  ('dddddddd-dddd-dddd-dddd-ddddddddd006', 'cccccccc-cccc-cccc-cccc-ccccccccc005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb006', 2, 12000)
on conflict (id) do update
set order_id = excluded.order_id,
    product_id = excluded.product_id,
    variant_id = excluded.variant_id,
    quantity = excluded.quantity,
    price_at_time = excluded.price_at_time;

commit;
