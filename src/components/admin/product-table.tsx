"use client";

import Link from "next/link";
import * as React from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, products } from "@/lib/mock";

export function ProductTable() {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const filtered = products.filter((product) =>
    product.name.toLowerCase().includes(query.toLowerCase().trim()),
  );

  return (
    <>
      <DataTable
        searchPlaceholder="Search products"
        onSearch={setQuery}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-kira-red px-4 text-sm font-medium text-white hover:bg-kira-red-hover active:bg-kira-red-active">
              <Plus className="h-4 w-4" />
              Add Product
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Product</DialogTitle>
                <DialogDescription>Mock form only for this UI redesign.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-3">
                <Input placeholder="Product name" />
                <Input placeholder="Price" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setOpen(false)}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <img src={product.image} alt={product.name} className="h-10 w-10 rounded-lg object-cover" />
                    <span className="text-sm text-slate-800">{product.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusPill status={product.status} />
                </TableCell>
                <TableCell>{formatCurrency(product.price)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/products/${product.id}`}>
                      <Button size="sm">Edit</Button>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-kira-border bg-white hover:bg-slate-100">
                        <MoreHorizontal className="h-4 w-4 text-slate-600" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View</DropdownMenuItem>
                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                        <DropdownMenuItem>Archive</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
    </>
  );
}
