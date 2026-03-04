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
  const { data } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as Order[];
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

