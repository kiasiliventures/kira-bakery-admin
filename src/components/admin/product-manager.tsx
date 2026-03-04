"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Category, Product } from "@/lib/types/domain";

type Props = {
  products: Product[];
  categories: Category[];
  canManage: boolean;
};

export function ProductManager({ products, categories, canManage }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const lower = query.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(lower) ||
        (product.description ?? "").toLowerCase().includes(lower),
    );
  }, [products, query]);

  const createProduct = async (formData: FormData) => {
    if (!canManage) return;
    setLoading(true);
    setStatus("");
    const response = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: String(formData.get("categoryId") ?? ""),
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        imageUrl: String(formData.get("imageUrl") ?? ""),
        isAvailable: true,
        isFeatured: false,
        isPublished: false,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error?.message ?? "Failed to create product");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  };

  const toggleField = async (
    product: Product,
    field: "is_available" | "is_published" | "is_featured",
  ) => {
    if (!canManage) return;
    setLoading(true);
    setStatus("");
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isAvailable: field === "is_available" ? !product.is_available : product.is_available,
        isPublished: field === "is_published" ? !product.is_published : product.is_published,
        isFeatured: field === "is_featured" ? !product.is_featured : product.is_featured,
        updatedAt: product.updated_at,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error?.message ?? "Failed to update product");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <form action={createProduct} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-2">
        <select
          name="categoryId"
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
          disabled={!canManage}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <Input name="name" placeholder="Product name" disabled={!canManage} />
        <Input name="description" placeholder="Description" disabled={!canManage} />
        <Input name="imageUrl" placeholder="Image URL" disabled={!canManage} />
        <Button className="md:col-span-2" loading={loading} disabled={!canManage}>
          Create Product
        </Button>
      </form>

      <div className="flex items-center justify-between">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products..."
          className="max-w-sm"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((product) => (
          <div key={product.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{product.name}</p>
                <p className="text-sm text-slate-500">{product.description ?? "No description"}</p>
              </div>
              <Link
                href={`/products/${product.id}`}
                className="text-sm text-indigo-600 hover:underline"
              >
                Manage variants
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={product.is_available ? "default" : "outline"}
                onClick={() => toggleField(product, "is_available")}
                disabled={!canManage}
              >
                {product.is_available ? "Available" : "Unavailable"}
              </Button>
              <Button
                size="sm"
                variant={product.is_published ? "default" : "outline"}
                onClick={() => toggleField(product, "is_published")}
                disabled={!canManage}
              >
                {product.is_published ? "Published" : "Draft"}
              </Button>
              <Button
                size="sm"
                variant={product.is_featured ? "default" : "outline"}
                onClick={() => toggleField(product, "is_featured")}
                disabled={!canManage}
              >
                {product.is_featured ? "Featured" : "Not featured"}
              </Button>
            </div>
          </div>
        ))}
      </div>
      {status ? <p className="text-sm text-red-600">{status}</p> : null}
    </div>
  );
}
