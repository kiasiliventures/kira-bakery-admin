"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Product } from "@/lib/types/domain";

type Props = {
  products: Product[];
  canManage: boolean;
};

export function InventoryTable({ products, canManage }: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [rows, setRows] = React.useState(products);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState("");

  const filtered = React.useMemo(() => {
    const value = query.toLowerCase().trim();
    return rows.filter((product) => {
      if (!value) return true;
      return (
        product.name.toLowerCase().includes(value) ||
        (product.description ?? "").toLowerCase().includes(value)
      );
    });
  }, [rows, query]);

  const saveStock = async (product: Product) => {
    if (!canManage) return;
    setLoadingId(product.id);
    setStatus("");
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stockQuantity: product.stock_quantity,
        updatedAt: product.updated_at,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error?.message ?? "Failed to update stock");
      setLoadingId(null);
      return;
    }
    router.refresh();
    setLoadingId(null);
  };

  return (
    <div className="rounded-2xl border border-kira-border bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search inventory"
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-9 w-9 rounded-lg object-cover" />
                    ) : (
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-xs text-slate-500">
                        N/A
                      </div>
                    )}
                    <div>
                      <p>{product.name}</p>
                      <p className="text-xs text-slate-500">{product.description ?? "No description"}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="w-28">
                  <Input
                    type="number"
                    min={0}
                    value={product.stock_quantity}
                    disabled={!canManage || loadingId === product.id}
                    onChange={(event) =>
                      setRows((previous) =>
                        previous.map((row) =>
                          row.id === product.id
                            ? {
                                ...row,
                                stock_quantity: Math.max(0, Number(event.target.value || 0)),
                              }
                            : row,
                        ),
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <span className={product.is_available ? "text-emerald-700" : "text-orange-700"}>
                    {product.is_available ? "Yes" : "No"}
                  </span>
                </TableCell>
                <TableCell>{product.is_published ? "Yes" : "No"}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={loadingId === product.id}
                    disabled={!canManage}
                    onClick={() => saveStock(product)}
                  >
                    Save stock
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {status ? <p className="mt-3 text-sm text-red-600">{status}</p> : null}
    </div>
  );
}
