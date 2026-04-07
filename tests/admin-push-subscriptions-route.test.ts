import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createSupabaseAdminClientMock = vi.fn();

vi.mock("@/lib/http/admin-route", () => ({
  withAdminRoute:
    (_config: unknown, handler: (request: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (request: Request) =>
      handler(request, {
        identity: {
          user: { id: "admin-user-1" },
          profile: { id: "admin-user-1", email: "admin@example.com", role: "admin" },
        },
        params: {},
        ip: "127.0.0.1",
      }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

type SubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  last_seen_at: string | null;
};

function createSubscriptionSupabase(rows: Map<string, SubscriptionRow>) {
  return {
    from: (table: string) => {
      expect(table).toBe("admin_push_subscriptions");

      return {
        upsert: (payload: Omit<SubscriptionRow, "id">) => ({
          select: () => ({
            single: async () => {
              const existing = rows.get(payload.endpoint);
              const row: SubscriptionRow = {
                id: existing?.id ?? `sub-${rows.size + 1}`,
                user_id: payload.user_id,
                endpoint: payload.endpoint,
                p256dh: payload.p256dh,
                auth: payload.auth,
                last_seen_at: payload.last_seen_at,
              };

              rows.set(payload.endpoint, row);

              return {
                data: row,
                error: null,
              };
            },
          }),
        }),
      };
    },
  };
}

describe("admin push subscription registration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an authenticated admin to subscribe idempotently by endpoint", async () => {
    const rows = new Map<string, SubscriptionRow>();
    createSupabaseAdminClientMock.mockReturnValue(createSubscriptionSupabase(rows));

    const { POST } = await import("@/app/api/admin/push/subscriptions/route");
    const buildRequest = () =>
      new Request("https://admin.example.com/api/admin/push/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: "https://push.example.com/subscriptions/device-1",
          keys: {
            p256dh: "p256dh-key",
            auth: "auth-key",
          },
        }),
      });

    const firstResponse = await POST(buildRequest(), { params: Promise.resolve({}) } as never);
    const secondResponse = await POST(buildRequest(), { params: Promise.resolve({}) } as never);
    const firstPayload = await firstResponse.json();
    const secondPayload = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstPayload.ok).toBe(true);
    expect(secondPayload.ok).toBe(true);
    expect(rows.size).toBe(1);
    expect(rows.get("https://push.example.com/subscriptions/device-1")).toEqual(
      expect.objectContaining({
        user_id: "admin-user-1",
        endpoint: "https://push.example.com/subscriptions/device-1",
      }),
    );
  });
});
