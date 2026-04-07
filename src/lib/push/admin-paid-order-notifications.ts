import "server-only";

import webpush from "web-push";
import { normalizeAdminPaymentStatus } from "@/lib/order-display-state";
import { requireEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ADMIN_PAID_ORDER_NOTIFICATION_TYPE = "new_paid_order";
const MAX_DISPATCH_BATCH_SIZE = 25;
const MAX_DISPATCH_ATTEMPTS = 6;
const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
  2 * 60 * 60_000,
];

type AdminPushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  last_seen_at: string | null;
};

type AdminPushDispatchRow = {
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

type AdminPushReceiptRow = {
  subscription_id: string;
};

type AdminPushOrderSummary = {
  id: string;
  customer_name: string | null;
  phone: string | null;
};

type PushSendOutcome =
  | { status: "sent" }
  | { status: "invalid" }
  | { status: "retryable"; error: string };

export type AdminPushQueueStats = {
  claimed: number;
  succeeded: number;
  retried: number;
  failed: number;
  noSubscribers: number;
  subscriptionsDelivered: number;
  subscriptionsExpired: number;
  subscriptionFailures: number;
  claimedDispatchIds: string[];
};

export type AdminPaidOrderNotificationResult = {
  attempted: boolean;
  triggered: boolean;
  duplicate: boolean;
  processing: AdminPushQueueStats | null;
};

function isPaidPaymentStatus(paymentStatus: string | null | undefined) {
  return normalizeAdminPaymentStatus(paymentStatus) === "paid";
}

export function didTransitionToPaid(input: {
  previousPaymentStatus: string | null | undefined;
  nextPaymentStatus: string | null | undefined;
}) {
  return !isPaidPaymentStatus(input.previousPaymentStatus) && isPaidPaymentStatus(input.nextPaymentStatus);
}

function getRetryDelayMs(attemptCount: number) {
  return RETRY_DELAYS_MS[Math.min(Math.max(attemptCount - 1, 0), RETRY_DELAYS_MS.length - 1)];
}

function getShortOrderId(orderId: string) {
  return orderId.slice(0, 8).toUpperCase();
}

function getOrderActorLabel(order: AdminPushOrderSummary) {
  const customerName = order.customer_name?.trim();
  if (customerName) {
    return customerName;
  }

  const phone = order.phone?.trim();
  if (phone) {
    return phone;
  }

  return null;
}

function buildAdminOrderUrl(orderId: string) {
  return `/orders/${orderId}`;
}

function buildAdminPaidOrderNotificationPayload(order: AdminPushOrderSummary) {
  const actorLabel = getOrderActorLabel(order);
  const shortOrderId = getShortOrderId(order.id);

  return {
    title: "New paid order received",
    body: actorLabel ? `Order #${shortOrderId} from ${actorLabel}` : `Order #${shortOrderId} is ready for review`,
    tag: `admin-new-paid-order:${order.id}`,
    data: {
      orderId: order.id,
      url: buildAdminOrderUrl(order.id),
      eventType: ADMIN_PAID_ORDER_NOTIFICATION_TYPE,
    },
  };
}

async function loadOrderSummary(orderId: string): Promise<AdminPushOrderSummary | null> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id,customer_name,phone")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load order for admin push: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return data as AdminPushOrderSummary;
}

async function listAdminPushSubscriptions() {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("admin_push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth,last_seen_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Unable to load admin push subscriptions: ${error.message}`);
  }

  return (data ?? []) as AdminPushSubscriptionRow[];
}

async function listDispatchReceipts(dispatchId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("admin_push_dispatch_receipts")
    .select("subscription_id")
    .eq("dispatch_id", dispatchId);

  if (error) {
    throw new Error(`Unable to load admin push receipts: ${error.message}`);
  }

  return (data ?? []) as AdminPushReceiptRow[];
}

async function deleteExpiredSubscription(subscriptionId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from("admin_push_subscriptions")
    .delete()
    .eq("id", subscriptionId);

  if (error) {
    logger.error("admin_push_subscription_delete_failed", {
      subscriptionId,
      error: error.message,
    });
  }
}

async function recordDispatchReceipt(dispatchId: string, subscriptionId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from("admin_push_dispatch_receipts")
    .upsert(
      {
        dispatch_id: dispatchId,
        subscription_id: subscriptionId,
      },
      {
        onConflict: "dispatch_id,subscription_id",
      },
    );

  if (error) {
    throw new Error(`Unable to record admin push receipt: ${error.message}`);
  }
}

async function updateDispatchState(
  dispatchId: string,
  values: Record<string, string | number | null>,
) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from("admin_push_dispatches")
    .update(values)
    .eq("id", dispatchId);

  if (error) {
    throw new Error(`Unable to update admin push dispatch: ${error.message}`);
  }
}

async function claimDispatches(options?: { limit?: number; orderId?: string }) {
  const supabaseAdmin = createSupabaseAdminClient();
  const limit = Math.max(1, Math.min(MAX_DISPATCH_BATCH_SIZE, Math.trunc(options?.limit ?? 10)));
  const { data, error } = await supabaseAdmin.rpc("claim_admin_push_dispatches", {
    p_limit: limit,
    p_order_id: options?.orderId ?? null,
  });

  if (error) {
    throw new Error(`Unable to claim admin push dispatches: ${error.message}`);
  }

  return (data ?? []) as AdminPushDispatchRow[];
}

async function sendPushNotification(
  subscription: AdminPushSubscriptionRow,
  payload: ReturnType<typeof buildAdminPaidOrderNotificationPayload>,
): Promise<PushSendOutcome> {
  try {
    webpush.setVapidDetails(
      requireEnv("WEB_PUSH_VAPID_SUBJECT"),
      requireEnv("NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY"),
      requireEnv("WEB_PUSH_VAPID_PRIVATE_KEY"),
    );

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
      {
        TTL: 300,
        urgency: "high",
        topic: `paid-order-${payload.data.orderId.slice(0, 20)}`,
      },
    );

    return { status: "sent" };
  } catch (error) {
    const statusCode =
      typeof error === "object"
      && error !== null
      && "statusCode" in error
      && typeof error.statusCode === "number"
        ? error.statusCode
        : null;
    const errorMessage = error instanceof Error ? error.message : "unknown_error";

    if (statusCode === 404 || statusCode === 410) {
      return { status: "invalid" };
    }

    return {
      status: "retryable",
      error: errorMessage,
    };
  }
}

async function processDispatch(
  dispatch: AdminPushDispatchRow,
): Promise<Pick<AdminPushQueueStats, "succeeded" | "retried" | "failed" | "noSubscribers" | "subscriptionsDelivered" | "subscriptionsExpired" | "subscriptionFailures">> {
  const order = await loadOrderSummary(dispatch.order_id);

  if (!order) {
    await updateDispatchState(dispatch.id, {
      status: "failed",
      completed_at: new Date().toISOString(),
      last_error: "order_not_found",
    });

    return {
      succeeded: 0,
      retried: 0,
      failed: 1,
      noSubscribers: 0,
      subscriptionsDelivered: 0,
      subscriptionsExpired: 0,
      subscriptionFailures: 0,
    };
  }

  const subscriptions = await listAdminPushSubscriptions();
  const receipts = await listDispatchReceipts(dispatch.id);
  const deliveredSubscriptionIds = new Set(receipts.map((receipt) => receipt.subscription_id));
  const pendingSubscriptions = subscriptions.filter((subscription) => !deliveredSubscriptionIds.has(subscription.id));

  if (subscriptions.length === 0) {
    await updateDispatchState(dispatch.id, {
      status: "no_subscribers",
      completed_at: new Date().toISOString(),
      last_error: "no_active_subscriptions",
    });

    return {
      succeeded: 0,
      retried: 0,
      failed: 0,
      noSubscribers: 1,
      subscriptionsDelivered: 0,
      subscriptionsExpired: 0,
      subscriptionFailures: 0,
    };
  }

  if (pendingSubscriptions.length === 0) {
    await updateDispatchState(dispatch.id, {
      status: "succeeded",
      completed_at: new Date().toISOString(),
      last_error: null,
    });

    return {
      succeeded: 1,
      retried: 0,
      failed: 0,
      noSubscribers: 0,
      subscriptionsDelivered: 0,
      subscriptionsExpired: 0,
      subscriptionFailures: 0,
    };
  }

  const payload = buildAdminPaidOrderNotificationPayload(order);
  let deliveredCount = 0;
  let expiredCount = 0;
  let retryableFailureCount = 0;
  let lastRetryableError: string | null = null;

  for (const subscription of pendingSubscriptions) {
    const result = await sendPushNotification(subscription, payload);

    if (result.status === "sent") {
      await recordDispatchReceipt(dispatch.id, subscription.id);
      deliveredCount += 1;
      continue;
    }

    if (result.status === "invalid") {
      expiredCount += 1;
      await deleteExpiredSubscription(subscription.id);
      continue;
    }

    retryableFailureCount += 1;
    lastRetryableError = result.error;

    logger.error("admin_paid_order_push_send_failed", {
      dispatchId: dispatch.id,
      orderId: dispatch.order_id,
      subscriptionId: subscription.id,
      error: result.error,
    });
  }

  if (retryableFailureCount > 0) {
    if (dispatch.attempt_count >= MAX_DISPATCH_ATTEMPTS) {
      await updateDispatchState(dispatch.id, {
        status: "failed",
        completed_at: new Date().toISOString(),
        last_error: lastRetryableError ?? "push_delivery_failed",
      });

      return {
        succeeded: 0,
        retried: 0,
        failed: 1,
        noSubscribers: 0,
        subscriptionsDelivered: deliveredCount,
        subscriptionsExpired: expiredCount,
        subscriptionFailures: retryableFailureCount,
      };
    }

    await updateDispatchState(dispatch.id, {
      status: "pending",
      next_attempt_at: new Date(Date.now() + getRetryDelayMs(dispatch.attempt_count)).toISOString(),
      completed_at: null,
      last_error: lastRetryableError ?? "push_delivery_failed",
    });

    return {
      succeeded: 0,
      retried: 1,
      failed: 0,
      noSubscribers: 0,
      subscriptionsDelivered: deliveredCount,
      subscriptionsExpired: expiredCount,
      subscriptionFailures: retryableFailureCount,
    };
  }

  await updateDispatchState(dispatch.id, {
    status: "succeeded",
    completed_at: new Date().toISOString(),
    last_error: null,
  });

  return {
    succeeded: 1,
    retried: 0,
    failed: 0,
    noSubscribers: 0,
    subscriptionsDelivered: deliveredCount,
    subscriptionsExpired: expiredCount,
    subscriptionFailures: 0,
  };
}

export async function enqueueAdminPaidOrderDispatch(orderId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from("admin_push_dispatches")
    .insert({
      order_id: orderId,
      notification_type: ADMIN_PAID_ORDER_NOTIFICATION_TYPE,
    });

  if (!error) {
    return {
      queued: true,
      duplicate: false,
    };
  }

  if (error.code === "23505") {
    return {
      queued: true,
      duplicate: true,
    };
  }

  throw new Error(`Unable to enqueue admin paid-order push dispatch: ${error.message}`);
}

export async function processAdminPushDispatchQueue(options?: {
  limit?: number;
  orderId?: string;
}): Promise<AdminPushQueueStats> {
  const claimedDispatches = await claimDispatches(options);
  const stats: AdminPushQueueStats = {
    claimed: claimedDispatches.length,
    succeeded: 0,
    retried: 0,
    failed: 0,
    noSubscribers: 0,
    subscriptionsDelivered: 0,
    subscriptionsExpired: 0,
    subscriptionFailures: 0,
    claimedDispatchIds: claimedDispatches.map((dispatch) => dispatch.id),
  };

  for (const dispatch of claimedDispatches) {
    const result = await processDispatch(dispatch);
    stats.succeeded += result.succeeded;
    stats.retried += result.retried;
    stats.failed += result.failed;
    stats.noSubscribers += result.noSubscribers;
    stats.subscriptionsDelivered += result.subscriptionsDelivered;
    stats.subscriptionsExpired += result.subscriptionsExpired;
    stats.subscriptionFailures += result.subscriptionFailures;
  }

  logger.info("admin_push_dispatch_queue_processed", stats);

  return stats;
}

export async function notifyAdminsOfPaidOrderIfNeeded(input: {
  orderId: string;
  previousPaymentStatus: string | null | undefined;
  nextPaymentStatus: string | null | undefined;
}) {
  if (
    !didTransitionToPaid({
      previousPaymentStatus: input.previousPaymentStatus,
      nextPaymentStatus: input.nextPaymentStatus,
    })
  ) {
    return {
      attempted: false,
      triggered: false,
      duplicate: false,
      processing: null,
    } satisfies AdminPaidOrderNotificationResult;
  }

  const enqueueResult = await enqueueAdminPaidOrderDispatch(input.orderId);
  const processing = await processAdminPushDispatchQueue({
    orderId: input.orderId,
    limit: 1,
  });

  return {
    attempted: true,
    triggered: true,
    duplicate: enqueueResult.duplicate,
    processing,
  } satisfies AdminPaidOrderNotificationResult;
}
