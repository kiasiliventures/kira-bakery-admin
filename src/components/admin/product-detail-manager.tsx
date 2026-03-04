"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Product, ProductVariant } from "@/lib/types/domain";

type Props = {
  product: Product;
  variants: ProductVariant[];
  canManage: boolean;
};

export function ProductDetailManager({ product, variants, canManage }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const patchProduct = async (formData: FormData) => {
    if (!canManage) return;
    setLoading(true);
    setStatus("");
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? product.name),
        description: String(formData.get("description") ?? product.description ?? ""),
        imageUrl: String(formData.get("imageUrl") ?? product.image_url ?? ""),
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

  const createVariant = async (formData: FormData) => {
    if (!canManage) return;
    setLoading(true);
    setStatus("");
    const response = await fetch("/api/admin/variants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        name: String(formData.get("variantName") ?? ""),
        price: Number(formData.get("variantPrice") ?? 0),
        sortOrder: Number(formData.get("variantSortOrder") ?? 0),
        isAvailable: true,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error?.message ?? "Failed to create variant");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  };

  const patchVariant = async (variant: ProductVariant, formData: FormData) => {
    if (!canManage) return;
    setLoading(true);
    setStatus("");
    const response = await fetch(`/api/admin/variants/${variant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get(`name-${variant.id}`) ?? variant.name),
        price: Number(formData.get(`price-${variant.id}`) ?? variant.price),
        sortOrder: Number(formData.get(`sort-${variant.id}`) ?? variant.sort_order),
        isAvailable: formData.get(`available-${variant.id}`) === "on",
        updatedAt: variant.updated_at,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error?.message ?? "Failed to update variant");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <form action={patchProduct} className="space-y-3 rounded-xl border border-slate-200 p-4">
        <Input name="name" defaultValue={product.name} disabled={!canManage} />
        <Input
          name="description"
          defaultValue={product.description ?? ""}
          disabled={!canManage}
        />
        <Input name="imageUrl" defaultValue={product.image_url ?? ""} disabled={!canManage} />
        <Button loading={loading} disabled={!canManage}>
          Save Product
        </Button>
      </form>

      <form action={createVariant} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-4">
        <Input name="variantName" placeholder="Variant name" disabled={!canManage} />
        <Input name="variantPrice" type="number" step="0.01" placeholder="Price" disabled={!canManage} />
        <Input
          name="variantSortOrder"
          type="number"
          placeholder="Sort order"
          disabled={!canManage}
        />
        <Button loading={loading} disabled={!canManage}>
          Add Variant
        </Button>
      </form>

      <div className="space-y-3">
        {variants.map((variant) => (
          <form
            key={variant.id}
            action={(formData) => patchVariant(variant, formData)}
            className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-5"
          >
            <Input name={`name-${variant.id}`} defaultValue={variant.name} disabled={!canManage} />
            <Input
              name={`price-${variant.id}`}
              defaultValue={String(variant.price)}
              type="number"
              step="0.01"
              disabled={!canManage}
            />
            <Input
              name={`sort-${variant.id}`}
              defaultValue={String(variant.sort_order)}
              type="number"
              disabled={!canManage}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name={`available-${variant.id}`}
                defaultChecked={variant.is_available}
                disabled={!canManage}
              />
              Available
            </label>
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

