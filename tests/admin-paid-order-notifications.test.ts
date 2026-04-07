import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createSupabaseAdminClientMock = vi.fn();
const webPushMock = {
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
};

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

vi.mock("web-push", () => ({
  default: webPushMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

type FakeOrderRow = {
  id: string;
  customer_name: string | null;
  phone: string | null;
};

type FakeSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  last_seen_at: string | null;
  created_at: string;
};

type FakeDispatchRow = {
  id: string;
  order_id: string;
  notification_type: string;
  status: string;
  attempt_count: number;
  next_attempt_at: string;
  last_attempt_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  last_error: string | null;
};

type FakeReceiptRow = {
  id: string;
  dispatch_id: string;
  subscription_id: string;
  created_at: string;
};

type FakeDb = {
  orders: FakeOrderRow[];
  subscriptions: FakeSubscriptionRow[];
  dispatches: FakeDispatchRow[];
  receipts: FakeReceiptRow[];
};

function createFakeSupabase(db: FakeDb) {
  return {
    from(table: string) {
      return {
        insert: async (payload: Record<string, unknown>) => {
          if (table !== "admin_push_dispatches") {
            throw new Error(`Unsupported insert table: ${table}`);
          }

          const duplicate = db.dispatches.find(
            (dispatch) =>
              dispatch.order_id === payload.order_id
              && dispatch.notification_type === payload.notification_type,
          );

          if (duplicate) {
            return {
              error: {
                code: "23505",
                message: "duplicate key value violates unique constraint",
              },
            };
          }

          db.dispatches.push({
            id: `dispatch-${db.dispatches.length + 1}`,
            order_id: String(payload.order_id),
            notification_type: String(payload.notification_type),
            status: "pending",
            attempt_count: 0,
            next_attempt_at: new Date("2026-04-07T08:00:00.000Z").toISOString(),
            last_attempt_at: null,
            created_at: new Date("2026-04-07T08:00:00.000Z").toISOString(),
            updated_at: new Date("2026-04-07T08:00:00.000Z").toISOString(),
            completed_at: null,
            last_error: null,
          });

          return { error: null };
        },
        update: (values: Record<string, unknown>) => ({
          eq: async (field: string, value: string) => {
            if (table !== "admin_push_dispatches" || field !== "id") {
              throw new Error(`Unsupported update target: ${table}.${field}`);
            }

            const dispatch = db.dispatches.find((row) => row.id === value);
            if (dispatch) {
              Object.assign(dispatch, values);
            }

            return { error: null };
          },
        }),
        select: (_unusedSelection: string) => {
          if (table === "orders") {
            return {
              eq: (_field: string, value: string) => ({
                maybeSingle: async () => ({
                  data: db.orders.find((order) => order.id === value) ?? null,
                  error: null,
                }),
              }),
            };
          }

          if (table === "admin_push_subscriptions") {
            return {
              order: async () => ({
                data: [...db.subscriptions],
                error: null,
              }),
            };
          }

          if (table === "admin_push_dispatch_receipts") {
            return {
              eq: async (_field: string, value: string) => ({
                data: db.receipts
                  .filter((receipt) => receipt.dispatch_id === value)
                  .map((receipt) => ({ subscription_id: receipt.subscription_id })),
                error: null,
              }),
            };
          }

          throw new Error(`Unsupported select table: ${table}`);
        },
        upsert: async (payload: Record<string, unknown>) => {
          if (table !== "admin_push_dispatch_receipts") {
            throw new Error(`Unsupported upsert table: ${table}`);
          }

          const existing = db.receipts.find(
            (receipt) =>
              receipt.dispatch_id === payload.dispatch_id
              && receipt.subscription_id === payload.subscription_id,
          );

          if (!existing) {
            db.receipts.push({
              id: `receipt-${db.receipts.length + 1}`,
              dispatch_id: String(payload.dispatch_id),
              subscription_id: String(payload.subscription_id),
              created_at: new Date("2026-04-07T08:00:00.000Z").toISOString(),
            });
          }

          return { error: null };
        },
        delete: () => ({
          eq: async (_field: string, value: string) => {
            if (table !== "admin_push_subscriptions") {
              throw new Error(`Unsupported delete table: ${table}`);
            }

            db.subscriptions = db.subscriptions.filter((subscription) => subscription.id !== value);
            return { error: null };
          },
        }),
      };
    },
    rpc(name: string, args: { p_limit: number; p_order_id: string | null }) {
      if (name !== "claim_admin_push_dispatches") {
        throw new Error(`Unsupported rpc: ${name}`);
      }

      const dueDispatches = db.dispatches
        .filter((dispatch) => {
          const due =
            (dispatch.status === "pending" && dispatch.next_attempt_at <= new Date("2026-04-07T08:00:00.000Z").toISOString())
            || (
              dispatch.status === "processing"
              && dispatch.last_attempt_at !== null
              && dispatch.last_attempt_at <= new Date("2026-04-07T07:55:00.000Z").toISOString()
            );

          return due && (args.p_order_id === null || dispatch.order_id === args.p_order_id);
        })
        .slice(0, args.p_limit);

      for (const dispatch of dueDispatches) {
        dispatch.status = "processing";
        dispatch.attempt_count += 1;
        dispatch.last_attempt_at = new Date("2026-04-07T08:00:00.000Z").toISOString();
        dispatch.last_error = null;
        dispatch.updated_at = new Date("2026-04-07T08:00:00.000Z").toISOString();
      }

      return Promise.resolve({
        data: dueDispatches.map((dispatch) => ({ ...dispatch })),
        error: null,
      });
    },
  };
}

function buildDb(): FakeDb {
  return {
    orders: [
      {
        id: "order-1",
        customer_name: "Jane Customer",
        phone: "0700000000",
      },
    ],
    subscriptions: [
      {
        id: "subscription-1",
        user_id: "admin-user-1",
        endpoint: "https://push.example.com/device-1",
        p256dh: "p256dh-key",
        auth: "auth-key",
        last_seen_at: null,
        created_at: new Date("2026-04-07T07:50:00.000Z").toISOString(),
      },
    ],
    dispatches: [],
    receipts: [],
  };
}

describe("admin paid order notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY = "test-public-key";
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = "test-private-key";
    process.env.WEB_PUSH_VAPID_SUBJECT = "mailto:test@example.com";
  });

  it("sends a push notification to admin subscriptions when an order becomes paid", async () => {
    const db = buildDb();
    createSupabaseAdminClientMock.mockReturnValue(createFakeSupabase(db));
    webPushMock.sendNotification.mockResolvedValue(undefined);

    const { notifyAdminsOfPaidOrderIfNeeded } = await import("@/lib/push/admin-paid-order-notifications");
    const result = await notifyAdminsOfPaidOrderIfNeeded({
      orderId: "order-1",
      previousPaymentStatus: "pending",
      nextPaymentStatus: "paid",
    });

    expect(result.attempted).toBe(true);
    expect(result.triggered).toBe(true);
    expect(result.processing?.succeeded).toBe(1);
    expect(webPushMock.sendNotification).toHaveBeenCalledTimes(1);
    expect(db.dispatches).toHaveLength(1);
    expect(db.dispatches[0]?.status).toBe("succeeded");
    expect(db.receipts).toHaveLength(1);
  });

  it("does not send a second push for a duplicate paid verification replay", async () => {
    const db = buildDb();
    createSupabaseAdminClientMock.mockReturnValue(createFakeSupabase(db));
    webPushMock.sendNotification.mockResolvedValue(undefined);

    const { notifyAdminsOfPaidOrderIfNeeded } = await import("@/lib/push/admin-paid-order-notifications");

    await notifyAdminsOfPaidOrderIfNeeded({
      orderId: "order-1",
      previousPaymentStatus: "pending",
      nextPaymentStatus: "paid",
    });

    const replayResult = await notifyAdminsOfPaidOrderIfNeeded({
      orderId: "order-1",
      previousPaymentStatus: "pending",
      nextPaymentStatus: "paid",
    });

    expect(replayResult.attempted).toBe(true);
    expect(replayResult.duplicate).toBe(true);
    expect(replayResult.processing?.claimed).toBe(0);
    expect(webPushMock.sendNotification).toHaveBeenCalledTimes(1);
    expect(db.dispatches).toHaveLength(1);
    expect(db.receipts).toHaveLength(1);
  });

  it("does not trigger admin push while payment is still pending", async () => {
    const db = buildDb();
    createSupabaseAdminClientMock.mockReturnValue(createFakeSupabase(db));
    webPushMock.sendNotification.mockResolvedValue(undefined);

    const { notifyAdminsOfPaidOrderIfNeeded } = await import("@/lib/push/admin-paid-order-notifications");
    const result = await notifyAdminsOfPaidOrderIfNeeded({
      orderId: "order-1",
      previousPaymentStatus: "pending",
      nextPaymentStatus: "pending",
    });

    expect(result.attempted).toBe(false);
    expect(result.triggered).toBe(false);
    expect(result.processing).toBeNull();
    expect(webPushMock.sendNotification).not.toHaveBeenCalled();
    expect(db.dispatches).toHaveLength(0);
  });
});
