"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Category, Product } from "@/lib/types/domain";

type Props = {
  product: Product;
  categories: Category[];
  canManage: boolean;
};

export function ProductDetailManager({ product, categories, canManage }: Props) {
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
        categoryId: String(formData.get("categoryId") ?? product.category_id),
        name: String(formData.get("name") ?? product.name),
        description: String(formData.get("description") ?? product.description ?? ""),
        basePrice: Number(formData.get("basePrice") ?? product.base_price),
        stockQuantity: Number(formData.get("stockQuantity") ?? product.stock_quantity),
        updatedAt: product.updated_at,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error?.message ?? "Failed to update product");
      setLoading(false);
      return;
    }

    const updated = payload.data?.product as Product | undefined;
    const file = formData.get("imageFile");

    if (updated && file instanceof File && file.size > 0 && file.type.startsWith("image/")) {
      const uploadFormData = new FormData();
      uploadFormData.set("file", file);
      const uploadResponse = await fetch(`/api/admin/products/${product.id}/image`, {
        method: "POST",
        body: uploadFormData,
      });
      const uploadPayload = await uploadResponse.json();
      if (!uploadResponse.ok) {
        setStatus(uploadPayload.error?.message ?? "Product updated, but image upload failed");
        setLoading(false);
        return;
      }
    }

    router.refresh();
    setLoading(false);
  };

  const deleteProduct = async () => {
    if (!canManage) return;
    const confirmed = window.confirm("Delete this product and all uploaded images?");
    if (!confirmed) return;

    setLoading(true);
    setStatus("");
    const response = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error?.message ?? "Failed to delete product");
      setLoading(false);
      return;
    }
    router.replace("/products");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <form action={patchProduct} className="space-y-3 rounded-xl border border-slate-200 p-4">
        <select
          name="categoryId"
          defaultValue={product.category_id}
          className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
          disabled={!canManage}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <Input name="name" defaultValue={product.name} disabled={!canManage} />
        <Input name="description" defaultValue={product.description ?? ""} disabled={!canManage} />
        <Input
          name="basePrice"
          type="number"
          min={0}
          step="0.01"
          defaultValue={String(product.base_price)}
          disabled={!canManage}
        />
        <Input
          name="stockQuantity"
          type="number"
          min={0}
          defaultValue={String(product.stock_quantity)}
          disabled={!canManage}
        />
        <Input name="imageFile" type="file" accept="image/*" disabled={!canManage} />
        <div className="flex gap-2">
          <Button loading={loading} disabled={!canManage}>
            Save Product
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={deleteProduct}
            loading={loading}
            disabled={!canManage}
          >
            Delete Product
          </Button>
        </div>
      </form>
      {status ? <p className="text-sm text-red-600">{status}</p> : null}
    </div>
  );
}
