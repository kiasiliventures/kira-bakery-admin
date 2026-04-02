"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Category, Product } from "@/lib/types/domain";

type Props = {
  product: Product;
  categories: Category[];
  canManage: boolean;
};

type StatusMessage = {
  tone: "error" | "success";
  text: string;
};

function getStatusClassName(tone: StatusMessage["tone"]): string {
  return tone === "error" ? "text-sm text-red-600" : "text-sm text-emerald-700";
}

export function ProductDetailManager({ product, categories, canManage }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [actionState, setActionState] = useState<"idle" | "saving" | "unpublishing" | "deleting">("idle");
  const [isPublished, setIsPublished] = useState(product.is_published);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState(product.updated_at);
  const [categoryId, setCategoryId] = useState(product.category_id);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [basePrice, setBasePrice] = useState(String(product.base_price));
  const [stockQuantity, setStockQuantity] = useState(String(product.stock_quantity));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(product.image_url);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const categoryLabel = useMemo(
    () => categories.find((category) => category.id === categoryId)?.name ?? "Uncategorized",
    [categories, categoryId],
  );

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const handleImageChange = (file: File | null) => {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }

    if (file && file.size > 0 && file.type.startsWith("image/")) {
      const nextPreviewUrl = URL.createObjectURL(file);
      setImageFile(file);
      setLocalPreviewUrl(nextPreviewUrl);
      setImagePreviewUrl(nextPreviewUrl);
      return;
    }

    setImageFile(null);
    setImagePreviewUrl(product.image_url);
  };

  const patchProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) return;

    setActionState("saving");
    setStatus(null);

    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        name,
        description,
        basePrice: Number(basePrice),
        stockQuantity: Number(stockQuantity),
        updatedAt: currentUpdatedAt,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setStatus({
        tone: "error",
        text: payload.error?.message ?? "Failed to update product",
      });
      setActionState("idle");
      return;
    }

    const updatedProduct = payload.data?.product as Product | undefined;
    if (updatedProduct) {
      setCurrentUpdatedAt(updatedProduct.updated_at);
      setIsPublished(updatedProduct.is_published);
    }

    if (imageFile) {
      const uploadFormData = new FormData();
      uploadFormData.set("file", imageFile);

      const uploadResponse = await fetch(`/api/admin/products/${product.id}/image`, {
        method: "POST",
        body: uploadFormData,
      });

      const uploadPayload = await uploadResponse.json();
      if (!uploadResponse.ok) {
        setStatus({
          tone: "error",
          text: uploadPayload.error?.message ?? "Product updated, but image upload failed",
        });
        setActionState("idle");
        return;
      }
    }

    setStatus({
      tone: "success",
      text: "Product changes saved.",
    });
    setActionState("idle");
    router.refresh();
  };

  const unpublishProduct = async () => {
    if (!canManage || !isPublished) return;

    const confirmed = window.confirm(
      "Unpublish this product? It will stop appearing in the client storefront but remain in the admin dashboard.",
    );
    if (!confirmed) return;

    setActionState("unpublishing");
    setStatus(null);

    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isPublished: false,
        updatedAt: currentUpdatedAt,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setStatus({
        tone: "error",
        text: payload.error?.message ?? "Failed to unpublish product",
      });
      setActionState("idle");
      return;
    }

    const updatedProduct = payload.data?.product as Product | undefined;
    if (updatedProduct) {
      setCurrentUpdatedAt(updatedProduct.updated_at);
      setIsPublished(updatedProduct.is_published);
    } else {
      setIsPublished(false);
    }

    setStatus({
      tone: "success",
      text: "Product unpublished.",
    });
    setActionState("idle");
    router.refresh();
  };

  const deleteProduct = async () => {
    if (!canManage) return;

    const confirmed = window.confirm(
      "Delete this product? If it has existing orders, it will be unpublished instead so order history stays intact.",
    );
    if (!confirmed) return;

    setActionState("deleting");
    setStatus(null);

    const response = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
    const payload = await response.json();

    if (!response.ok) {
      setStatus({
        tone: "error",
        text: payload.error?.message ?? "Failed to delete product",
      });
      setActionState("idle");
      return;
    }

    if (payload.data?.archived) {
      const retiredProduct = payload.data?.product as Product | undefined;
      setIsPublished(false);
      setStockQuantity("0");
      if (retiredProduct?.updated_at) {
        setCurrentUpdatedAt(retiredProduct.updated_at);
      }
      setStatus({
        tone: "success",
        text:
          payload.data?.message ??
          "This product has order history, so it was unpublished instead of deleted.",
      });
      setActionState("idle");
      router.refresh();
      return;
    }

    router.replace("/products");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={patchProduct} className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-900">Product image</p>
              <p className="text-sm text-slate-500">
                Keep the image fresh so the product stays recognizable across the catalog.
              </p>
            </div>

            <div className="mt-4 space-y-4">
              <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100">
                <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
                  {imagePreviewUrl ? (
                    <img
                      src={imagePreviewUrl}
                      alt={name ? `${name} image preview` : "Product image preview"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_rgba(241,245,249,1))] px-6 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-semibold text-slate-400 shadow-sm">
                        {name.trim().slice(0, 1).toUpperCase() || "P"}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-700">No product image yet</p>
                        <p className="text-sm text-slate-500">
                          Upload a bakery photo to give this product a clear visual identity.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <div className="space-y-2">
                  <Label htmlFor="imageFile">Upload or replace image</Label>
                  <Input
                    id="imageFile"
                    name="imageFile"
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)}
                    disabled={!canManage}
                  />
                  <p className="text-xs text-slate-500">
                    JPEG, PNG, or WebP up to 5MB. The preview updates immediately before saving.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                  Current category
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">{categoryLabel}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-900">Product details</p>
              <p className="text-sm text-slate-500">
                Update pricing, stock, and copy without leaving the current editor.
              </p>
            </div>

            <div className="mt-5 grid gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="categoryId">Category</Label>
                  <select
                    id="categoryId"
                    name="categoryId"
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className="h-10 w-full rounded-[12px] border border-kira-border bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kira-red/30"
                    disabled={!canManage}
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name">Product name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Product name"
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Short product description"
                    className="min-h-32"
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="basePrice">Price</Label>
                  <Input
                    id="basePrice"
                    name="basePrice"
                    type="number"
                    min={0}
                    step="0.01"
                    value={basePrice}
                    onChange={(event) => setBasePrice(event.target.value)}
                    placeholder="Price"
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stockQuantity">Stock quantity</Label>
                  <Input
                    id="stockQuantity"
                    name="stockQuantity"
                    type="number"
                    min={0}
                    step="1"
                    value={stockQuantity}
                    onChange={(event) => setStockQuantity(event.target.value)}
                    placeholder="Stock quantity"
                    disabled={!canManage}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)] sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900">Actions</p>
            <p className="text-sm text-slate-500">
              Save product edits, explicitly unpublish the product, or remove it when no orders depend on it.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={unpublishProduct}
              loading={actionState === "unpublishing"}
              disabled={!canManage || !isPublished || actionState !== "idle"}
              className="sm:min-w-[160px]"
            >
              {isPublished ? "Unpublish Product" : "Already Unpublished"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={deleteProduct}
              loading={actionState === "deleting"}
              disabled={!canManage || actionState !== "idle"}
              className="sm:min-w-[140px]"
            >
              Delete Product
            </Button>
            <Button
              loading={actionState === "saving"}
              disabled={!canManage || actionState !== "idle"}
              className="sm:min-w-[140px]"
            >
              Save Changes
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm text-slate-500">
            Storefront status:{" "}
            <span className="font-medium text-slate-900">
              {isPublished ? "Published" : "Unpublished"}
            </span>
          </p>
          <Link
            href="/products"
            className="inline-flex h-10 items-center justify-center rounded-[12px] border border-kira-border bg-white px-4 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100"
          >
            Back to Products
          </Link>
        </div>
      </form>

      {status ? <p className={getStatusClassName(status.tone)}>{status.text}</p> : null}
    </div>
  );
}
