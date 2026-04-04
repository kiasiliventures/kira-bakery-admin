import "server-only";
import { deriveAdminDisplayOrderStatus, normalizeAdminPaymentStatus } from "@/lib/order-display-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Category, Order, OrderItem, Product, ProductVariant, Profile } from "@/lib/types/domain";

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

type OrderItemRelation = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  name?: string | null;
  image?: string | null;
  price_ugx?: number | null;
  price_at_time?: number | string | null;
  quantity: number;
  selected_size?: string | null;
  selected_flavor?: string | null;
  inventory_allocation_status?: string | null;
  inventory_deducted_quantity?: number | null;
  inventory_conflict_quantity?: number | null;
  inventory_conflict_reason?: string | null;
  inventory_deducted_at?: string | null;
  created_at: string;
  products?: { name: string | null } | Array<{ name: string | null }> | null;
  product_variants?: { name: string | null } | Array<{ name: string | null }> | null;
};

type ModernOrderRowWithItems = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  delivery_method: "delivery" | "pickup" | null;
  delivery_date: string | null;
  notes: string | null;
  status: string;
  payment_status: string | null;
  order_tracking_id: string | null;
  paid_at: string | null;
  inventory_deducted_at: string | null;
  fulfillment_review_required: boolean | null;
  fulfillment_review_reason: string | null;
  inventory_conflict: boolean | null;
  inventory_deduction_status: string | null;
  total_ugx: number;
  created_at: string;
  updated_at: string;
  order_items: OrderItemRelation[] | null;
};

type LegacyOrderRowWithItems = LegacyOrderRow & {
  order_items: OrderItemRelation[] | null;
};

const modernOrderSelection =
  "id,customer_id,customer_name,phone,email,address,delivery_method,delivery_date,notes,status,payment_status,order_tracking_id,paid_at,inventory_deducted_at,fulfillment_review_required,fulfillment_review_reason,inventory_conflict,inventory_deduction_status,total_ugx,created_at,updated_at,order_items(id,order_id,product_id,variant_id,name,image,price_ugx,price_at_time,quantity,selected_size,selected_flavor,inventory_allocation_status,inventory_deducted_quantity,inventory_conflict_quantity,inventory_conflict_reason,inventory_deducted_at,created_at,products(name),product_variants(name))";

const legacyOrderSelection =
  "id,customer_name,customer_phone,customer_email,delivery_address,order_status,payment_status,total_price,created_at,updated_at,order_items(id,order_id,product_id,variant_id,quantity,price_at_time,created_at,products(name),product_variants(name))";

function sanitizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseWholeNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }

  return null;
}

function getRelatedName(
  relation: { name: string | null } | Array<{ name: string | null }> | null | undefined,
): string | null {
  if (Array.isArray(relation)) {
    return sanitizeText(relation[0]?.name);
  }

  return sanitizeText(relation?.name);
}

function mapOrderItem(item: OrderItemRelation): OrderItem {
  const productName = getRelatedName(item.products);
  const variantName = getRelatedName(item.product_variants);

  return {
    id: item.id,
    order_id: item.order_id,
    product_id: item.product_id,
    variant_id: item.variant_id,
    name: sanitizeText(item.name) ?? productName ?? variantName ?? "Product",
    image: sanitizeText(item.image) ?? "",
    price_ugx: parseWholeNumber(item.price_ugx ?? item.price_at_time) ?? 0,
    price_at_time: parseWholeNumber(item.price_at_time),
    quantity: Number.isInteger(item.quantity) ? item.quantity : 0,
    selected_size: sanitizeText(item.selected_size),
    selected_flavor: sanitizeText(item.selected_flavor),
    inventory_allocation_status: sanitizeText(item.inventory_allocation_status),
    inventory_deducted_quantity: parseWholeNumber(item.inventory_deducted_quantity) ?? 0,
    inventory_conflict_quantity: parseWholeNumber(item.inventory_conflict_quantity) ?? 0,
    inventory_conflict_reason: sanitizeText(item.inventory_conflict_reason),
    inventory_deducted_at: item.inventory_deducted_at ?? null,
    product_name: productName,
    variant_name: variantName,
    created_at: item.created_at,
  };
}

function sortOrderItems(items: OrderItemRelation[] | null | undefined): OrderItem[] {
  return [...(items ?? [])]
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .map(mapOrderItem);
}

function mapLegacyOrder(order: LegacyOrderRowWithItems): Order {
  return {
    id: order.id,
    customer_name: order.customer_name,
    phone: order.customer_phone,
    email: order.customer_email,
    address: order.delivery_address,
    delivery_method: order.delivery_address ? "delivery" : "pickup",
    delivery_date: null,
    notes: null,
    status: deriveAdminDisplayOrderStatus({
      status: order.order_status,
      paymentStatus: order.payment_status,
    }),
    payment_status: normalizeAdminPaymentStatus(order.payment_status),
    order_tracking_id: null,
    paid_at: null,
    inventory_deducted_at: null,
    fulfillment_review_required: false,
    fulfillment_review_reason: null,
    inventory_conflict: false,
    inventory_deduction_status: null,
    total_ugx: Math.round(Number(order.total_price)),
    created_at: order.created_at,
    updated_at: order.updated_at,
    items: sortOrderItems(order.order_items),
  };
}

function mapModernOrder(order: ModernOrderRowWithItems): Order {
  return {
    id: order.id,
    customer_id: order.customer_id,
    customer_name: order.customer_name,
    phone: order.phone,
    email: order.email,
    address: order.address,
    delivery_method: order.delivery_method,
    delivery_date: order.delivery_date,
    notes: order.notes,
    status: deriveAdminDisplayOrderStatus({
      status: order.status,
      paymentStatus: order.payment_status,
      fulfillmentReviewRequired: order.fulfillment_review_required,
      inventoryConflict: order.inventory_conflict,
    }),
    payment_status: normalizeAdminPaymentStatus(order.payment_status),
    order_tracking_id: sanitizeText(order.order_tracking_id),
    paid_at: order.paid_at,
    inventory_deducted_at: order.inventory_deducted_at,
    fulfillment_review_required: Boolean(order.fulfillment_review_required),
    fulfillment_review_reason: sanitizeText(order.fulfillment_review_reason),
    inventory_conflict: Boolean(order.inventory_conflict),
    inventory_deduction_status: sanitizeText(order.inventory_deduction_status),
    total_ugx: order.total_ugx,
    created_at: order.created_at,
    updated_at: order.updated_at,
    items: sortOrderItems(order.order_items),
  };
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
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  return (data ?? []) as Category[];
}

export async function getProducts(): Promise<Product[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
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

export async function getOrders(options?: { limit?: number }): Promise<Order[]> {
  const supabase = await createSupabaseServerClient();
  const limit = Math.max(1, Math.min(100, Math.trunc(options?.limit ?? 100)));
  const modern = await supabase
    .from("orders")
    .select(modernOrderSelection)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (modern.error?.code === "42703") {
    const legacy = await supabase
      .from("orders")
      .select(legacyOrderSelection)
      .order("created_at", { ascending: false })
      .limit(limit);

    return ((legacy.data ?? []) as LegacyOrderRowWithItems[]).map(mapLegacyOrder);
  }

  return ((modern.data ?? []) as ModernOrderRowWithItems[]).map(mapModernOrder);
}

export async function getOrderById(id: string): Promise<Order | null> {
  const supabase = await createSupabaseServerClient();
  const modern = await supabase
    .from("orders")
    .select(modernOrderSelection)
    .eq("id", id)
    .maybeSingle();

  if (modern.error?.code === "42703") {
    const legacy = await supabase
      .from("orders")
      .select(legacyOrderSelection)
      .eq("id", id)
      .maybeSingle();

    if (legacy.error) {
      throw new Error(`Failed to load order: ${legacy.error.message}`);
    }

    if (!legacy.data) {
      return null;
    }

    return mapLegacyOrder(legacy.data as LegacyOrderRowWithItems);
  }

  if (modern.error) {
    throw new Error(`Failed to load order: ${modern.error.message}`);
  }

  if (!modern.data) {
    return null;
  }

  return mapModernOrder(modern.data as ModernOrderRowWithItems);
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
  return ((data ?? []) as OrderItemRelation[]).map((item) => ({
    ...mapOrderItem(item),
    product_name: null,
    variant_name: null,
  }));
}

export async function getProfiles(): Promise<Profile[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as Profile[];
}
