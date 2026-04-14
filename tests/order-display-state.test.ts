import { describe, expect, it } from "vitest";

import {
  deriveAdminDisplayOrderStatus,
  normalizeAdminPaymentStatus,
} from "@/lib/order-display-state";

describe("admin order display state", () => {
  it("treats invalid payment statuses as pending", () => {
    expect(normalizeAdminPaymentStatus("invalid")).toBe("pending");
    expect(
      deriveAdminDisplayOrderStatus({
        status: "Pending Payment",
        paymentStatus: "invalid",
      }),
    ).toBe("Pending Payment");
  });

  it("still treats cancelled payment statuses as cancelled", () => {
    expect(normalizeAdminPaymentStatus("cancelled")).toBe("cancelled");
    expect(
      deriveAdminDisplayOrderStatus({
        status: "Pending Payment",
        paymentStatus: "cancelled",
      }),
    ).toBe("Cancelled");
  });
});
