import "server-only";

import { badRequest, conflict, notFound } from "@/lib/http/errors";
import { fetchWithTimeout } from "@/lib/http/fetch";
import { requireEnv } from "@/lib/env";
import {
  requireInternalRequestSigningSecret,
  signInternalRequestToken,
} from "@/lib/internal-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NormalizedPaymentVerificationState = "paid" | "failed" | "cancelled" | "pending";
const PENDING_PAYMENT_SOFT_CANCELLATION_MS = 15 * 60_000;
export const PENDING_PAYMENT_RECONCILE_LOOKBACK_MS = 2 * 60 * 60_000;
export const PENDING_PAYMENT_REVERIFY_THROTTLE_MS = 5 * 60_000;
export const PENDING_PAYMENT_RECONCILE_SCAN_LIMIT = 50;
export const PENDING_PAYMENT_RECONCILE_VERIFY_LIMIT = 10;
const cancellablePendingStatuses = [
  "Pending",
  "pending",
  "Pending Payment",
  "pending payment",
  "pending_payment",
];

export type OrderPaymentRecord = {
  id: string;
  total_ugx: number | null;
  total_price: number | null;
  status: string;
  payment_status: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  payment_redirect_url: string | null;
  order_tracking_id: string | null;
  payment_last_verified_at: string | null;
  paid_at: string | null;
  inventory_deducted_at: string | null;
  fulfillment_review_required: boolean | null;
  fulfillment_review_reason: string | null;
  inventory_conflict: boolean | null;
  inventory_deduction_status: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderPaymentReverifyResult = {
  order: OrderPaymentRecord;
  providerStatus: string | null;
  paymentStatus: NormalizedPaymentVerificationState;
  updated: boolean;
};

export type PendingTrackedPaymentsReconcileStats = {
  scanned: number;
  verified: number;
  updated: number;
  skipped: number;
  skippedRecentlyVerified: number;
  skippedOverCap: number;
  errors: number;
  verifiedOrderIds: string[];
  updatedOrderIds: string[];
  skippedOrderIds: string[];
  errorOrderIds: string[];
};

type PaymentAuthorityVerificationResult = {
  ok: boolean;
  orderId: string;
  provider: string;
  verificationState: NormalizedPaymentVerificationState;
  providerStatus: string | null;
  stickyPaid: boolean;
  wasAlreadyPaid: boolean;
  isNowPaid: boolean;
  justBecamePaid: boolean;
  amountExpected: number;
  amountReceived: number | null;
  currency: string;
  providerTrackingId: string | null;
  merchantReference: string;
  paymentReference: string | null;
  updated: boolean;
  orderSnapshot: unknown;
  message: string;
};

const PAYMENT_AUTHORITY_TIMEOUT_MS = 8_000;
const PAYMENT_VERIFY_PURPOSE = "payment_authority_verify";

export const orderPaymentSelection = [
  "id",
  "total_ugx",
  "total_price",
  "status",
  "payment_status",
  "payment_provider",
  "payment_reference",
  "payment_redirect_url",
  "order_tracking_id",
  "payment_last_verified_at",
  "paid_at",
  "inventory_deducted_at",
  "fulfillment_review_required",
  "fulfillment_review_reason",
  "inventory_conflict",
  "inventory_deduction_status",
  "created_at",
  "updated_at",
].join(",");

function isOrderPaymentRecord(value: unknown): value is OrderPaymentRecord {
  return (
    typeof value === "object"
    && value !== null
    && "id" in value
    && typeof value.id === "string"
    && "status" in value
    && typeof value.status === "string"
    && "created_at" in value
    && typeof value.created_at === "string"
    && "updated_at" in value
    && typeof value.updated_at === "string"
  );
}

function normalizeStoredPaymentStatus(paymentStatus: string | null | undefined): NormalizedPaymentVerificationState {
  const normalized = paymentStatus?.trim().toLowerCase();
  if (!normalized || normalized === "unpaid") {
    return "pending";
  }

  if (normalized === "paid" || normalized === "completed") {
    return "paid";
  }

  if (normalized === "failed" || normalized === "payment_failed" || normalized === "reversed") {
    return "failed";
  }

  if (normalized === "cancelled" || normalized === "canceled" || normalized === "invalid") {
    return "cancelled";
  }

  return "pending";
}

function isPendingPaymentVerificationState(paymentStatus: string | null | undefined) {
  return normalizeStoredPaymentStatus(paymentStatus) === "pending";
}

function isPendingOrderLifecycleState(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase();
  return normalized === "pending payment" || normalized === "pending_payment" || normalized === "pending";
}

function isOrderOlderThanPendingExpiryWindow(createdAt: string) {
  const createdAtMs = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }

  return Date.now() - createdAtMs >= PENDING_PAYMENT_SOFT_CANCELLATION_MS;
}

function isOlderThanThreshold(value: string | null | undefined, thresholdMs: number, nowMs: number) {
  if (!value) {
    return true;
  }

  const parsedMs = Date.parse(value);
  if (!Number.isFinite(parsedMs)) {
    return true;
  }

  return nowMs - parsedMs >= thresholdMs;
}

function hasPaymentFieldsChanged(previous: OrderPaymentRecord, next: OrderPaymentRecord): boolean {
  return (
    next.updated_at !== previous.updated_at
    || next.payment_status !== previous.payment_status
    || next.payment_reference !== previous.payment_reference
    || next.payment_provider !== previous.payment_provider
    || next.paid_at !== previous.paid_at
    || next.inventory_deducted_at !== previous.inventory_deducted_at
    || next.fulfillment_review_required !== previous.fulfillment_review_required
    || next.fulfillment_review_reason !== previous.fulfillment_review_reason
    || next.inventory_conflict !== previous.inventory_conflict
    || next.inventory_deduction_status !== previous.inventory_deduction_status
  );
}

function getPaymentAuthorityBaseUrl(): string {
  return requireEnv("PAYMENT_AUTHORITY_BASE_URL").replace(/\/+$/, "");
}

function getPaymentAuthoritySigningSecret(): string {
  return requireInternalRequestSigningSecret("INTERNAL_PAYMENT_AUTHORITY_TOKEN");
}

async function parseAuthorityResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Unexpected payment authority response (${response.status}): ${text}`);
  }
}

function isPaymentAuthorityVerificationResult(value: unknown): value is PaymentAuthorityVerificationResult {
  return (
    typeof value === "object"
    && value !== null
    && "ok" in value
    && "verificationState" in value
    && "message" in value
  );
}

async function callPaymentAuthority(order: OrderPaymentRecord): Promise<PaymentAuthorityVerificationResult> {
  if (!order.order_tracking_id) {
    throw badRequest("Order does not have a payment tracking ID yet");
  }

  const path = `/api/internal/payments/orders/${order.id}/verify`;
  const url = `${getPaymentAuthorityBaseUrl()}${path}`;
  const token = signInternalRequestToken({
    secret: getPaymentAuthoritySigningSecret(),
    issuer: "kira-bakery-admin",
    audience: "kira-bakery-storefront",
    purpose: PAYMENT_VERIFY_PURPOSE,
    method: "POST",
    path,
    orderId: order.id,
  });
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      source: "admin_reverify",
    }),
    cache: "no-store",
  }, {
    operationName: "Payment authority verification",
    timeoutMs: PAYMENT_AUTHORITY_TIMEOUT_MS,
  });
  const payload = await parseAuthorityResponse(response);

  if (!response.ok) {
    const message =
      isPaymentAuthorityVerificationResult(payload)
        ? payload.message
        : payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : `Payment authority request failed (${response.status}).`;

    if (response.status === 400) {
      throw badRequest(message);
    }

    if (response.status === 409) {
      throw conflict(message);
    }

    throw new Error(message);
  }

  if (!isPaymentAuthorityVerificationResult(payload)) {
    throw new Error("Payment authority returned an unexpected response.");
  }

  if (!payload.ok) {
    throw conflict(payload.message);
  }

  return payload;
}

export async function getOrderPaymentRecord(orderId: string): Promise<OrderPaymentRecord | null> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(orderPaymentSelection)
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(`Order payment lookup failed: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  if (!isOrderPaymentRecord(data)) {
    throw new Error("Order payment lookup returned an unexpected row shape.");
  }

  return data;
}

export async function listRecentTrackedPendingOrders(options?: {
  now?: Date;
  lookbackMs?: number;
  limit?: number;
}): Promise<OrderPaymentRecord[]> {
  const now = options?.now ?? new Date();
  const lookbackMs = options?.lookbackMs ?? PENDING_PAYMENT_RECONCILE_LOOKBACK_MS;
  const createdAfter = new Date(now.getTime() - lookbackMs).toISOString();
  const supabaseAdmin = createSupabaseAdminClient();
  let query = supabaseAdmin
    .from("orders")
    .select(orderPaymentSelection)
    .eq("status", "Pending Payment")
    .not("order_tracking_id", "is", null)
    .gte("created_at", createdAfter)
    .order("created_at", { ascending: false });

  if (typeof options?.limit === "number" && Number.isFinite(options.limit)) {
    query = query.limit(Math.max(1, Math.min(200, Math.trunc(options.limit))));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Pending tracked order lookup failed: ${error.message}`);
  }

  return ((data ?? []) as unknown[]).filter(isOrderPaymentRecord);
}

function isTrackedPendingOrderEligibleForReconcile(
  order: OrderPaymentRecord,
  nowMs: number,
  throttleMs: number,
) {
  return (
    isPendingOrderLifecycleState(order.status)
    && isPendingPaymentVerificationState(order.payment_status)
    && Boolean(order.order_tracking_id)
    && isOlderThanThreshold(order.payment_last_verified_at, throttleMs, nowMs)
  );
}

export async function reconcilePendingTrackedPayments(options?: {
  now?: Date;
  lookbackMs?: number;
  scanLimit?: number;
  verifyLimit?: number;
  throttleMs?: number;
  listOrders?: (options?: { now?: Date; lookbackMs?: number; limit?: number }) => Promise<OrderPaymentRecord[]>;
  reverify?: (order: OrderPaymentRecord) => Promise<OrderPaymentReverifyResult>;
}): Promise<PendingTrackedPaymentsReconcileStats> {
  const now = options?.now ?? new Date();
  const nowMs = now.getTime();
  const throttleMs = options?.throttleMs ?? PENDING_PAYMENT_REVERIFY_THROTTLE_MS;
  const verifyLimit = options?.verifyLimit ?? PENDING_PAYMENT_RECONCILE_VERIFY_LIMIT;
  const listOrders = options?.listOrders ?? listRecentTrackedPendingOrders;
  const reverify = options?.reverify ?? reverifyOrderPayment;
  const scannedOrders = await listOrders({
    now,
    lookbackMs: options?.lookbackMs,
    limit: options?.scanLimit,
  });

  const eligibleOrders: OrderPaymentRecord[] = [];
  const skippedOrderIds: string[] = [];
  let skippedRecentlyVerified = 0;

  for (const order of scannedOrders) {
    if (isTrackedPendingOrderEligibleForReconcile(order, nowMs, throttleMs)) {
      eligibleOrders.push(order);
      continue;
    }

    skippedOrderIds.push(order.id);
    skippedRecentlyVerified += 1;
  }

  const ordersToVerify = eligibleOrders.slice(0, verifyLimit);
  const skippedOverCap = Math.max(0, eligibleOrders.length - ordersToVerify.length);
  if (skippedOverCap > 0) {
    skippedOrderIds.push(...eligibleOrders.slice(verifyLimit).map((order) => order.id));
  }

  const verifiedOrderIds: string[] = [];
  const updatedOrderIds: string[] = [];
  const errorOrderIds: string[] = [];

  for (const order of ordersToVerify) {
    try {
      const result = await reverify(order);
      verifiedOrderIds.push(order.id);
      if (result.updated) {
        updatedOrderIds.push(order.id);
      }
    } catch {
      errorOrderIds.push(order.id);
    }
  }

  return {
    scanned: scannedOrders.length,
    verified: verifiedOrderIds.length,
    updated: updatedOrderIds.length,
    skipped: skippedOrderIds.length,
    skippedRecentlyVerified,
    skippedOverCap,
    errors: errorOrderIds.length,
    verifiedOrderIds,
    updatedOrderIds,
    skippedOrderIds,
    errorOrderIds,
  };
}

async function markPendingOrderCancelled(
  order: Pick<OrderPaymentRecord, "id" | "updated_at">,
): Promise<{ order: OrderPaymentRecord; cancelled: boolean }> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      status: "Cancelled",
      order_status: "cancelled",
      payment_status: "cancelled",
    })
    .eq("id", order.id)
    .eq("updated_at", order.updated_at)
    .in("status", cancellablePendingStatuses)
    .select(orderPaymentSelection)
    .maybeSingle();

  if (error) {
    throw new Error(`Pending-order cancellation failed: ${error.message}`);
  }

  if (isOrderPaymentRecord(data)) {
    return { order: data, cancelled: true };
  }

  const latestOrder = await getOrderPaymentRecord(order.id);
  if (!latestOrder) {
    throw notFound("Order not found");
  }

  return {
    order: latestOrder,
    cancelled:
      latestOrder.status.trim().toLowerCase() === "cancelled"
      || normalizeStoredPaymentStatus(latestOrder.payment_status) === "cancelled",
  };
}

async function markExpiredPendingOrderCancelled(
  order: OrderPaymentRecord,
): Promise<OrderPaymentRecord> {
  const result = await markPendingOrderCancelled(order);
  return result.order;
}

export async function reverifyOrderPayment(
  order: OrderPaymentRecord,
): Promise<OrderPaymentReverifyResult> {
  if (!order.order_tracking_id) {
    if (
      isPendingOrderLifecycleState(order.status)
      && isPendingPaymentVerificationState(order.payment_status)
      && isOrderOlderThanPendingExpiryWindow(order.created_at)
    ) {
      const latestOrder = await markExpiredPendingOrderCancelled(order);
      return {
        order: latestOrder,
        providerStatus: null,
        paymentStatus: normalizeStoredPaymentStatus(latestOrder.payment_status),
        updated: hasPaymentFieldsChanged(order, latestOrder),
      };
    }

    return {
      order,
      providerStatus: null,
      paymentStatus: normalizeStoredPaymentStatus(order.payment_status),
      updated: false,
    };
  }

  const authorityResult = await callPaymentAuthority(order);
  let latestOrder = await getOrderPaymentRecord(order.id);

  if (!latestOrder) {
    throw notFound("Order not found");
  }

  if (
    authorityResult.verificationState === "pending"
    && isPendingOrderLifecycleState(latestOrder.status)
    && isPendingPaymentVerificationState(latestOrder.payment_status)
    && isOrderOlderThanPendingExpiryWindow(latestOrder.created_at)
  ) {
    latestOrder = await markExpiredPendingOrderCancelled(latestOrder);
  }

  return {
    order: latestOrder,
    providerStatus: authorityResult.providerStatus,
    paymentStatus: normalizeStoredPaymentStatus(latestOrder.payment_status ?? authorityResult.verificationState),
    updated: hasPaymentFieldsChanged(order, latestOrder),
  };
}
