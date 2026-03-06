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
  const [createProductStage, setCreateProductStage] = useState<
    "idle" | "creating" | "uploading" | "refreshing"
  >("idle");
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id ?? "");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySortOrder, setNewCategorySortOrder] = useState("0");
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
    if (!selectedCategoryId || selectedCategoryId === "__create__") {
      setStatus("Select a category or create one first.");
      return;
    }

    setCreateProductStage("creating");
    setStatus("Creating product...");
    const response = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: selectedCategoryId,
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        imageUrl: "",
        basePrice: Number(formData.get("basePrice") ?? 0),
        stockQuantity: Number(formData.get("stockQuantity") ?? 0),
        isAvailable: true,
        isFeatured: false,
        isPublished: true,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error?.message ?? "Failed to create product");
      setCreateProductStage("idle");
      return;
    }

    const created = payload.data?.product as Product | undefined;
    const file = formData.get("imageFile");
    if (
      created &&
      file instanceof File &&
      file.size > 0 &&
      file.type.startsWith("image/")
    ) {
      setCreateProductStage("uploading");
      setStatus("Uploading product image...");
      const uploadFormData = new FormData();
      uploadFormData.set("file", file);
      const uploadResponse = await fetch(`/api/admin/products/${created.id}/image`, {
        method: "POST",
        body: uploadFormData,
      });

      const uploadPayload = await uploadResponse.json();
      if (!uploadResponse.ok) {
        setStatus(uploadPayload.error?.message ?? "Product created, but image upload failed");
        setCreateProductStage("idle");
        return;
      }
    }

    setCreateProductStage("refreshing");
    setStatus("Refreshing products...");
    router.refresh();
    setCreateProductStage("idle");
  };

  const createCategoryInline = async () => {
    if (!canManage) return;
    setLoading(true);
    setStatus("");
    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newCategoryName.trim(),
        sortOrder: Number(newCategorySortOrder || 0),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error?.message ?? "Failed to create category");
      setLoading(false);
      return;
    }
    const created = payload.data?.category as Category | undefined;
    if (!created) {
      setStatus("Category created but response was invalid.");
      setLoading(false);
      return;
    }

    setCategoryOptions((previous) => [...previous, created]);
    setSelectedCategoryId(created.id);
    setNewCategoryName("");
    setNewCategorySortOrder("0");
    setLoading(false);
  };

  const toggleField = async (
    product: Product,
    field: "is_featured",
  ) => {
    if (!canManage) return;
    setLoading(true);
    setStatus("");
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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

  const deleteProduct = async (product: Product) => {
    if (!canManage) return;
    const confirmed = window.confirm(`Delete "${product.name}" and all stored images?`);
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
    router.refresh();
    setLoading(false);
  };

  const createProductLabel =
    createProductStage === "creating"
      ? "Creating..."
      : createProductStage === "uploading"
        ? "Uploading..."
        : createProductStage === "refreshing"
          ? "Refreshing..."
          : "Create Product";

  return (
    <div className="space-y-6">
      <form action={createProduct} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-2">
        <select
          name="categoryId"
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
          value={selectedCategoryId}
          onChange={(event) => setSelectedCategoryId(event.target.value)}
          disabled={!canManage}
        >
          {categoryOptions.length === 0 ? <option value="">No categories found</option> : null}
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value="__create__">+ Create new category</option>
        </select>
        <Input name="name" placeholder="Product name" disabled={!canManage} />
        <Input name="description" placeholder="Description" disabled={!canManage} />
        <Input name="basePrice" type="number" min={0} step="0.01" placeholder="Price" disabled={!canManage} />
        <Input name="stockQuantity" type="number" min={0} placeholder="Stock quantity" disabled={!canManage} />
        <Input name="imageFile" type="file" accept="image/*" disabled={!canManage} />
        {selectedCategoryId === "__create__" ? (
          <>
            <Input
              placeholder="New category name"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              disabled={!canManage}
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                placeholder="Sort order"
                value={newCategorySortOrder}
                onChange={(event) => setNewCategorySortOrder(event.target.value)}
                disabled={!canManage}
              />
              <Button
                type="button"
                onClick={createCategoryInline}
                loading={loading}
                disabled={!canManage || !newCategoryName.trim()}
              >
                Create category
              </Button>
            </div>
          </>
        ) : null}
        <Button
          className="md:col-span-2"
          loading={createProductStage !== "idle"}
          disabled={!canManage || createProductStage !== "idle"}
        >
          {createProductLabel}
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
                <p className="text-xs text-slate-500">
                  Price: UGX {product.base_price} |{" "}
                  Stock: {product.stock_quantity} | {product.is_available ? "Available" : "Unavailable"}
                </p>
              </div>
              <Link
                href={`/products/${product.id}`}
                className="text-sm text-indigo-600 hover:underline"
              >
                Edit product
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={product.is_featured ? "default" : "outline"}
                onClick={() => toggleField(product, "is_featured")}
                disabled={!canManage}
              >
                {product.is_featured ? "Featured" : "Not featured"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteProduct(product)}
                disabled={!canManage}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
      {status ? <p className="text-sm text-red-600">{status}</p> : null}
    </div>
  );
}
