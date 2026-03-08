"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { subscribeToOrdersRealtime } from "@/lib/orders-realtime";

const REFRESH_DEBOUNCE_MS = 120;

type Options = {
  source: string;
  showNewOrderToast?: boolean;
  newOrderToastTitle?: string;
};

export function useOrdersRealtime(options: Options) {
  const {
    source,
    showNewOrderToast = false,
    newOrderToastTitle = "New order received.",
  } = options;
  const router = useRouter();
  const { toast } = useToast();
  const refreshTimeoutRef = useRef<number | null>(null);
  const fallbackToastShownRef = useRef(false);

  const queueRefresh = useEffectEvent(() => {
    if (refreshTimeoutRef.current !== null) {
      return;
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      refreshTimeoutRef.current = null;
      router.refresh();
    }, REFRESH_DEBOUNCE_MS);
  });

  const handleInsert = useEffectEvent(() => {
    if (showNewOrderToast) {
      toast({ title: newOrderToastTitle });
    }
    queueRefresh();
  });

  const handleFallbackStart = useEffectEvent(() => {
    if (!fallbackToastShownRef.current) {
      fallbackToastShownRef.current = true;
      toast({ title: "Live order updates disconnected. Using background refresh." });
    }

    queueRefresh();
  });

  const handleFallbackStop = useEffectEvent(() => {
    if (fallbackToastShownRef.current) {
      toast({ title: "Live order updates reconnected." });
    }

    fallbackToastShownRef.current = false;
  });

  useEffect(() => {
    const unsubscribe = subscribeToOrdersRealtime({
      source,
      onRefresh: queueRefresh,
      onInsert: handleInsert,
      onFallbackStart: handleFallbackStart,
      onFallbackStop: handleFallbackStop,
    });

    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      unsubscribe();
    };
  }, [source]);
}
