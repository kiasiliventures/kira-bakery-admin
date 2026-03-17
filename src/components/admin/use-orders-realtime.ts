"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { subscribeToOrdersRealtime, type OrdersRealtimeEvent } from "@/lib/orders-realtime";

const REFRESH_DEBOUNCE_MS = 120;

type Options = {
  source: string;
  showNewOrderToast?: boolean;
  newOrderToastTitle?: string;
  autoRefresh?: boolean;
  refreshOnFallback?: boolean;
  onInsert?: (event: OrdersRealtimeEvent) => void;
  onRefresh?: (event: OrdersRealtimeEvent) => void;
  onFallbackStart?: (reason: string) => void;
  onFallbackStop?: () => void;
};

export function useOrdersRealtime(options: Options) {
  const {
    source,
    showNewOrderToast = false,
    newOrderToastTitle = "New order received.",
    autoRefresh = true,
    refreshOnFallback = true,
    onInsert,
    onRefresh,
    onFallbackStart,
    onFallbackStop,
  } = options;
  const router = useRouter();
  const { toast } = useToast();
  const refreshTimeoutRef = useRef<number | null>(null);
  const fallbackToastShownRef = useRef(false);
  const fallbackActiveRef = useRef(false);

  const queueRefresh = useEffectEvent(() => {
    if (refreshTimeoutRef.current !== null) {
      return;
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      refreshTimeoutRef.current = null;
      router.refresh();
    }, REFRESH_DEBOUNCE_MS);
  });

  const handleRefresh = useEffectEvent((event: OrdersRealtimeEvent) => {
    onRefresh?.(event);

    if (autoRefresh || (refreshOnFallback && fallbackActiveRef.current)) {
      queueRefresh();
    }
  });

  const handleInsert = useEffectEvent((event: OrdersRealtimeEvent) => {
    onInsert?.(event);

    if (showNewOrderToast) {
      toast({ title: newOrderToastTitle });
    }

    if (autoRefresh) {
      queueRefresh();
    }
  });

  const handleFallbackStart = useEffectEvent((reason: string) => {
    fallbackActiveRef.current = true;

    if (!fallbackToastShownRef.current) {
      fallbackToastShownRef.current = true;
      toast({ title: "Live order updates disconnected. Using background refresh." });
    }

    onFallbackStart?.(reason);

    if (refreshOnFallback) {
      queueRefresh();
    }
  });

  const handleFallbackStop = useEffectEvent(() => {
    fallbackActiveRef.current = false;

    if (fallbackToastShownRef.current) {
      toast({ title: "Live order updates reconnected." });
    }

    fallbackToastShownRef.current = false;
    onFallbackStop?.();
  });

  useEffect(() => {
    const unsubscribe = subscribeToOrdersRealtime({
      source,
      onRefresh: handleRefresh,
      onInsert: handleInsert,
      onFallbackStart: handleFallbackStart,
      onFallbackStop: handleFallbackStop,
    });

    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      fallbackActiveRef.current = false;
      unsubscribe();
    };
  }, [source]);
}
