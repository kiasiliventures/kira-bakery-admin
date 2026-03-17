"use client";

import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const ORDERS_REALTIME_CHANNEL_NAME = "admin-orders-realtime-v1";
const FALLBACK_POLL_INTERVAL_MS = 10_000;
const SUBSCRIPTION_TIMEOUT_MS = 5_000;

export type OrdersRealtimeEvent = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: "orders" | "order_items";
  orderId: string | null;
};

type OrdersRealtimeConsumer = {
  id: string;
  source: string;
  onRefresh: (event: OrdersRealtimeEvent) => void;
  onInsert: (event: OrdersRealtimeEvent) => void;
  onFallbackStart: (reason: string) => void;
  onFallbackStop: () => void;
};

type OrdersRealtimeSubscription = Omit<OrdersRealtimeConsumer, "id">;
type OrdersRealtimeStatus =
  | "CLOSED"
  | "CHANNEL_ERROR"
  | "ERRORED"
  | "SUBSCRIBED"
  | "TIMED_OUT";

let consumerSequence = 0;
let ordersRealtimeManager: OrdersRealtimeManager | null = null;

function getOrdersRealtimeManager() {
  if (!ordersRealtimeManager) {
    ordersRealtimeManager = new OrdersRealtimeManager();
  }

  return ordersRealtimeManager;
}

export function subscribeToOrdersRealtime(options: OrdersRealtimeSubscription) {
  return getOrdersRealtimeManager().subscribe(options);
}

class OrdersRealtimeManager {
  private readonly supabase = createSupabaseBrowserClient();
  private readonly consumers = new Map<string, OrdersRealtimeConsumer>();
  private channel: RealtimeChannel | null = null;
  private channelCloseExpected = false;
  private createdBySource: string | null = null;
  private fallbackReason: string | null = null;
  private pollingIntervalId: number | null = null;
  private subscriptionTimeoutId: number | null = null;

  subscribe(options: OrdersRealtimeSubscription) {
    const consumer: OrdersRealtimeConsumer = {
      id: `orders-realtime-consumer-${++consumerSequence}`,
      ...options,
    };

    this.consumers.set(consumer.id, consumer);
    this.log("orders_realtime_consumer_subscribe", {
      consumerId: consumer.id,
      source: consumer.source,
    });

    this.ensureChannel(consumer.source);

    if (this.fallbackReason) {
      consumer.onFallbackStart(this.fallbackReason);
    }

    return () => {
      this.unsubscribe(consumer.id);
    };
  }

  private unsubscribe(consumerId: string) {
    const consumer = this.consumers.get(consumerId);

    if (!consumer) {
      return;
    }

    this.consumers.delete(consumerId);
    this.log("orders_realtime_consumer_unsubscribe", {
      consumerId,
      source: consumer.source,
    });

    if (this.consumers.size === 0) {
      this.teardownChannel("last_consumer_unsubscribed");
    }
  }

  private ensureChannel(source: string) {
    if (this.channel) {
      this.log("orders_realtime_channel_reused", {
        requestedBy: source,
      });
      return;
    }

    this.createdBySource = source;
    this.channelCloseExpected = false;
    this.channel = this.supabase
      .channel(ORDERS_REALTIME_CHANNEL_NAME)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          this.log("orders_realtime_event", { event: "orders_insert" });
          this.notifyInsert(this.toRealtimeEvent("orders", "INSERT", payload));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          this.log("orders_realtime_event", { event: "orders_update" });
          this.notifyRefresh(this.toRealtimeEvent("orders", "UPDATE", payload));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders" },
        (payload) => {
          this.log("orders_realtime_event", { event: "orders_delete" });
          this.notifyRefresh(this.toRealtimeEvent("orders", "DELETE", payload));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_items" },
        (payload) => {
          this.log("orders_realtime_event", { event: "order_items_insert" });
          this.notifyRefresh(this.toRealtimeEvent("order_items", "INSERT", payload));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order_items" },
        (payload) => {
          this.log("orders_realtime_event", { event: "order_items_update" });
          this.notifyRefresh(this.toRealtimeEvent("order_items", "UPDATE", payload));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "order_items" },
        (payload) => {
          this.log("orders_realtime_event", { event: "order_items_delete" });
          this.notifyRefresh(this.toRealtimeEvent("order_items", "DELETE", payload));
        },
      )
      .subscribe((status, error) => {
        this.handleStatus(status, error?.message ?? null);
      });

    this.log("orders_realtime_channel_created", {
      channelName: ORDERS_REALTIME_CHANNEL_NAME,
      createdBySource: source,
    });

    this.armSubscriptionTimeout();
  }

  private handleStatus(status: OrdersRealtimeStatus, errorMessage: string | null) {
    const expectedClosed = status === "CLOSED" && this.channelCloseExpected;

    this.log("orders_realtime_channel_status", {
      status,
      error: errorMessage,
      expectedClosed,
    });

    if (status === "SUBSCRIBED") {
      this.clearSubscriptionTimeout();
      this.stopPolling();
      return;
    }

    if (status === "CHANNEL_ERROR" || status === "ERRORED" || status === "TIMED_OUT") {
      this.startPolling(status);
      return;
    }

    if (status === "CLOSED") {
      if (expectedClosed || this.consumers.size === 0) {
        this.channelCloseExpected = false;
        return;
      }

      this.startPolling(status);
    }
  }

  private armSubscriptionTimeout() {
    this.clearSubscriptionTimeout();
    this.subscriptionTimeoutId = window.setTimeout(() => {
      this.startPolling("SUBSCRIPTION_TIMEOUT");
    }, SUBSCRIPTION_TIMEOUT_MS);
  }

  private clearSubscriptionTimeout() {
    if (this.subscriptionTimeoutId !== null) {
      window.clearTimeout(this.subscriptionTimeoutId);
      this.subscriptionTimeoutId = null;
    }
  }

  private startPolling(reason: string) {
    if (this.pollingIntervalId !== null) {
      return;
    }

    this.fallbackReason = reason;
    this.log("orders_realtime_fallback_start", { reason });
    this.notifyFallbackStart(reason);
    this.pollingIntervalId = window.setInterval(() => {
      this.notifyRefresh({
        type: "UPDATE",
        table: "orders",
        orderId: null,
      });
    }, FALLBACK_POLL_INTERVAL_MS);
  }

  private stopPolling() {
    if (this.pollingIntervalId === null) {
      return;
    }

    window.clearInterval(this.pollingIntervalId);
    this.pollingIntervalId = null;
    this.fallbackReason = null;
    this.log("orders_realtime_fallback_stop");
    this.notifyFallbackStop();
  }

  private teardownChannel(reason: string) {
    this.clearSubscriptionTimeout();
    this.stopPolling();

    if (!this.channel) {
      return;
    }

    const channel = this.channel;
    this.channel = null;
    this.channelCloseExpected = true;
    this.log("orders_realtime_channel_unsubscribe", { reason });
    void this.supabase.removeChannel(channel);
  }

  private notifyRefresh(event: OrdersRealtimeEvent) {
    for (const consumer of this.consumers.values()) {
      consumer.onRefresh(event);
    }
  }

  private notifyInsert(event: OrdersRealtimeEvent) {
    for (const consumer of this.consumers.values()) {
      consumer.onInsert(event);
    }
  }

  private notifyFallbackStart(reason: string) {
    for (const consumer of this.consumers.values()) {
      consumer.onFallbackStart(reason);
    }
  }

  private notifyFallbackStop() {
    for (const consumer of this.consumers.values()) {
      consumer.onFallbackStop();
    }
  }

  private toRealtimeEvent(
    table: OrdersRealtimeEvent["table"],
    type: OrdersRealtimeEvent["type"],
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  ): OrdersRealtimeEvent {
    return {
      table,
      type,
      orderId: this.extractOrderId(table, type, payload),
    };
  }

  private extractOrderId(
    table: OrdersRealtimeEvent["table"],
    type: OrdersRealtimeEvent["type"],
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  ): string | null {
    const nextRow = this.asRecord(payload.new);
    const previousRow = this.asRecord(payload.old);

    if (table === "orders") {
      return this.readString(type === "DELETE" ? previousRow.id : nextRow.id);
    }

    return this.readString(type === "DELETE" ? previousRow.order_id : nextRow.order_id);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object") {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private readString(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private log(message: string, meta: Record<string, unknown> = {}) {
    const totalClientChannels = this.supabase.getChannels().length;

    logger.info(message, {
      ...meta,
      channelName: ORDERS_REALTIME_CHANNEL_NAME,
      createdBySource: this.createdBySource,
      activeConsumerSources: [...this.consumers.values()].map((consumer) => consumer.source),
      activeConsumerCount: this.consumers.size,
      multipleConsumersActive: this.consumers.size > 1,
      totalClientChannels,
      multipleClientChannelsAttached: totalClientChannels > 1,
    });
  }
}
