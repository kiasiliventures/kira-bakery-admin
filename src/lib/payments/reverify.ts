import "server-only";

import { badRequest, conflict, notFound } from "@/lib/http/errors";
import {
  getPesapalTransactionStatus,
  normalizePesapalPaymentState,
  type NormalizedPesapalPaymentState,
} from "@/lib/payments/pesapal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type OrderPaymentRecord = {
  id: string;
  status: string;
  payment_status: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  order_tracking_id: string | null;
  paid_at: string | null;
  inventory_deducted_at: string | null;
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
  "status",
  "payment_status",
  "payment_provider",
  "payment_reference",
  "order_tracking_id",
  "paid_at",
  "inventory_deducted_at",
  "updated_at",
].join(",");

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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

  const providerResponse = await getPesapalTransactionStatus(orderTrackingId);
  const providerStatus = normalizeText(providerResponse.payment_status_description);
  const normalizedPaymentStatus = normalizePesapalPaymentState(providerStatus);
  const nextPaymentProvider = normalizeText(order.payment_provider) ?? "pesapal";
  const nextPaymentReference =
    normalizeText(providerResponse.confirmation_code) ?? normalizeText(order.payment_reference);
  const nextPaymentStatus = normalizedPaymentStatus;
  const requiresPersistence =
    nextPaymentProvider !== normalizeText(order.payment_provider)
    || nextPaymentReference !== normalizeText(order.payment_reference)
    || nextPaymentStatus !== order.payment_status;

  if (requiresPersistence) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .update({
        payment_provider: nextPaymentProvider,
        payment_reference: nextPaymentReference,
        payment_status: nextPaymentStatus,
      })
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

    return {
      order: updatedOrder,
      providerStatus,
      paymentStatus: normalizedPaymentStatus,
      updated: hasPaymentFieldsChanged(order, updatedOrder),
    };
  }

  const latestOrder = await getOrderPaymentRecord(order.id);

  if (!latestOrder) {
    throw notFound("Order not found");
  }

  return {
    order: latestOrder,
    providerStatus,
    paymentStatus: normalizedPaymentStatus,
    updated: hasPaymentFieldsChanged(order, latestOrder),
  };
}
