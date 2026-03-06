import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Category,
  Order,
  OrderItem,
  Product,
  ProductVariant,
  Profile,
} from "@/lib/types/domain";

type ModernOrderRow = Order;

type LegacyOrderRow = {
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

function mapLegacyOrderStatus(status: string): Order["status"] {
  if (status === "pending" || status === "confirmed") return "Pending";
  if (status === "preparing" || status === "out_for_delivery") return "In Progress";
  if (status === "ready_for_pickup") return "Ready";
  if (status === "cancelled") return "Cancelled";
  return "Delivered";
}

export async function getDashboardMetrics() {
  const supabase = await createSupabaseServerClient();

  const [products, orders, categories] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id", { count: "exact", head: true }),
  ]);

  return {
    productCount: products.count ?? 0,
    orderCount: orders.count ?? 0,
    categoryCount: categories.count ?? 0,
  };
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data ?? []) as Category[];
}

export async function getProducts(): Promise<Product[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as Product[];
}

export async function getProductById(id: string): Promise<Product | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  return (data as Product | null) ?? null;
}

export async function getVariantsByProductId(productId: string): Promise<ProductVariant[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  return (data ?? []) as ProductVariant[];
}

export async function getOrders(): Promise<Order[]> {
  const supabase = await createSupabaseServerClient();
  const modern = await supabase
    .from("orders")
    .select("id,customer_id,customer_name,phone,email,address,delivery_method,delivery_date,notes,status,total_ugx,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (modern.error?.code === "42703") {
    const legacy = await supabase
      .from("orders")
      .select(
        "id,customer_name,customer_phone,customer_email,delivery_address,order_status,payment_status,total_price,created_at,updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    return ((legacy.data ?? []) as LegacyOrderRow[]).map((order) => ({
      id: order.id,
      customer_name: order.customer_name,
      phone: order.customer_phone,
      email: order.customer_email,
      address: order.delivery_address,
      delivery_method: order.delivery_address ? "delivery" : "pickup",
      delivery_date: null,
      notes: null,
      status: mapLegacyOrderStatus(order.order_status),
      total_ugx: Math.round(Number(order.total_price)),
      created_at: order.created_at,
      updated_at: order.updated_at,
    }));
  }

  return ((modern.data ?? []) as ModernOrderRow[]).map((order) => ({
    ...order,
    status: (order.status ?? "Pending") as Order["status"],
  }));
}

export async function getOrderItemsByOrderIds(orderIds: string[]): Promise<OrderItem[]> {
  if (orderIds.length === 0) {
    return [];
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("order_items")
    .select("*")
    .in("order_id", orderIds);
  return (data ?? []) as OrderItem[];
}

export async function getProfiles(): Promise<Profile[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as Profile[];
}
