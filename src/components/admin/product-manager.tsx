"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Category, Product } from "@/lib/types/domain";

type Props = {
  products: Product[];
  categories: Category[];
  canManage: boolean;
};

type CreateProductStage = "idle" | "creating" | "uploading" | "refreshing";
type StatusTone = "error" | "info" | "success";

interface ProductDraft {
  id: string;
  category: string;
  name: string;
  description: string;
  price: string;
  stock: string;
  imageFile: File | null;
  imagePreview: string | null;
}

type StatusMessage = {
  tone: StatusTone;
  text: string;
};

type CreatedProductResult = {
  clientRequestId: string | null;
  product: Product | null;
};

const priceFormatter = new Intl.NumberFormat("en-UG", {
  maximumFractionDigits: 0,
});

function createEmptyDraft(id: string, defaultCategoryId: string): ProductDraft {
  return {
    id,
    category: defaultCategoryId,
    name: "",
    description: "",
    price: "",
    stock: "",
    imageFile: null,
    imagePreview: null,
  };
}

function isDraftFilled(draft: ProductDraft): boolean {
  return (
    draft.name.trim().length > 0 ||
    draft.description.trim().length > 0 ||
    draft.price.trim().length > 0 ||
    draft.stock.trim().length > 0 ||
    draft.imageFile !== null
  );
}

function getDraftValidationError(draft: ProductDraft): string | null {
  if (!isDraftFilled(draft)) {
    return null;
  }

  if (!draft.category) {
    return "Select a category.";
  }

  if (draft.name.trim().length < 2) {
    return "Enter a product name with at least 2 characters.";
  }

  if (draft.description.trim().length > 1000) {
    return "Description must be 1000 characters or fewer.";
  }

  const price = Number(draft.price);
  if (!draft.price.trim() || !Number.isFinite(price) || price < 0) {
    return "Enter a valid price.";
  }

  const stock = Number(draft.stock);
  if (!draft.stock.trim() || !Number.isInteger(stock) || stock < 0) {
    return "Enter a valid stock quantity.";
  }

  return null;
}

function getStatusClassName(tone: StatusTone): string {
  if (tone === "error") {
    return "text-sm text-red-600";
  }

  if (tone === "success") {
    return "text-sm text-emerald-700";
  }

  return "text-sm text-slate-600";
}

export function ProductManager({ products, categories, canManage }: Props) {
  const router = useRouter();
  const draftSequenceRef = useRef(2);
  const previewUrlsRef = useRef<Map<string, string>>(new Map());

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [createProductStage, setCreateProductStage] = useState<CreateProductStage>("idle");
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [drafts, setDrafts] = useState<ProductDraft[]>(() => [
    createEmptyDraft("draft-1", categories[0]?.id ?? ""),
  ]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySortOrder, setNewCategorySortOrder] = useState("0");
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const lower = query.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(lower) ||
        (product.description ?? "").toLowerCase().includes(lower),
    );
  }, [products, query]);

  const categoryNames = useMemo(
    () => new Map(categoryOptions.map((category) => [category.id, category.name])),
    [categoryOptions],
  );

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;

    return () => {
      for (const url of previewUrls.values()) {
        URL.revokeObjectURL(url);
      }
      previewUrls.clear();
    };
  }, []);

  const nextDraftId = () => `draft-${draftSequenceRef.current++}`;

  const resetDrafts = () => {
    for (const url of previewUrlsRef.current.values()) {
      URL.revokeObjectURL(url);
    }
    previewUrlsRef.current.clear();
    setDrafts([createEmptyDraft(nextDraftId(), categoryOptions[0]?.id ?? "")]);
  };

  const updateDraft = <K extends keyof ProductDraft>(
    draftId: string,
    field: K,
    value: ProductDraft[K],
  ) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) => (draft.id === draftId ? { ...draft, [field]: value } : draft)),
    );
  };

  const updateDraftImage = (draftId: string, file: File | null) => {
    const existingPreview = previewUrlsRef.current.get(draftId);
    if (existingPreview) {
      URL.revokeObjectURL(existingPreview);
      previewUrlsRef.current.delete(draftId);
    }

    const nextPreview =
      file && file.size > 0 && file.type.startsWith("image/") ? URL.createObjectURL(file) : null;

    if (nextPreview) {
      previewUrlsRef.current.set(draftId, nextPreview);
    }

    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === draftId
          ? { ...draft, imageFile: nextPreview ? file : null, imagePreview: nextPreview }
          : draft,
      ),
    );
  };

  const addDraft = () => {
    setDrafts((currentDrafts) => [
      ...currentDrafts,
      createEmptyDraft(nextDraftId(), categoryOptions[0]?.id ?? ""),
    ]);
  };

  const removeDraft = (draftId: string) => {
    const previewUrl = previewUrlsRef.current.get(draftId);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrlsRef.current.delete(draftId);
    }

    setDrafts((currentDrafts) => {
      if (currentDrafts.length === 1) {
        return [createEmptyDraft(nextDraftId(), categoryOptions[0]?.id ?? "")];
      }

      return currentDrafts.filter((draft) => draft.id !== draftId);
    });
  };

  const createCategoryInline = async () => {
    if (!canManage) return;

    setCategoryLoading(true);
    setStatus(null);

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
      setStatus({
        tone: "error",
        text: payload.error?.message ?? "Failed to create category",
      });
      setCategoryLoading(false);
      return;
    }

    const created = payload.data?.category as Category | undefined;
    if (!created) {
      setStatus({
        tone: "error",
        text: "Category created but response was invalid.",
      });
      setCategoryLoading(false);
      return;
    }

    setCategoryOptions((previous) => [...previous, created]);
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.category ? draft : { ...draft, category: created.id },
      ),
    );
    setNewCategoryName("");
    setNewCategorySortOrder("0");
    setStatus({
      tone: "success",
      text: `Category "${created.name}" created.`,
    });
    setCategoryLoading(false);
  };

  const createProductsLabel =
    createProductStage === "creating"
      ? "Creating..."
      : createProductStage === "uploading"
        ? "Uploading..."
        : createProductStage === "refreshing"
          ? "Refreshing..."
          : "Create Products";

  const createProducts = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) return;

    const filledDraftEntries = drafts
      .map((draft, index) => ({ draft, index }))
      .filter(({ draft }) => isDraftFilled(draft));

    if (filledDraftEntries.length === 0) {
      setStatus({
        tone: "error",
        text: "Add at least one product before creating.",
      });
      return;
    }

    const invalidEntries = filledDraftEntries.filter(
      ({ draft }) => getDraftValidationError(draft) !== null,
    );

    if (invalidEntries.length > 0) {
      setStatus({
        tone: "error",
        text: `Complete the required fields for product ${invalidEntries
          .map(({ index }) => index + 1)
          .join(", ")}.`,
      });
      return;
    }

    setCreateProductStage("creating");
    setStatus({
      tone: "info",
      text: `Creating ${filledDraftEntries.length} product${
        filledDraftEntries.length === 1 ? "" : "s"
      }...`,
    });

    const response = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        products: filledDraftEntries.map(({ draft }) => ({
          clientRequestId: draft.id,
          categoryId: draft.category,
          name: draft.name.trim(),
          description: draft.description.trim(),
          imageUrl: "",
          basePrice: Number(draft.price),
          stockQuantity: Number(draft.stock),
          isAvailable: true,
          isFeatured: false,
          isPublished: true,
        })),
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setStatus({
        tone: "error",
        text: payload.error?.message ?? "Failed to create products",
      });
      setCreateProductStage("idle");
      return;
    }

    const createdProducts = (payload.data?.products ?? []) as CreatedProductResult[];
    const productIdsByDraftId = new Map(
      createdProducts
        .filter(
          (entry): entry is CreatedProductResult & { clientRequestId: string; product: Product } =>
            typeof entry.clientRequestId === "string" && entry.product !== null,
        )
        .map((entry) => [entry.clientRequestId, entry.product.id]),
    );

    const draftsWithImages = filledDraftEntries.filter(({ draft }) => draft.imageFile !== null);
    const failedUploads: string[] = [];

    if (draftsWithImages.length > 0) {
      setCreateProductStage("uploading");
      setStatus({
        tone: "info",
        text: `Uploading ${draftsWithImages.length} image${
          draftsWithImages.length === 1 ? "" : "s"
        }...`,
      });

      await Promise.all(
        draftsWithImages.map(async ({ draft, index }) => {
          const productId = productIdsByDraftId.get(draft.id);
          if (!productId || !draft.imageFile) {
            failedUploads.push(`Product ${index + 1}`);
            return;
          }

          const uploadFormData = new FormData();
          uploadFormData.set("file", draft.imageFile);

          const uploadResponse = await fetch(`/api/admin/products/${productId}/image`, {
            method: "POST",
            body: uploadFormData,
          });

          if (uploadResponse.ok) {
            return;
          }

          const uploadPayload = await uploadResponse.json().catch(() => null);
          failedUploads.push(uploadPayload?.error?.message ?? `Product ${index + 1}`);
        }),
      );
    }

    resetDrafts();
    setCreateProductStage("refreshing");
    router.refresh();
    setCreateProductStage("idle");

    if (failedUploads.length > 0) {
      setStatus({
        tone: "error",
        text: `Created ${filledDraftEntries.length} product${
          filledDraftEntries.length === 1 ? "" : "s"
        }, but ${failedUploads.length} image upload${
          failedUploads.length === 1 ? "" : "s"
        } failed.`,
      });
      return;
    }

    setStatus({
      tone: "success",
      text: `Created ${filledDraftEntries.length} product${
        filledDraftEntries.length === 1 ? "" : "s"
      }.`,
    });
  };

  const deleteProduct = async (product: Product) => {
    if (!canManage) return;

    const confirmed = window.confirm(
      `Delete "${product.name}"? If it has existing orders, it will be unpublished instead so order history stays intact.`,
    );
    if (!confirmed) return;

    setDeletingProductId(product.id);
    setStatus(null);

    const response = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
    const payload = await response.json();

    if (!response.ok) {
      setStatus({
        tone: "error",
        text: payload.error?.message ?? "Failed to delete product",
      });
      setDeletingProductId(null);
      return;
    }

    router.refresh();
    setStatus({
      tone: "success",
      text:
        payload.data?.message ??
        (payload.data?.archived
          ? "Product had order history and was unpublished instead of deleted."
          : "Product deleted."),
    });
    setDeletingProductId(null);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={createProducts} className="space-y-4 rounded-xl border border-slate-200 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-900">Batch product entry</p>
          <p className="text-sm text-slate-500">
            Add one or more products, attach images, then create everything in one submission.
          </p>
        </div>

        {drafts.map((draft, index) => (
          <div key={draft.id} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Product {index + 1}</p>
                <p className="text-xs text-slate-500">Each block creates one product record.</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Category
                </span>
                <select
                  className="h-10 w-full rounded-[12px] border border-kira-border bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kira-red/30"
                  value={draft.category}
                  onChange={(event) => updateDraft(draft.id, "category", event.target.value)}
                  disabled={!canManage || categoryOptions.length === 0}
                >
                  {categoryOptions.length === 0 ? (
                    <option value="">Create a category first</option>
                  ) : (
                    <>
                      <option value="">Select a category</option>
                      {categoryOptions.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Product name
                </span>
                <Input
                  value={draft.name}
                  onChange={(event) => updateDraft(draft.id, "name", event.target.value)}
                  placeholder="Product name"
                  disabled={!canManage}
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Description
                </span>
                <Textarea
                  value={draft.description}
                  onChange={(event) => updateDraft(draft.id, "description", event.target.value)}
                  placeholder="Short product description"
                  className="min-h-24"
                  disabled={!canManage}
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Price
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.price}
                  onChange={(event) => updateDraft(draft.id, "price", event.target.value)}
                  placeholder="Price"
                  disabled={!canManage}
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Stock quantity
                </span>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  value={draft.stock}
                  onChange={(event) => updateDraft(draft.id, "stock", event.target.value)}
                  placeholder="Stock quantity"
                  disabled={!canManage}
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Image upload
                </span>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => updateDraftImage(draft.id, event.target.files?.[0] ?? null)}
                  disabled={!canManage}
                />
              </label>
            </div>

            {draft.imagePreview ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Image preview
                </p>
                <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <img
                    src={draft.imagePreview}
                    alt={draft.name ? `${draft.name} preview` : `Product ${index + 1} preview`}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeDraft(draft.id)}
                disabled={!canManage}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={addDraft} disabled={!canManage}>
            + Add Product
          </Button>
        </div>

        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900">Need a new category?</p>
            <p className="text-sm text-slate-500">
              Create it here, then assign it from any product block.
            </p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto]">
            <Input
              placeholder="New category name"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              disabled={!canManage}
            />
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
              loading={categoryLoading}
              disabled={!canManage || !newCategoryName.trim()}
            >
              Create category
            </Button>
          </div>
        </div>

        <Button
          className="w-full md:w-auto"
          loading={createProductStage !== "idle"}
          disabled={!canManage || createProductStage !== "idle"}
        >
          {createProductsLabel}
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
        {filtered.map((product) => {
          const categoryName = categoryNames.get(product.category_id);
          const hasImage = Boolean(product.image_url);

          return (
            <div key={product.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    {hasImage ? (
                      <img
                        src={product.image_url ?? ""}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-lg font-semibold text-slate-400">
                        {product.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{product.name}</p>
                      {categoryName ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {categoryName}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-500">
                      {product.description ?? "No description"}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>UGX {priceFormatter.format(Number(product.base_price))}</span>
                      <span>Stock {product.stock_quantity}</span>
                      <span>{product.is_available ? "Available" : "Unavailable"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
                  <Link
                    href={`/products/${product.id}`}
                    className="inline-flex h-9 items-center justify-center rounded-[10px] border border-kira-border bg-white px-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100"
                  >
                    Edit product
                  </Link>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteProduct(product)}
                    loading={deletingProductId === product.id}
                    disabled={!canManage}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {status ? <p className={getStatusClassName(status.tone)}>{status.text}</p> : null}
    </div>
  );
}
