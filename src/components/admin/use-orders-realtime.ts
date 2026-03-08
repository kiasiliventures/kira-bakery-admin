"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Options = {
  showNewOrderToast?: boolean;
  newOrderToastTitle?: string;
};

export function useOrdersRealtime(options: Options = {}) {
  const { showNewOrderToast = false, newOrderToastTitle = "New order received." } = options;
  const router = useRouter();
  const { toast } = useToast();
  const refreshTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const queueRefresh = () => {
      if (refreshTimeoutRef.current !== null) {
        return;
      }

      refreshTimeoutRef.current = window.setTimeout(() => {
        refreshTimeoutRef.current = null;
        router.refresh();
      }, 120);
    };

    const channel = supabase
      .channel("admin-orders-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => {
          if (showNewOrderToast) {
            toast({ title: newOrderToastTitle });
          }
          queueRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        queueRefresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_items" },
        queueRefresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order_items" },
        queueRefresh,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "order_items" },
        queueRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [newOrderToastTitle, router, showNewOrderToast, toast]);
}
