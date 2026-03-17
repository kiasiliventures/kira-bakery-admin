"use client";

import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CakeAdminData, CakeOption, CakePriceDto, CakeTierOption } from "@/lib/types/cakes";

type Props = CakeAdminData & {
  canManage: boolean;
};

type StatusTone = "error" | "info" | "success";

type StatusMessage = {
  tone: StatusTone;
  text: string;
};

type OptionDraft = {
  code: string;
  name: string;
  sortOrder: string;
  isActive: boolean;
  updatedAt: string;
};

type CreateOptionDraft = {
  name: string;
  sortOrder: string;
  isActive: boolean;
};

type PriceDraft = {
  flavourId: string;
  shapeId: string;
  sizeId: string;
  tierOptionId: string;
  toppingId: string;
  weightKg: string;
  priceUgx: string;
  sourceNote: string;
  isActive: boolean;
  updatedAt: string;
};

type CreatePriceDraft = Omit<PriceDraft, "updatedAt">;

type OptionEditorState = {
  endpointBase: string;
  singularLabel: string;
  itemId: string;
  draft: OptionDraft;
};

type PriceEditorState = {
  priceId: string;
  draft: PriceDraft;
};

type OptionSectionConfig = {
  singularLabel: string;
  pluralLabel: string;
  description: string;
  items: CakeOption[];
  createDraft: CreateOptionDraft;
  setCreateDraft: Dispatch<SetStateAction<CreateOptionDraft>>;
  isCreating: boolean;
  onCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onEdit: (item: CakeOption) => void;
  canManage: boolean;
};

const priceFormatter = new Intl.NumberFormat("en-UG", {
  maximumFractionDigits: 0,
});

function statusClassName(tone: StatusTone): string {
  if (tone === "error") return "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700";
  if (tone === "success") {
    return "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700";
  }
  return "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600";
}

function normalizeCodeFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\./g, "_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toOptionDraft(option: CakeOption): OptionDraft {
  return {
    code: option.code,
    name: option.name,
    sortOrder: String(option.sortOrder),
    isActive: option.isActive,
    updatedAt: option.updatedAt,
  };
}

function toPriceDraft(price: CakePriceDto): PriceDraft {
  return {
    flavourId: price.flavourId,
    shapeId: price.shapeId,
    sizeId: price.sizeId,
    tierOptionId: price.tierOptionId,
    toppingId: price.toppingId,
    weightKg: String(price.weightKg),
    priceUgx: String(price.priceUgx),
    sourceNote: price.sourceNote ?? "",
    isActive: price.isActive,
    updatedAt: price.updatedAt,
  };
}

function createEmptyOptionDraft(): CreateOptionDraft {
  return {
    name: "",
    sortOrder: "0",
    isActive: true,
  };
}

function createEmptyPriceDraft(data: CakeAdminData): CreatePriceDraft {
  return {
    flavourId: data.flavours[0]?.id ?? "",
    shapeId: data.shapes[0]?.id ?? "",
    sizeId: data.sizes[0]?.id ?? "",
    tierOptionId: data.tierOptions[0]?.id ?? "",
    toppingId: data.toppings[0]?.id ?? "",
    weightKg: "",
    priceUgx: "",
    sourceNote: "",
    isActive: true,
  };
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="space-y-2 text-sm font-medium text-slate-700">{children}</label>;
}

function FieldCaption({ children }: { children: ReactNode }) {
  return <span className="block text-sm font-medium text-slate-700">{children}</span>;
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function ReferenceChip({
  label,
  secondary,
  muted = false,
}: {
  label: string;
  secondary?: string;
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
        muted ? "bg-slate-200 text-slate-500" : "bg-slate-100 text-slate-700"
      }`}
    >
      {label}
      {secondary ? <span className="text-[11px] uppercase tracking-[0.12em]">{secondary}</span> : null}
    </span>
  );
}

function ActiveField({
  checked,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex h-11 items-center justify-between rounded-[12px] border border-kira-border bg-white px-3">
      <span className="text-sm text-slate-700">Active</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

function OptionSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<CakeOption | CakeTierOption>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <FieldLabel>
      <FieldCaption>{label}</FieldCaption>
      <Select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {"tierCount" in option ? `${option.name} (${option.tierCount})` : option.name}
          </option>
        ))}
      </Select>
    </FieldLabel>
  );
}

function OptionCreateCard({
  singularLabel,
  createDraft,
  setCreateDraft,
  isCreating,
  onCreate,
  canManage,
}: {
  singularLabel: string;
  createDraft: CreateOptionDraft;
  setCreateDraft: Dispatch<SetStateAction<CreateOptionDraft>>;
  isCreating: boolean;
  onCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  canManage: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add {singularLabel}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onCreate} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
          <FieldLabel>
            <FieldCaption>Name</FieldCaption>
            <Input
              value={createDraft.name}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, name: event.target.value }))
              }
              disabled={!canManage}
            />
          </FieldLabel>

          <FieldLabel>
            <FieldCaption>Sort Order</FieldCaption>
            <Input
              type="number"
              min={0}
              step={1}
              value={createDraft.sortOrder}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, sortOrder: event.target.value }))
              }
              disabled={!canManage}
            />
          </FieldLabel>

          <FieldLabel>
            <FieldCaption>Visibility</FieldCaption>
            <ActiveField
              checked={createDraft.isActive}
              onCheckedChange={(checked) =>
                setCreateDraft((current) => ({ ...current, isActive: checked }))
              }
              disabled={!canManage}
            />
          </FieldLabel>

          <div className="flex items-end">
            <Button type="submit" loading={isCreating} disabled={!canManage} className="w-full md:w-auto">
              Add {singularLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function OptionTableCard({
  pluralLabel,
  description,
  items,
  onEdit,
}: {
  pluralLabel: string;
  description: string;
  items: CakeOption[];
  onEdit: (item: CakeOption) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{pluralLabel}</CardTitle>
        <p className="text-sm text-slate-500">{description}</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-32">Active</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-slate-500">
                  No {pluralLabel.toLowerCase()} yet.
                </TableCell>
              </TableRow>
            ) : null}

            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium text-slate-900">{item.name}</div>
                  <div className="text-xs text-slate-500">Sort Order {item.sortOrder}</div>
                </TableCell>
                <TableCell>
                  <ActiveBadge isActive={item.isActive} />
                </TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="outline" size="sm" onClick={() => onEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function OptionSection({
  singularLabel,
  pluralLabel,
  description,
  items,
  createDraft,
  setCreateDraft,
  isCreating,
  onCreate,
  onEdit,
  canManage,
}: OptionSectionConfig) {
  return (
    <div className="space-y-4">
      <OptionCreateCard
        singularLabel={singularLabel}
        createDraft={createDraft}
        setCreateDraft={setCreateDraft}
        isCreating={isCreating}
        onCreate={onCreate}
        canManage={canManage}
      />
      <OptionTableCard
        pluralLabel={pluralLabel}
        description={description}
        items={items}
        onEdit={onEdit}
      />
    </div>
  );
}

function OptionEditDialog({
  state,
  saving,
  canManage,
  onClose,
  onDraftChange,
  onSave,
}: {
  state: OptionEditorState | null;
  saving: boolean;
  canManage: boolean;
  onClose: () => void;
  onDraftChange: (field: keyof OptionDraft, value: string | boolean) => void;
  onSave: () => Promise<void>;
}) {
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="relative">
        {state ? (
          <>
            <DialogHeader className="pr-10">
              <DialogTitle>Edit {state.singularLabel}</DialogTitle>
              <DialogDescription>
                Update the display name, sort order, and availability for this {state.singularLabel.toLowerCase()}.
              </DialogDescription>
            </DialogHeader>

            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mt-4 space-y-4">
              <FieldLabel>
                <FieldCaption>Name</FieldCaption>
                <Input
                  value={state.draft.name}
                  onChange={(event) => onDraftChange("name", event.target.value)}
                  disabled={!canManage}
                />
              </FieldLabel>

              <FieldLabel>
                <FieldCaption>Sort Order</FieldCaption>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={state.draft.sortOrder}
                  onChange={(event) => onDraftChange("sortOrder", event.target.value)}
                  disabled={!canManage}
                />
              </FieldLabel>

              <FieldLabel>
                <FieldCaption>Visibility</FieldCaption>
                <ActiveField
                  checked={state.draft.isActive}
                  onCheckedChange={(checked) => onDraftChange("isActive", checked)}
                  disabled={!canManage}
                />
              </FieldLabel>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void onSave()} loading={saving} disabled={!canManage}>
                Save Changes
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PriceCreateCard({
  draft,
  setDraft,
  flavours,
  shapes,
  sizes,
  toppings,
  tierOptions,
  canManage,
  creating,
  onCreate,
}: {
  draft: CreatePriceDraft;
  setDraft: Dispatch<SetStateAction<CreatePriceDraft>>;
  flavours: CakeOption[];
  shapes: CakeOption[];
  sizes: CakeOption[];
  toppings: CakeOption[];
  tierOptions: CakeTierOption[];
  canManage: boolean;
  creating: boolean;
  onCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Price</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onCreate} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <OptionSelect
              label="Flavour"
              value={draft.flavourId}
              options={flavours}
              disabled={!canManage || flavours.length === 0}
              onChange={(value) => setDraft((current) => ({ ...current, flavourId: value }))}
            />
            <OptionSelect
              label="Shape"
              value={draft.shapeId}
              options={shapes}
              disabled={!canManage || shapes.length === 0}
              onChange={(value) => setDraft((current) => ({ ...current, shapeId: value }))}
            />
            <OptionSelect
              label="Size"
              value={draft.sizeId}
              options={sizes}
              disabled={!canManage || sizes.length === 0}
              onChange={(value) => setDraft((current) => ({ ...current, sizeId: value }))}
            />
            <OptionSelect
              label="Tier"
              value={draft.tierOptionId}
              options={tierOptions}
              disabled={!canManage || tierOptions.length === 0}
              onChange={(value) => setDraft((current) => ({ ...current, tierOptionId: value }))}
            />
            <OptionSelect
              label="Topping"
              value={draft.toppingId}
              options={toppings}
              disabled={!canManage || toppings.length === 0}
              onChange={(value) => setDraft((current) => ({ ...current, toppingId: value }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-[180px_220px_minmax(0,1fr)_180px_auto]">
            <FieldLabel>
              <FieldCaption>Weight (kg)</FieldCaption>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={draft.weightKg}
                onChange={(event) => setDraft((current) => ({ ...current, weightKg: event.target.value }))}
                disabled={!canManage}
              />
            </FieldLabel>

            <FieldLabel>
              <FieldCaption>Price (UGX)</FieldCaption>
              <Input
                type="number"
                min={0}
                step={1}
                value={draft.priceUgx}
                onChange={(event) => setDraft((current) => ({ ...current, priceUgx: event.target.value }))}
                disabled={!canManage}
              />
            </FieldLabel>

            <FieldLabel>
              <FieldCaption>Source Note</FieldCaption>
              <Input
                value={draft.sourceNote}
                onChange={(event) => setDraft((current) => ({ ...current, sourceNote: event.target.value }))}
                disabled={!canManage}
              />
            </FieldLabel>

            <FieldLabel>
              <FieldCaption>Visibility</FieldCaption>
              <ActiveField
                checked={draft.isActive}
                onCheckedChange={(checked) => setDraft((current) => ({ ...current, isActive: checked }))}
                disabled={!canManage}
              />
            </FieldLabel>

            <div className="flex items-end">
              <Button type="submit" loading={creating} disabled={!canManage} className="w-full md:w-auto">
                Add Price
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PriceTableCard({
  prices,
  priceQuery,
  setPriceQuery,
  onEdit,
}: {
  prices: CakePriceDto[];
  priceQuery: string;
  setPriceQuery: Dispatch<SetStateAction<string>>;
  onEdit: (price: CakePriceDto) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <CardTitle>Prices</CardTitle>
          <p className="text-sm text-slate-500">
            Keep one row per valid flavour, shape, size, tier count, and topping combination.
          </p>
        </div>

        <div className="w-full max-w-md space-y-2">
          <FieldCaption>Filter Prices</FieldCaption>
          <Input
            value={priceQuery}
            onChange={(event) => setPriceQuery(event.target.value)}
            placeholder="Search flavour, size, topping, note..."
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-500">{prices.length} matching rows</p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Flavour</TableHead>
              <TableHead>Configuration</TableHead>
              <TableHead className="w-28">Weight</TableHead>
              <TableHead className="w-36">Price</TableHead>
              <TableHead className="w-32">Active</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                  No price rows match the current filter.
                </TableCell>
              </TableRow>
            ) : null}

            {prices.map((price) => (
              <TableRow key={price.id}>
                <TableCell>
                  <div className="font-medium text-slate-900">{price.flavourName}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-slate-900">
                    {price.shapeName}, {price.sizeName}, {price.tierOptionName}, {price.toppingName}
                  </div>
                  {price.sourceNote ? <div className="text-xs text-slate-500">{price.sourceNote}</div> : null}
                </TableCell>
                <TableCell>{price.weightKg} kg</TableCell>
                <TableCell>UGX {priceFormatter.format(price.priceUgx)}</TableCell>
                <TableCell>
                  <ActiveBadge isActive={price.isActive} />
                </TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="outline" size="sm" onClick={() => onEdit(price)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PriceEditDialog({
  state,
  saving,
  canManage,
  flavours,
  shapes,
  sizes,
  toppings,
  tierOptions,
  onClose,
  onDraftChange,
  onSave,
}: {
  state: PriceEditorState | null;
  saving: boolean;
  canManage: boolean;
  flavours: CakeOption[];
  shapes: CakeOption[];
  sizes: CakeOption[];
  toppings: CakeOption[];
  tierOptions: CakeTierOption[];
  onClose: () => void;
  onDraftChange: (field: keyof PriceDraft, value: string | boolean) => void;
  onSave: () => Promise<void>;
}) {
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="relative max-w-3xl">
        {state ? (
          <>
            <DialogHeader className="pr-10">
              <DialogTitle>Edit Price</DialogTitle>
              <DialogDescription>
                Adjust the combination, amount, and availability for this price row.
              </DialogDescription>
            </DialogHeader>

            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <OptionSelect
                  label="Flavour"
                  value={state.draft.flavourId}
                  options={flavours}
                  disabled={!canManage}
                  onChange={(value) => onDraftChange("flavourId", value)}
                />
                <OptionSelect
                  label="Shape"
                  value={state.draft.shapeId}
                  options={shapes}
                  disabled={!canManage}
                  onChange={(value) => onDraftChange("shapeId", value)}
                />
                <OptionSelect
                  label="Size"
                  value={state.draft.sizeId}
                  options={sizes}
                  disabled={!canManage}
                  onChange={(value) => onDraftChange("sizeId", value)}
                />
                <OptionSelect
                  label="Tier"
                  value={state.draft.tierOptionId}
                  options={tierOptions}
                  disabled={!canManage}
                  onChange={(value) => onDraftChange("tierOptionId", value)}
                />
                <OptionSelect
                  label="Topping"
                  value={state.draft.toppingId}
                  options={toppings}
                  disabled={!canManage}
                  onChange={(value) => onDraftChange("toppingId", value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-[180px_220px_minmax(0,1fr)_180px]">
                <FieldLabel>
                  <FieldCaption>Weight (kg)</FieldCaption>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={state.draft.weightKg}
                    onChange={(event) => onDraftChange("weightKg", event.target.value)}
                    disabled={!canManage}
                  />
                </FieldLabel>

                <FieldLabel>
                  <FieldCaption>Price (UGX)</FieldCaption>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={state.draft.priceUgx}
                    onChange={(event) => onDraftChange("priceUgx", event.target.value)}
                    disabled={!canManage}
                  />
                </FieldLabel>

                <FieldLabel>
                  <FieldCaption>Source Note</FieldCaption>
                  <Input
                    value={state.draft.sourceNote}
                    onChange={(event) => onDraftChange("sourceNote", event.target.value)}
                    disabled={!canManage}
                  />
                </FieldLabel>

                <FieldLabel>
                  <FieldCaption>Visibility</FieldCaption>
                  <ActiveField
                    checked={state.draft.isActive}
                    onCheckedChange={(checked) => onDraftChange("isActive", checked)}
                    disabled={!canManage}
                  />
                </FieldLabel>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void onSave()} loading={saving} disabled={!canManage}>
                Save Changes
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function CakePricingManager({
  flavours,
  shapes,
  sizes,
  toppings,
  tierOptions,
  prices,
  canManage,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [creatingSection, setCreatingSection] = useState<string | null>(null);
  const [savingOptionId, setSavingOptionId] = useState<string | null>(null);
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);
  const [priceQuery, setPriceQuery] = useState("");
  const [newFlavour, setNewFlavour] = useState<CreateOptionDraft>(() => createEmptyOptionDraft());
  const [newSize, setNewSize] = useState<CreateOptionDraft>(() => createEmptyOptionDraft());
  const [newTopping, setNewTopping] = useState<CreateOptionDraft>(() => createEmptyOptionDraft());
  const [newPrice, setNewPrice] = useState<CreatePriceDraft>(() =>
    createEmptyPriceDraft({ flavours, shapes, sizes, toppings, tierOptions, prices }),
  );
  const [editingOption, setEditingOption] = useState<OptionEditorState | null>(null);
  const [editingPrice, setEditingPrice] = useState<PriceEditorState | null>(null);

  useEffect(() => {
    setNewPrice(createEmptyPriceDraft({ flavours, shapes, sizes, toppings, tierOptions, prices }));
  }, [flavours, shapes, sizes, toppings, tierOptions, prices]);

  const filteredPrices = useMemo(() => {
    const query = priceQuery.trim().toLowerCase();
    if (!query) return prices;

    return prices.filter((price) =>
      [
        price.flavourName,
        price.shapeName,
        price.sizeName,
        price.tierOptionName,
        price.toppingName,
        price.sourceNote ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [priceQuery, prices]);

  async function handleResponse(response: Response, fallbackMessage: string) {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? fallbackMessage);
    }
    return payload;
  }

  async function refreshWithStatus(message: string) {
    router.refresh();
    setStatus({ tone: "success", text: message });
  }

  async function createOption(
    endpoint: string,
    payload: CreateOptionDraft,
    successLabel: string,
    onReset: () => void,
  ) {
    if (!canManage) return;

    const name = payload.name.trim();
    const code = normalizeCodeFromName(name);
    if (!name || !code) {
      setStatus({ tone: "error", text: `${successLabel} name is required.` });
      return;
    }

    setCreatingSection(endpoint);
    setStatus({ tone: "info", text: `Creating ${successLabel.toLowerCase()}...` });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          sortOrder: Number(payload.sortOrder || 0),
          isActive: payload.isActive,
        }),
      });

      await handleResponse(response, `Failed to create ${successLabel.toLowerCase()}`);
      onReset();
      await refreshWithStatus(`${successLabel} created.`);
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : `Failed to create ${successLabel.toLowerCase()}`,
      });
    } finally {
      setCreatingSection(null);
    }
  }

  async function saveOption() {
    if (!canManage || !editingOption) return;

    const { endpointBase, itemId, singularLabel, draft } = editingOption;

    setSavingOptionId(itemId);
    setStatus({ tone: "info", text: `Saving ${singularLabel.toLowerCase()}...` });

    try {
      const response = await fetch(`${endpointBase}/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: draft.code,
          name: draft.name.trim(),
          sortOrder: Number(draft.sortOrder || 0),
          isActive: draft.isActive,
          updatedAt: draft.updatedAt,
        }),
      });

      await handleResponse(response, `Failed to save ${singularLabel.toLowerCase()}`);
      setEditingOption(null);
      await refreshWithStatus(`${singularLabel} updated.`);
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : `Failed to save ${singularLabel.toLowerCase()}`,
      });
    } finally {
      setSavingOptionId(null);
    }
  }

  async function createPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    setCreatingSection("price");
    setStatus({ tone: "info", text: "Creating cake price row..." });

    try {
      const response = await fetch("/api/admin/cakes/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flavourId: newPrice.flavourId,
          shapeId: newPrice.shapeId,
          sizeId: newPrice.sizeId,
          tierOptionId: newPrice.tierOptionId,
          toppingId: newPrice.toppingId,
          weightKg: Number(newPrice.weightKg),
          priceUgx: Number(newPrice.priceUgx),
          sourceNote: newPrice.sourceNote.trim(),
          isActive: newPrice.isActive,
        }),
      });

      await handleResponse(response, "Failed to create cake price row");
      setNewPrice(createEmptyPriceDraft({ flavours, shapes, sizes, toppings, tierOptions, prices }));
      await refreshWithStatus("Cake price row created.");
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to create cake price row",
      });
    } finally {
      setCreatingSection(null);
    }
  }

  async function savePrice() {
    if (!canManage || !editingPrice) return;

    const { priceId, draft } = editingPrice;

    setSavingPriceId(priceId);
    setStatus({ tone: "info", text: "Saving cake price row..." });

    try {
      const response = await fetch(`/api/admin/cakes/prices/${priceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flavourId: draft.flavourId,
          shapeId: draft.shapeId,
          sizeId: draft.sizeId,
          tierOptionId: draft.tierOptionId,
          toppingId: draft.toppingId,
          weightKg: Number(draft.weightKg),
          priceUgx: Number(draft.priceUgx),
          sourceNote: draft.sourceNote.trim(),
          isActive: draft.isActive,
          updatedAt: draft.updatedAt,
        }),
      });

      await handleResponse(response, "Failed to save cake price row");
      setEditingPrice(null);
      await refreshWithStatus("Cake price row updated.");
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to save cake price row",
      });
    } finally {
      setSavingPriceId(null);
    }
  }

  function openOptionEditor(endpointBase: string, singularLabel: string, item: CakeOption) {
    setEditingOption({
      endpointBase,
      singularLabel,
      itemId: item.id,
      draft: toOptionDraft(item),
    });
  }

  return (
    <div className="space-y-6">
      {status ? <p className={statusClassName(status.tone)}>{status.text}</p> : null}

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Cake Pricing Admin</CardTitle>
          <p className="text-sm text-slate-500">
            Manage builder options and the cake price matrix from one place. Shapes and tier options
            remain seeded reference data.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Shapes</p>
            <div className="flex flex-wrap gap-2">
              {shapes.map((shape) => (
                <ReferenceChip
                  key={shape.id}
                  label={shape.name}
                  secondary={shape.code}
                  muted={!shape.isActive}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              Tier Options
            </p>
            <div className="flex flex-wrap gap-2">
              {tierOptions.map((tierOption) => (
                <ReferenceChip
                  key={tierOption.id}
                  label={tierOption.name}
                  secondary={String(tierOption.tierCount)}
                  muted={!tierOption.isActive}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="flavours" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Pricing Workspace</h2>
            <p className="text-sm text-slate-500">Switch between option lists and the full price matrix.</p>
          </div>

          <TabsList>
            <TabsTrigger value="flavours">Flavours</TabsTrigger>
            <TabsTrigger value="sizes">Sizes</TabsTrigger>
            <TabsTrigger value="toppings">Toppings</TabsTrigger>
            <TabsTrigger value="prices">Prices</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="flavours">
          <OptionSection
            singularLabel="Flavour"
            pluralLabel="Flavours"
            description="Manage flavour choices used in the cake builder and price matrix."
            items={flavours}
            createDraft={newFlavour}
            setCreateDraft={setNewFlavour}
            isCreating={creatingSection === "/api/admin/cakes/flavours"}
            onCreate={(event) => {
              event.preventDefault();
              return createOption("/api/admin/cakes/flavours", newFlavour, "Flavour", () =>
                setNewFlavour(createEmptyOptionDraft()),
              );
            }}
            onEdit={(item) => openOptionEditor("/api/admin/cakes/flavours", "Flavour", item)}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="sizes">
          <OptionSection
            singularLabel="Size"
            pluralLabel="Sizes"
            description="Manage the size records used to define valid cake combinations."
            items={sizes}
            createDraft={newSize}
            setCreateDraft={setNewSize}
            isCreating={creatingSection === "/api/admin/cakes/sizes"}
            onCreate={(event) => {
              event.preventDefault();
              return createOption("/api/admin/cakes/sizes", newSize, "Size", () =>
                setNewSize(createEmptyOptionDraft()),
              );
            }}
            onEdit={(item) => openOptionEditor("/api/admin/cakes/sizes", "Size", item)}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="toppings">
          <OptionSection
            singularLabel="Topping"
            pluralLabel="Toppings"
            description="Manage icing and finish styles available for price combinations."
            items={toppings}
            createDraft={newTopping}
            setCreateDraft={setNewTopping}
            isCreating={creatingSection === "/api/admin/cakes/toppings"}
            onCreate={(event) => {
              event.preventDefault();
              return createOption("/api/admin/cakes/toppings", newTopping, "Topping", () =>
                setNewTopping(createEmptyOptionDraft()),
              );
            }}
            onEdit={(item) => openOptionEditor("/api/admin/cakes/toppings", "Topping", item)}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="prices">
          <div className="space-y-4">
            <PriceCreateCard
              draft={newPrice}
              setDraft={setNewPrice}
              flavours={flavours}
              shapes={shapes}
              sizes={sizes}
              toppings={toppings}
              tierOptions={tierOptions}
              canManage={canManage}
              creating={creatingSection === "price"}
              onCreate={createPrice}
            />

            <PriceTableCard
              prices={filteredPrices}
              priceQuery={priceQuery}
              setPriceQuery={setPriceQuery}
              onEdit={(price) => setEditingPrice({ priceId: price.id, draft: toPriceDraft(price) })}
            />
          </div>
        </TabsContent>
      </Tabs>

      <OptionEditDialog
        state={editingOption}
        saving={savingOptionId === editingOption?.itemId}
        canManage={canManage}
        onClose={() => setEditingOption(null)}
        onDraftChange={(field, value) =>
          setEditingOption((current) =>
            current
              ? {
                  ...current,
                  draft: {
                    ...current.draft,
                    [field]: value,
                  },
                }
              : null,
          )
        }
        onSave={saveOption}
      />

      <PriceEditDialog
        state={editingPrice}
        saving={savingPriceId === editingPrice?.priceId}
        canManage={canManage}
        flavours={flavours}
        shapes={shapes}
        sizes={sizes}
        toppings={toppings}
        tierOptions={tierOptions}
        onClose={() => setEditingPrice(null)}
        onDraftChange={(field, value) =>
          setEditingPrice((current) =>
            current
              ? {
                  ...current,
                  draft: {
                    ...current.draft,
                    [field]: value,
                  },
                }
              : null,
          )
        }
        onSave={savePrice}
      />
    </div>
  );
}
