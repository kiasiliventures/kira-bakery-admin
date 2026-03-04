export type AppRole = "admin" | "manager" | "staff";

export type Profile = {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type Product = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  price: string;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_address: string | null;
  order_status: string;
  payment_status: string;
  total_price: string;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  price_at_time: string;
  created_at: string;
};

