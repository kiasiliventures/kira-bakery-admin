import "server-only";

import { requireEnv } from "@/lib/env";
import { fetchWithTimeout } from "@/lib/http/fetch";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ReadyNotificationOrder = {
  id?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

type ReadyNotificationTriggerResult = {
  attempted: boolean;
  triggered: boolean;
  queued: boolean;
  duplicate: boolean;
  kickoffAccepted: boolean;
  request: {
    url: string;
    method: "POST";
    headers: Record<string, string>;
    body: {
      idempotencyKey: string;
    };
  } | null;
};

const STOREFRONT_READY_NOTIFICATION_TIMEOUT_MS = 8_000;

function getStorefrontBaseUrl(): string {
  return requireEnv("STOREFRONT_BASE_URL").replace(/\/+$/, "");
}

function getStorefrontAuthorityToken(): string {
  return requireEnv("STOREFRONT_INTERNAL_AUTH_TOKEN");
}

function normalizeOrderStatus(status: string | null | undefined): string {
  return status?.trim().toLowerCase() ?? "";
}

function buildIdempotencyKey(order: { id: string; updatedAt: string }) {
  return `order-ready:${order.id}:${order.updatedAt}`;
}

function buildReadyNotificationRequest(order: { id: string; updatedAt: string }) {
  const idempotencyKey = buildIdempotencyKey(order);
  const url = `${getStorefrontBaseUrl()}/api/internal/push/order-ready/process`;

  return {
    idempotencyKey,
    url,
    method: "POST" as const,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${getStorefrontAuthorityToken()}`,
    },
    body: {
      idempotencyKey,
    },
  };
}

function getResponseMessage(payload: unknown): string | null {
  if (
    payload
    && typeof payload === "object"
    && "message" in payload
    && typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return null;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function enqueueReadyNotification(order: {
  id: string;
  updatedAt: string;
}) {
  const supabaseAdmin = createSupabaseAdminClient();
  const idempotencyKey = buildIdempotencyKey(order);
  const { error } = await supabaseAdmin
    .from("push_notification_dispatches")
    .insert({
      idempotency_key: idempotencyKey,
      notification_type: "order_ready",
      order_id: order.id,
      order_updated_at: order.updatedAt,
      source: "admin_order_status_patch",
      next_attempt_at: new Date().toISOString(),
    });

  if (!error) {
    return { duplicate: false, idempotencyKey };
  }

  if (error.code === "23505") {
    return { duplicate: true, idempotencyKey };
  }

  throw new Error(`Unable to enqueue storefront ready notification: ${error.message}`);
}

export function didTransitionToReady(input: {
  requestedStatus: string;
  previousUpdatedAt: string;
  resultingOrder: ReadyNotificationOrder;
}): boolean {
  return (
    normalizeOrderStatus(input.requestedStatus) === "ready"
    && normalizeOrderStatus(input.resultingOrder.status) === "ready"
    && Boolean(input.resultingOrder.updated_at)
    && input.resultingOrder.updated_at !== input.previousUpdatedAt
  );
}

export async function triggerStorefrontReadyNotification(order: {
  id: string;
  updatedAt: string;
}): Promise<ReadyNotificationTriggerResult> {
  const request = buildReadyNotificationRequest(order);
  let enqueueResult: Awaited<ReturnType<typeof enqueueReadyNotification>> | null = null;

  try {
    enqueueResult = await enqueueReadyNotification(order);
    const response = await fetchWithTimeout(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
      cache: "no-store",
    }, {
      operationName: "Storefront ready notification",
      timeoutMs: STOREFRONT_READY_NOTIFICATION_TIMEOUT_MS,
    });
    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      logger.error("storefront_ready_notification_failed", {
        orderId: order.id,
        status: response.status,
        message: getResponseMessage(payload),
      });

      return {
        attempted: true,
        triggered: true,
        queued: true,
        duplicate: enqueueResult.duplicate,
        kickoffAccepted: false,
        request,
      };
    }

    logger.info("storefront_ready_notification_triggered", {
      orderId: order.id,
      status: response.status,
    });

    return {
      attempted: true,
      triggered: true,
      queued: true,
      duplicate: enqueueResult.duplicate,
      kickoffAccepted: true,
      request,
    };
  } catch (error) {
    logger.error("storefront_ready_notification_request_failed", {
      orderId: order.id,
      error: error instanceof Error ? error.message : "unknown_error",
    });

    return {
      attempted: true,
      triggered: false,
      queued: Boolean(enqueueResult),
      duplicate: enqueueResult?.duplicate ?? false,
      kickoffAccepted: false,
      request: enqueueResult ? request : null,
    };
  }
}
