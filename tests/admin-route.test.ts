import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  requireRole: vi.fn(),
  runAfterResponse: vi.fn(),
  scheduleAdminPushDispatchQueueProcessing: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock("@/lib/auth/authorize", () => ({
  requireRole: mocks.requireRole,
}));

vi.mock("@/lib/http/after-response", () => ({
  runAfterResponse: mocks.runAfterResponse,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
  },
}));

vi.mock("@/lib/push/admin-paid-order-notifications", () => ({
  scheduleAdminPushDispatchQueueProcessing:
    mocks.scheduleAdminPushDispatchQueueProcessing,
}));

vi.mock("@/lib/security/rate-limit", () => ({
  getAdminPreAuthRateLimit: vi.fn(() => ({
    limit: 180,
    windowMs: 60_000,
  })),
  enforceRateLimit: mocks.enforceRateLimit,
}));

import { withAdminRoute } from "@/lib/http/admin-route";

describe("withAdminRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.requireRole.mockResolvedValue({
      user: { id: "user_123" },
      profile: { id: "user_123", email: "admin@example.com", role: "admin" },
    });
  });

  it("rate limits a safe client fingerprint before requiring auth", async () => {
    const route = withAdminRoute(
      {
        allowedRoles: ["admin"],
        actionName: "test_action",
        rateLimit: { limit: 10, windowMs: 30_000 },
      },
      async () => NextResponse.json({ ok: true }),
    );

    const response = await route(
      new Request("https://admin.example.com/api/admin/test", {
        headers: {
          "user-agent": "Example Browser 1.0",
          "x-forwarded-for": "198.51.100.10",
          "x-real-ip": "203.0.113.30",
        },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(mocks.enforceRateLimit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        key: expect.stringMatching(
          /^preauth:test_action:ip:unknown:ua:[a-z0-9]+$/,
        ),
        limit: 180,
        windowMs: 60_000,
      }),
    );
    expect(
      mocks.enforceRateLimit.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.requireRole.mock.invocationCallOrder[0]);
    expect(mocks.enforceRateLimit).toHaveBeenNthCalledWith(2, {
      key: "test_action:user_123",
      limit: 10,
      windowMs: 30_000,
    });
  });
});
