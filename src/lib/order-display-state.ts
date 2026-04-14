export type AdminDisplayOrderStatus =
  | "Pending Payment"
  | "Paid"
  | "Paid - Needs Review"
  | "Paid - Stock Conflict"
  | "Ready"
  | "Completed"
  | "Payment Failed"
  | "Cancelled";

export function normalizeAdminPaymentStatus(
  paymentStatus: string | null | undefined,
): string | null {
  const normalized = paymentStatus?.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === "paid" || normalized === "completed") {
    return "paid";
  }

  if (
    normalized === "failed"
    || normalized === "payment_failed"
    || normalized === "reversed"
  ) {
    return "failed";
  }

  if (
    normalized === "cancelled"
    || normalized === "canceled"
  ) {
    return "cancelled";
  }

  if (
    normalized === "unpaid"
    || normalized === "pending"
    || normalized === "invalid"
  ) {
    return "pending";
  }

  return normalized;
}

export function deriveAdminDisplayOrderStatus(input: {
  status: string | null | undefined;
  paymentStatus: string | null | undefined;
  fulfillmentReviewRequired?: boolean | null;
  inventoryConflict?: boolean | null;
}): AdminDisplayOrderStatus {
  const normalizedStatus = input.status?.trim().toLowerCase();
  const normalizedPaymentStatus = normalizeAdminPaymentStatus(input.paymentStatus);

  if (normalizedStatus === "completed" || normalizedStatus === "delivered") {
    return "Completed";
  }

  if (normalizedStatus === "ready" || normalizedStatus === "ready_for_pickup") {
    return "Ready";
  }

  if (normalizedStatus === "cancelled" || normalizedPaymentStatus === "cancelled") {
    return "Cancelled";
  }

  if (
    normalizedStatus === "payment failed"
    || normalizedStatus === "payment_failed"
    || normalizedStatus === "failed"
    || normalizedPaymentStatus === "failed"
  ) {
    return "Payment Failed";
  }

  if (
    normalizedStatus === "paid"
    || normalizedStatus === "approved"
    || normalizedStatus === "in progress"
    || normalizedStatus === "preparing"
    || normalizedStatus === "out_for_delivery"
    || normalizedPaymentStatus === "paid"
  ) {
    if (input.inventoryConflict) {
      return "Paid - Stock Conflict";
    }

    if (input.fulfillmentReviewRequired) {
      return "Paid - Needs Review";
    }

    return "Paid";
  }

  return "Pending Payment";
}

export function isAdminOrderBlockedForReview(status: AdminDisplayOrderStatus) {
  return status === "Paid - Needs Review" || status === "Paid - Stock Conflict";
}
