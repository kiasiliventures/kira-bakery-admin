"use client";

import * as React from "react";
import { MoreHorizontal, Minus, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Variant } from "@/lib/types";

export function VariantsTable({ variants }: { variants: Variant[] }) {
  const [rows, setRows] = React.useState(variants);

  const adjustSort = (id: string, next: number) => {
    setRows((previous) =>
      previous.map((row) => (row.id === id ? { ...row, sortOrder: Math.max(1, next) } : row)),
    );
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Variant</TableHead>
            <TableHead>Flavor</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Sort Order</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((variant) => (
            <TableRow key={variant.id}>
              <TableCell className="min-w-36">
                <Select defaultValue={variant.size}>
                  <option value="6 inch">6 inch</option>
                  <option value="8 inch">8 inch</option>
                  <option value="10 inch">10 inch</option>
                </Select>
              </TableCell>
              <TableCell className="min-w-36">
                <Select defaultValue={variant.flavor}>
                  <option value="Vanilla">Vanilla</option>
                  <option value="Chocolate">Chocolate</option>
                  <option value="Red Velvet">Red Velvet</option>
                </Select>
              </TableCell>
              <TableCell className="min-w-32">
                <Input defaultValue={variant.price} />
              </TableCell>
              <TableCell className="min-w-32">
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-kira-border"
                    onClick={() => adjustSort(variant.id, variant.sortOrder - 1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm text-slate-700">{variant.sortOrder}</span>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-kira-border"
                    onClick={() => adjustSort(variant.id, variant.sortOrder + 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-kira-border">
                    <MoreHorizontal className="h-4 w-4 text-slate-600" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem>Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
