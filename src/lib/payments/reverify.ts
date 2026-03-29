import "server-only";

import { badRequest, conflict, notFound } from "@/lib/http/errors";
import { requireEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NormalizedPaymentVerificationState = "paid" | "failed" | "cancelled" | "pending";

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
  "paid_at",
  "inventory_deducted_at",
  "fulfillment_review_required",
  "fulfillment_review_reason",
  "inventory_conflict",
  "inventory_deduction_status",
  "created_at",
  "updated_at",
].join(",");

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

function getPaymentAuthorityToken(): string {
  return requireEnv("INTERNAL_PAYMENT_AUTHORITY_TOKEN");
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

  const url = `${getPaymentAuthorityBaseUrl()}/api/internal/payments/orders/${order.id}/verify`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${getPaymentAuthorityToken()}`,
    },
    body: JSON.stringify({
      source: "admin_reverify",
    }),
    cache: "no-store",
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

  return (data as OrderPaymentRecord | null) ?? null;
}

export async function reverifyOrderPayment(
  order: OrderPaymentRecord,
): Promise<OrderPaymentReverifyResult> {
  const authorityResult = await callPaymentAuthority(order);
  const latestOrder = await getOrderPaymentRecord(order.id);

  if (!latestOrder) {
    throw notFound("Order not found");
  }

  return {
    order: latestOrder,
    providerStatus: authorityResult.providerStatus,
    paymentStatus: normalizeStoredPaymentStatus(latestOrder.payment_status ?? authorityResult.verificationState),
    updated: hasPaymentFieldsChanged(order, latestOrder),
  };
}
