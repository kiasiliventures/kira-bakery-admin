import "server-only";

import { badRequest, conflict, notFound } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import {
  getPesapalTransactionStatus,
  normalizePesapalPaymentState,
  type NormalizedPesapalPaymentState,
} from "@/lib/payments/pesapal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  created_at: string;
  updated_at: string;
};

export type OrderPaymentReverifyResult = {
  order: OrderPaymentRecord;
  providerStatus: string | null;
  paymentStatus: NormalizedPesapalPaymentState;
  updated: boolean;
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
  "created_at",
  "updated_at",
].join(",");

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeStoredPaymentStatus(paymentStatus: string | null | undefined): NormalizedPesapalPaymentState {
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

function resolveVerifiedPaymentStatus(
  currentStatus: NormalizedPesapalPaymentState,
  verifiedStatus: NormalizedPesapalPaymentState,
): NormalizedPesapalPaymentState {
  if (currentStatus === "paid" && verifiedStatus !== "paid") {
    return currentStatus;
  }

  if (verifiedStatus === "paid") {
    return "paid";
  }

  return verifiedStatus;
}

function resolveStoredOrderAmount(order: OrderPaymentRecord): number {
  return Math.round(Number(order.total_ugx ?? order.total_price ?? 0));
}

function resolveAttemptCurrency(): string {
  return "UGX";
}

async function upsertPaymentAttempt(input: {
  orderId: string;
  provider: string;
  providerReference: string;
  amount: number;
  status: NormalizedPesapalPaymentState;
  redirectUrl?: string | null;
  rawProviderResponse?: unknown;
  createdAt?: string;
  verifiedAt?: string | null;
}) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from("payment_attempts")
    .upsert(
      {
        order_id: input.orderId,
        provider: input.provider,
        provider_reference: input.providerReference,
        amount: input.amount,
        currency: resolveAttemptCurrency(),
        status: input.status,
        redirect_url: input.redirectUrl ?? null,
        raw_provider_response: input.rawProviderResponse ?? null,
        created_at: input.createdAt,
        verified_at: input.verifiedAt ?? null,
      },
      {
        onConflict: "provider,provider_reference",
      },
    );

  if (error) {
    throw new Error(`Payment attempt upsert failed: ${error.message}`);
  }
}

function hasPaymentFieldsChanged(previous: OrderPaymentRecord, next: OrderPaymentRecord): boolean {
  return (
    next.updated_at !== previous.updated_at
    || next.payment_status !== previous.payment_status
    || next.payment_reference !== previous.payment_reference
    || next.payment_provider !== previous.payment_provider
    || next.paid_at !== previous.paid_at
    || next.inventory_deducted_at !== previous.inventory_deducted_at
  );
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

export async function reverifyPesapalOrderPayment(
  order: OrderPaymentRecord,
): Promise<OrderPaymentReverifyResult> {
  const supabaseAdmin = createSupabaseAdminClient();
  const orderTrackingId = normalizeText(order.order_tracking_id);

  if (!orderTrackingId) {
    throw badRequest("Order does not have a payment tracking ID yet");
  }

  const currentProvider = normalizeText(order.payment_provider);
  if (currentProvider && currentProvider !== "pesapal") {
    throw badRequest("Order is assigned to a different payment provider.");
  }

  const providerResponse = await getPesapalTransactionStatus(orderTrackingId);
  const providerStatus = normalizeText(providerResponse.payment_status_description);
  const verifiedPaymentStatus = normalizePesapalPaymentState(providerStatus);
  const currentPaymentStatus = normalizeStoredPaymentStatus(order.payment_status);
  const nextPaymentStatus = resolveVerifiedPaymentStatus(currentPaymentStatus, verifiedPaymentStatus);
  const nextPaymentProvider = currentProvider ?? "pesapal";
  const nextPaymentReference =
    normalizeText(providerResponse.confirmation_code) ?? normalizeText(order.payment_reference);
  const expectedAmount = resolveStoredOrderAmount(order);
  const receivedAmount =
    typeof providerResponse.amount === "number" && Number.isFinite(providerResponse.amount)
      ? Math.round(providerResponse.amount)
      : null;

  if (verifiedPaymentStatus === "paid" && receivedAmount !== expectedAmount) {
    logger.error("admin_order_payment_reverify_amount_mismatch", {
      orderId: order.id,
      trackingId: orderTrackingId,
      expectedAmount,
      receivedAmount,
      providerStatus,
    });

    await upsertPaymentAttempt({
      orderId: order.id,
      provider: nextPaymentProvider,
      providerReference: orderTrackingId,
      amount: receivedAmount ?? expectedAmount,
      status: currentPaymentStatus === "paid" ? currentPaymentStatus : "pending",
      redirectUrl: order.payment_redirect_url,
      rawProviderResponse: {
        verificationRejected: "amount_mismatch",
        expectedAmount,
        receivedAmount,
        providerStatus,
        payload: providerResponse,
      },
      createdAt: order.created_at,
      verifiedAt: order.paid_at,
    });

    throw conflict("Payment amount verification failed. Order held for review.");
  }

  const requiresPersistence =
    nextPaymentProvider !== currentProvider
    || nextPaymentReference !== normalizeText(order.payment_reference)
    || nextPaymentStatus !== order.payment_status;

  if (requiresPersistence) {
    const updateValues: Record<string, string | null> = {
      payment_provider: nextPaymentProvider,
      payment_reference: nextPaymentReference,
      payment_status: nextPaymentStatus,
    };

    if (nextPaymentStatus === "paid" && order.paid_at) {
      updateValues.paid_at = order.paid_at;
    }

    const { data, error } = await supabaseAdmin
      .from("orders")
      .update(updateValues)
      .eq("id", order.id)
      .eq("updated_at", order.updated_at)
      .select(orderPaymentSelection)
      .maybeSingle();

    if (error) {
      throw new Error(`Order payment update failed: ${error.message}`);
    }

    if (!data) {
      throw conflict("Order was modified concurrently");
    }

    const updatedOrder = data as unknown as OrderPaymentRecord;

    await upsertPaymentAttempt({
      orderId: updatedOrder.id,
      provider: nextPaymentProvider,
      providerReference: orderTrackingId,
      amount: receivedAmount ?? expectedAmount,
      status: nextPaymentStatus,
      redirectUrl: updatedOrder.payment_redirect_url,
      rawProviderResponse: providerResponse,
      createdAt: updatedOrder.created_at,
      verifiedAt: updatedOrder.paid_at,
    });

    return {
      order: updatedOrder,
      providerStatus,
      paymentStatus: nextPaymentStatus,
      updated: hasPaymentFieldsChanged(order, updatedOrder),
    };
  }

  const latestOrder = await getOrderPaymentRecord(order.id);

  if (!latestOrder) {
    throw notFound("Order not found");
  }

  await upsertPaymentAttempt({
    orderId: latestOrder.id,
    provider: nextPaymentProvider,
    providerReference: orderTrackingId,
    amount: receivedAmount ?? expectedAmount,
    status: nextPaymentStatus,
    redirectUrl: latestOrder.payment_redirect_url,
    rawProviderResponse: providerResponse,
    createdAt: latestOrder.created_at,
    verifiedAt: latestOrder.paid_at,
  });

  return {
    order: latestOrder,
    providerStatus,
    paymentStatus: nextPaymentStatus,
    updated: hasPaymentFieldsChanged(order, latestOrder),
  };
}
