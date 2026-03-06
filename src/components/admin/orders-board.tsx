"use client";

import * as React from "react";
import { Clock3, Truck } from "lucide-react";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToastBanner } from "@/components/ui/toast";
import { getOrdersByStatus, timeAgo } from "@/lib/mock";
import type { Order, OrderStatus } from "@/lib/types";

const statuses: OrderStatus[] = ["Pending", "In Progress", "Ready", "Delivered"];

function actionLabel(status: OrderStatus): string {
  if (status === "Pending") return "Move to In Progress";
  if (status === "In Progress") return "Mark Ready";
  if (status === "Ready") return "Mark Delivered";
  return "Completed";
}

function nextStatus(status: OrderStatus): OrderStatus {
  if (status === "Pending") return "In Progress";
  if (status === "In Progress") return "Ready";
  if (status === "Ready") return "Delivered";
  return "Delivered";
}

export function OrdersBoard() {
  const [activeTab, setActiveTab] = React.useState<OrderStatus>("Pending");
  const [bannerVisible, setBannerVisible] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Order | null>(null);
  const [rows, setRows] = React.useState(
    statuses.flatMap((status) => getOrdersByStatus(status)),
  );

  React.useEffect(() => {
    if (activeTab !== "Pending") {
      setBannerVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setBannerVisible(true), 2000);
    return () => window.clearTimeout(timer);
  }, [activeTab]);

  const byTab = (status: OrderStatus) => rows.filter((row) => row.status === status);

  const handleMove = (id: string, status: OrderStatus) => {
    setRows((previous) =>
      previous.map((row) => (row.id === id ? { ...row, status: nextStatus(status) } : row)),
    );
  };

  return (
    <>
      <Tabs defaultValue="Pending" value={activeTab} onValueChange={(value) => setActiveTab(value as OrderStatus)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {statuses.map((status) => (
              <TabsTrigger key={status} value={status}>
                {status}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Total pending: {byTab("Pending").length}</span>
            <Select className="w-44">
              <option>Move Orders to ...</option>
              <option>In Progress</option>
              <option>Ready</option>
              <option>Delivered</option>
            </Select>
          </div>
        </div>
        {statuses.map((status) => (
          <TabsContent key={status} value={status} className="space-y-3">
            {byTab(status).map((order) => (
              <article
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-kira-border bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
              >
                <button
                  type="button"
                  className="flex items-center gap-3 text-left"
                  onClick={() => {
                    setSelected(order);
                    setOpen(true);
                  }}
                >
                  <img src={order.image} alt={order.id} className="h-12 w-12 rounded-xl object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{order.id}</p>
                    <p className="text-sm text-slate-500">{order.customer}</p>
                  </div>
                </button>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock3 className="h-4 w-4" />
                  {timeAgo(order.createdAt)}
                  <span className="ml-2 rounded-[10px] bg-kira-bg px-2 py-1 text-xs text-kira-red">
                    {order.type}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={order.status} />
                  {status !== "Delivered" ? (
                    <Button size="sm" onClick={() => handleMove(order.id, status)}>
                      {actionLabel(status)}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline">
                      <Truck className="h-4 w-4" />
                      Done
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </TabsContent>
        ))}
      </Tabs>
      <ToastBanner visible={bannerVisible} title="New order received in Pending queue." />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Order details</SheetTitle>
          </SheetHeader>
          {selected ? (
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>
                <strong className="text-slate-900">Order:</strong> {selected.id}
              </p>
              <p>
                <strong className="text-slate-900">Customer:</strong> {selected.customer}
              </p>
              <p>
                <strong className="text-slate-900">Time:</strong> {timeAgo(selected.createdAt)}
              </p>
              <p>
                <strong className="text-slate-900">Type:</strong> {selected.type}
              </p>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
