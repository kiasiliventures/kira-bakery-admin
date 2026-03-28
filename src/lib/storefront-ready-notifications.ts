import "server-only";

import { requireEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

type ReadyNotificationOrder = {
  id?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

type ReadyNotificationTriggerResult = {
  attempted: boolean;
  triggered: boolean;
  request: {
    url: string;
    method: "POST";
    headers: Record<string, string>;
    body: {
      source: "admin_order_status_patch";
      orderStatus: "Ready";
      orderUpdatedAt: string;
    };
  } | null;
};

function getStorefrontBaseUrl(): string {
  return requireEnv("STOREFRONT_BASE_URL").replace(/\/+$/, "");
}

function getStorefrontAuthorityToken(): string {
  return requireEnv("STOREFRONT_INTERNAL_AUTH_TOKEN");
}

function normalizeOrderStatus(status: string | null | undefined): string {
  return status?.trim().toLowerCase() ?? "";
}

function buildReadyNotificationRequest(order: { id: string; updatedAt: string }) {
  const url = `${getStorefrontBaseUrl()}/api/internal/push/orders/${order.id}/ready`;
  const idempotencyKey = `order-ready:${order.id}:${order.updatedAt}`;

  return {
    url,
    method: "POST" as const,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${getStorefrontAuthorityToken()}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: {
      source: "admin_order_status_patch" as const,
      orderStatus: "Ready" as const,
      orderUpdatedAt: order.updatedAt,
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

  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
      cache: "no-store",
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
        triggered: false,
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
      request,
    };
  }
}
