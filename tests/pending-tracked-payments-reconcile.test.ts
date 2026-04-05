import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type OrderPaymentRecord = {
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

function buildOrder(overrides: Partial<OrderPaymentRecord> = {}): OrderPaymentRecord {
  return {
    id: "order-1",
    total_ugx: 1000,
    total_price: 1000,
    status: "Pending Payment",
    payment_status: "unpaid",
    payment_provider: "pesapal",
    payment_reference: null,
    payment_redirect_url: "https://pay.example.com/redirect",
    order_tracking_id: "tracking-1",
    payment_last_verified_at: null,
    paid_at: null,
    inventory_deducted_at: null,
    fulfillment_review_required: false,
    fulfillment_review_reason: null,
    inventory_conflict: false,
    inventory_deduction_status: null,
    created_at: "2026-04-05T10:00:00.000Z",
    updated_at: "2026-04-05T10:00:00.000Z",
    ...overrides,
  };
}

describe("reconcilePendingTrackedPayments", () => {
  it("reconciles tracked pending orders independently of the dashboard widget list", async () => {
    const { reconcilePendingTrackedPayments } = await import("@/lib/payments/reverify");
    const listOrders = vi.fn().mockResolvedValue([
      buildOrder({
        id: "outside-widget-order",
        order_tracking_id: "tracking-outside-widget",
        payment_last_verified_at: null,
      }),
    ]);
    const reverify = vi.fn().mockResolvedValue({
      order: buildOrder({
        id: "outside-widget-order",
        order_tracking_id: "tracking-outside-widget",
        payment_status: "paid",
      }),
      providerStatus: "COMPLETED",
      paymentStatus: "paid",
      updated: true,
    });

    const stats = await reconcilePendingTrackedPayments({
      now: new Date("2026-04-05T11:00:00.000Z"),
      listOrders,
      reverify,
    });

    expect(listOrders).toHaveBeenCalledTimes(1);
    expect(reverify).toHaveBeenCalledTimes(1);
    expect(reverify).toHaveBeenCalledWith(
      expect.objectContaining({ id: "outside-widget-order" }),
    );
    expect(stats.scanned).toBe(1);
    expect(stats.verified).toBe(1);
    expect(stats.updated).toBe(1);
    expect(stats.skipped).toBe(0);
  });

  it("ignores untracked pending orders", async () => {
    const { reconcilePendingTrackedPayments } = await import("@/lib/payments/reverify");
    const listOrders = vi.fn().mockResolvedValue([
      buildOrder({
        id: "untracked-order",
        order_tracking_id: null,
        payment_redirect_url: null,
      }),
    ]);
    const reverify = vi.fn();

    const stats = await reconcilePendingTrackedPayments({
      now: new Date("2026-04-05T11:00:00.000Z"),
      listOrders,
      reverify,
    });

    expect(reverify).not.toHaveBeenCalled();
    expect(stats.scanned).toBe(1);
    expect(stats.verified).toBe(0);
    expect(stats.updated).toBe(0);
    expect(stats.skipped).toBe(1);
    expect(stats.skippedOrderIds).toEqual(["untracked-order"]);
  });

  it("skips orders that were verified recently", async () => {
    const { reconcilePendingTrackedPayments } = await import("@/lib/payments/reverify");
    const listOrders = vi.fn().mockResolvedValue([
      buildOrder({
        id: "recently-verified-order",
        payment_last_verified_at: "2026-04-05T10:57:30.000Z",
      }),
    ]);
    const reverify = vi.fn();

    const stats = await reconcilePendingTrackedPayments({
      now: new Date("2026-04-05T11:00:00.000Z"),
      listOrders,
      reverify,
    });

    expect(reverify).not.toHaveBeenCalled();
    expect(stats.scanned).toBe(1);
    expect(stats.verified).toBe(0);
    expect(stats.updated).toBe(0);
    expect(stats.skipped).toBe(1);
    expect(stats.skippedRecentlyVerified).toBe(1);
    expect(stats.skippedOrderIds).toEqual(["recently-verified-order"]);
  });
});
