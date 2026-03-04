"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Category } from "@/lib/types/domain";

type Props = {
  categories: Category[];
  canManage: boolean;
};

export function CategoryManager({ categories, canManage }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const createCategory = async (formData: FormData) => {
    if (!canManage) return;
    setLoading(true);
    setStatus("");
    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        sortOrder: Number(formData.get("sortOrder") ?? 0),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error?.message ?? "Failed to create category");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  };

  const patchCategory = async (category: Category, formData: FormData) => {
    if (!canManage) return;
    setLoading(true);
    setStatus("");
    const response = await fetch(`/api/admin/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get(`name-${category.id}`) ?? category.name),
        sortOrder: Number(formData.get(`sort-${category.id}`) ?? category.sort_order),
        updatedAt: category.created_at,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error?.message ?? "Failed to update category");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <form action={createCategory} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-3">
        <Input name="name" placeholder="New category name" disabled={!canManage} />
        <Input name="sortOrder" type="number" min={0} placeholder="Sort order" disabled={!canManage} />
        <Button loading={loading} disabled={!canManage}>
          Add Category
        </Button>
      </form>
      <div className="space-y-3">
        {categories.map((category) => (
          <form
            key={category.id}
            action={(formData) => patchCategory(category, formData)}
            className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_120px_120px]"
          >
            <Input name={`name-${category.id}`} defaultValue={category.name} disabled={!canManage} />
            <Input
              name={`sort-${category.id}`}
              defaultValue={String(category.sort_order)}
              type="number"
              min={0}
              disabled={!canManage}
            />
            <Button variant="outline" loading={loading} disabled={!canManage}>
              Save
            </Button>
          </form>
        ))}
      </div>
      {status ? <p className="text-sm text-red-600">{status}</p> : null}
    </div>
  );
}

