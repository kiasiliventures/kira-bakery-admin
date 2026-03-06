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
  updated_at: string;
};

export type Product = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  base_price: string;
  stock_quantity: number;
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
  customer_id?: string | null;
  customer_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  delivery_method: "delivery" | "pickup" | null;
  delivery_date: string | null;
  notes: string | null;
  status: "Pending" | "In Progress" | "Ready" | "Delivered" | "Cancelled";
  total_ugx: number;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  image: string;
  price_ugx: number;
  price_at_time: number | null;
  quantity: number;
  selected_size: string | null;
  selected_flavor: string | null;
  product_name: string | null;
  variant_name: string | null;
  created_at: string;
};
