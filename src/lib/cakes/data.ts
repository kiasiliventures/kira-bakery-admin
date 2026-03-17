import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { conflict, notFound } from "@/lib/http/errors";
import type {
  CakeAdminData,
  CakeConfigDto,
  CakeConfigOptionDto,
  CakeOption,
  CakePriceDto,
  CakePriceRow,
  CakeTierOption,
  CakeTierOptionDto,
} from "@/lib/types/cakes";
import type {
  CakeOptionCreateInput,
  CakeOptionPatchInput,
  CakePriceCreateInput,
  CakePricePatchInput,
} from "@/lib/schemas/cakes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CakeOptionTable = "cake_flavours" | "cake_sizes" | "cake_toppings";

type CakeOptionRow = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CakeTierOptionRow = CakeOptionRow & {
  tier_count: number;
};

type CakePriceRowRaw = {
  id: string;
  flavour_id: string;
  shape_id: string;
  size_id: string;
  tier_option_id: string;
  topping_id: string;
  weight_kg: number | string;
  price_ugx: number;
  source_note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const cakeOptionSelection = "id,code,name,sort_order,is_active,created_at,updated_at";
const cakeTierOptionSelection = `${cakeOptionSelection},tier_count`;
const cakePriceSelection =
  "id,flavour_id,shape_id,size_id,tier_option_id,topping_id,weight_kg,price_ugx,source_note,is_active,created_at,updated_at";

function parseNumeric(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function mapCakeOption(row: CakeOptionRow): CakeOption {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCakeTierOption(row: CakeTierOptionRow): CakeTierOption {
  return {
    ...mapCakeOption(row),
    tierCount: row.tier_count,
  };
}

function toConfigOption(option: CakeOption): CakeConfigOptionDto {
  return {
    id: option.id,
    code: option.code,
    name: option.name,
    sortOrder: option.sortOrder,
  };
}

function toConfigTierOption(option: CakeTierOption): CakeTierOptionDto {
  return {
    ...toConfigOption(option),
    tierCount: option.tierCount,
  };
}

function mapCakePriceRow(row: CakePriceRowRaw): CakePriceRow {
  return {
    id: row.id,
    flavourId: row.flavour_id,
    shapeId: row.shape_id,
    sizeId: row.size_id,
    tierOptionId: row.tier_option_id,
    toppingId: row.topping_id,
    weightKg: parseNumeric(row.weight_kg),
    priceUgx: row.price_ugx,
    sourceNote: row.source_note,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createPriceDto(
  price: CakePriceRow,
  lookups: {
    flavours: Map<string, CakeOption>;
    shapes: Map<string, CakeOption>;
    sizes: Map<string, CakeOption>;
    toppings: Map<string, CakeOption>;
    tierOptions: Map<string, CakeTierOption>;
  },
): CakePriceDto | null {
  const flavour = lookups.flavours.get(price.flavourId);
  const shape = lookups.shapes.get(price.shapeId);
  const size = lookups.sizes.get(price.sizeId);
  const topping = lookups.toppings.get(price.toppingId);
  const tierOption = lookups.tierOptions.get(price.tierOptionId);

  if (!flavour || !shape || !size || !topping || !tierOption) {
    return null;
  }

  return {
    ...price,
    flavourCode: flavour.code,
    flavourName: flavour.name,
    shapeCode: shape.code,
    shapeName: shape.name,
    sizeCode: size.code,
    sizeName: size.name,
    toppingCode: topping.code,
    toppingName: topping.name,
    tierOptionCode: tierOption.code,
    tierOptionName: tierOption.name,
    tierCount: tierOption.tierCount,
  };
}

function sortOptions<T extends { sortOrder: number; name: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}

function sortPrices(prices: CakePriceDto[]): CakePriceDto[] {
  return [...prices].sort((left, right) => {
    const leftKey = [
      left.shapeName,
      left.sizeName,
      String(left.tierCount),
      left.toppingName,
      left.flavourName,
    ].join("|");
    const rightKey = [
      right.shapeName,
      right.sizeName,
      String(right.tierCount),
      right.toppingName,
      right.flavourName,
    ].join("|");
    return leftKey.localeCompare(rightKey);
  });
}

async function loadCakeCollections() {
  const supabase = await createSupabaseServerClient();
  const [flavoursResult, shapesResult, sizesResult, toppingsResult, tierOptionsResult, pricesResult] =
    await Promise.all([
      supabase.from("cake_flavours").select(cakeOptionSelection).order("sort_order", { ascending: true }),
      supabase.from("cake_shapes").select(cakeOptionSelection).order("sort_order", { ascending: true }),
      supabase.from("cake_sizes").select(cakeOptionSelection).order("sort_order", { ascending: true }),
      supabase.from("cake_toppings").select(cakeOptionSelection).order("sort_order", { ascending: true }),
      supabase
        .from("cake_tier_options")
        .select(cakeTierOptionSelection)
        .order("sort_order", { ascending: true }),
      supabase.from("cake_prices").select(cakePriceSelection).order("created_at", { ascending: false }),
    ]);

  const errors = [
    flavoursResult.error,
    shapesResult.error,
    sizesResult.error,
    toppingsResult.error,
    tierOptionsResult.error,
    pricesResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(`Failed to load cake data: ${errors[0]?.message ?? "unknown error"}`);
  }

  const flavours = sortOptions((flavoursResult.data ?? []).map((row) => mapCakeOption(row as CakeOptionRow)));
  const shapes = sortOptions((shapesResult.data ?? []).map((row) => mapCakeOption(row as CakeOptionRow)));
  const sizes = sortOptions((sizesResult.data ?? []).map((row) => mapCakeOption(row as CakeOptionRow)));
  const toppings = sortOptions((toppingsResult.data ?? []).map((row) => mapCakeOption(row as CakeOptionRow)));
  const tierOptions = sortOptions(
    (tierOptionsResult.data ?? []).map((row) => mapCakeTierOption(row as CakeTierOptionRow)),
  );
  const prices = (pricesResult.data ?? []).map((row) => mapCakePriceRow(row as CakePriceRowRaw));

  return { flavours, shapes, sizes, toppings, tierOptions, prices };
}

export async function getCakeAdminData(): Promise<CakeAdminData> {
  const { flavours, shapes, sizes, toppings, tierOptions, prices } = await loadCakeCollections();
  const flavourMap = new Map(flavours.map((row) => [row.id, row]));
  const shapeMap = new Map(shapes.map((row) => [row.id, row]));
  const sizeMap = new Map(sizes.map((row) => [row.id, row]));
  const toppingMap = new Map(toppings.map((row) => [row.id, row]));
  const tierOptionMap = new Map(tierOptions.map((row) => [row.id, row]));

  const priceDtos = sortPrices(
    prices
      .map((price) =>
        createPriceDto(price, {
          flavours: flavourMap,
          shapes: shapeMap,
          sizes: sizeMap,
          toppings: toppingMap,
          tierOptions: tierOptionMap,
        }),
      )
      .filter((price): price is CakePriceDto => price !== null),
  );

  return {
    flavours,
    shapes,
    sizes,
    toppings,
    tierOptions,
    prices: priceDtos,
  };
}

export async function getPublicCakeConfig(): Promise<CakeConfigDto> {
  const { flavours, shapes, sizes, toppings, tierOptions } = await loadCakeCollections();

  return {
    flavours: flavours.filter((row) => row.isActive).map(toConfigOption),
    shapes: shapes.filter((row) => row.isActive).map(toConfigOption),
    sizes: sizes.filter((row) => row.isActive).map(toConfigOption),
    toppings: toppings.filter((row) => row.isActive).map(toConfigOption),
    tierOptions: tierOptions.filter((row) => row.isActive).map(toConfigTierOption),
  };
}

export async function getPublicCakePrices(): Promise<CakePriceDto[]> {
  const { flavours, shapes, sizes, toppings, tierOptions, prices } = await loadCakeCollections();

  const activeFlavours = new Map(flavours.filter((row) => row.isActive).map((row) => [row.id, row]));
  const activeShapes = new Map(shapes.filter((row) => row.isActive).map((row) => [row.id, row]));
  const activeSizes = new Map(sizes.filter((row) => row.isActive).map((row) => [row.id, row]));
  const activeToppings = new Map(toppings.filter((row) => row.isActive).map((row) => [row.id, row]));
  const activeTierOptions = new Map(
    tierOptions.filter((row) => row.isActive).map((row) => [row.id, row]),
  );

  return sortPrices(
    prices
      .filter((price) => price.isActive)
      .map((price) =>
        createPriceDto(price, {
          flavours: activeFlavours,
          shapes: activeShapes,
          sizes: activeSizes,
          toppings: activeToppings,
          tierOptions: activeTierOptions,
        }),
      )
      .filter((price): price is CakePriceDto => price !== null),
  );
}

function mapDuplicateError(error: PostgrestError, message: string): never {
  if (error.code === "23505") {
    throw conflict(message);
  }

  throw new Error(error.message);
}

export async function createCakeOption(
  table: CakeOptionTable,
  input: CakeOptionCreateInput,
): Promise<CakeOption> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(table)
    .insert({
      code: input.code,
      name: input.name,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    })
    .select(cakeOptionSelection)
    .single();

  if (error) {
    mapDuplicateError(error, "An option with that code already exists");
  }

  return mapCakeOption(data as CakeOptionRow);
}

export async function updateCakeOption(
  table: CakeOptionTable,
  id: string,
  input: CakeOptionPatchInput,
): Promise<CakeOption> {
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from(table)
    .select("id,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load option: ${existingError.message}`);
  }

  if (!existing) {
    throw notFound("Option not found");
  }

  if (existing.updated_at !== input.updatedAt) {
    throw conflict("Option was modified concurrently");
  }

  const updates: Record<string, unknown> = {};
  if (input.code !== undefined) updates.code = input.code;
  if (input.name !== undefined) updates.name = input.name;
  if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;
  if (input.isActive !== undefined) updates.is_active = input.isActive;

  const { data, error } = await supabase
    .from(table)
    .update(updates)
    .eq("id", id)
    .eq("updated_at", input.updatedAt)
    .select(cakeOptionSelection)
    .single();

  if (error) {
    mapDuplicateError(error, "An option with that code already exists");
  }

  return mapCakeOption(data as CakeOptionRow);
}

export async function createCakePrice(input: CakePriceCreateInput): Promise<CakePriceRow> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cake_prices")
    .insert({
      flavour_id: input.flavourId,
      shape_id: input.shapeId,
      size_id: input.sizeId,
      tier_option_id: input.tierOptionId,
      topping_id: input.toppingId,
      weight_kg: input.weightKg.toFixed(2),
      price_ugx: input.priceUgx,
      source_note: input.sourceNote || null,
      is_active: input.isActive,
    })
    .select(cakePriceSelection)
    .single();

  if (error) {
    mapDuplicateError(error, "That cake price combination already exists");
  }

  return mapCakePriceRow(data as CakePriceRowRaw);
}

export async function updateCakePrice(
  id: string,
  input: CakePricePatchInput,
): Promise<CakePriceRow> {
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("cake_prices")
    .select("id,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load cake price: ${existingError.message}`);
  }

  if (!existing) {
    throw notFound("Cake price row not found");
  }

  if (existing.updated_at !== input.updatedAt) {
    throw conflict("Cake price row was modified concurrently");
  }

  const updates: Record<string, unknown> = {};
  if (input.flavourId !== undefined) updates.flavour_id = input.flavourId;
  if (input.shapeId !== undefined) updates.shape_id = input.shapeId;
  if (input.sizeId !== undefined) updates.size_id = input.sizeId;
  if (input.tierOptionId !== undefined) updates.tier_option_id = input.tierOptionId;
  if (input.toppingId !== undefined) updates.topping_id = input.toppingId;
  if (input.weightKg !== undefined) updates.weight_kg = input.weightKg.toFixed(2);
  if (input.priceUgx !== undefined) updates.price_ugx = input.priceUgx;
  if (input.sourceNote !== undefined) updates.source_note = input.sourceNote || null;
  if (input.isActive !== undefined) updates.is_active = input.isActive;

  const { data, error } = await supabase
    .from("cake_prices")
    .update(updates)
    .eq("id", id)
    .eq("updated_at", input.updatedAt)
    .select(cakePriceSelection)
    .single();

  if (error) {
    mapDuplicateError(error, "That cake price combination already exists");
  }

  return mapCakePriceRow(data as CakePriceRowRaw);
}

export async function createCakeCustomRequest(input: {
  customerName: string;
  phone: string;
  email?: string;
  notes?: string;
  sourceNote?: string;
  requestPayload: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cake_custom_requests")
    .insert({
      customer_name: input.customerName,
      phone: input.phone,
      email: input.email || null,
      notes: input.notes || null,
      source_note: input.sourceNote || null,
      request_payload: input.requestPayload,
      status: "pending",
    })
    .select("id,status,created_at")
    .single();

  if (error) {
    throw new Error(`Failed to create custom cake request: ${error.message}`);
  }

  return data;
}
