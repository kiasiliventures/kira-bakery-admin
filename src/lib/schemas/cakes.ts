import { z } from "zod";

const uuidSchema = z.uuid("Invalid UUID");
const isoTimestampSchema = z.string().datetime({ offset: true, message: "Invalid timestamp" });
const cakeCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, "Use lowercase letters, numbers, dots, hyphens, or underscores");
const cakeNameSchema = z.string().trim().min(2).max(120);
const sortOrderSchema = z.coerce.number().int().min(0).max(999);

export const cakeOptionCreateSchema = z.object({
  code: cakeCodeSchema,
  name: cakeNameSchema,
  sortOrder: sortOrderSchema.default(0),
  isActive: z.boolean().default(true),
});

export const cakeOptionPatchSchema = z.object({
  code: cakeCodeSchema.optional(),
  name: cakeNameSchema.optional(),
  sortOrder: sortOrderSchema.optional(),
  isActive: z.boolean().optional(),
  updatedAt: isoTimestampSchema,
});

export const cakePriceCreateSchema = z.object({
  flavourId: uuidSchema,
  shapeId: uuidSchema,
  sizeId: uuidSchema,
  tierOptionId: uuidSchema,
  toppingId: uuidSchema,
  weightKg: z.coerce.number().positive().max(999),
  priceUgx: z.coerce.number().int().min(0).max(99_999_999),
  sourceNote: z.string().trim().max(500).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export const cakePricePatchSchema = z.object({
  flavourId: uuidSchema.optional(),
  shapeId: uuidSchema.optional(),
  sizeId: uuidSchema.optional(),
  tierOptionId: uuidSchema.optional(),
  toppingId: uuidSchema.optional(),
  weightKg: z.coerce.number().positive().max(999).optional(),
  priceUgx: z.coerce.number().int().min(0).max(99_999_999).optional(),
  sourceNote: z.string().trim().max(500).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
  updatedAt: isoTimestampSchema,
});

export const cakeCustomRequestCreateSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(40),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  sourceNote: z.string().trim().max(500).optional().or(z.literal("")),
  requestPayload: z.record(z.string(), z.unknown()),
});

export type CakeOptionCreateInput = z.infer<typeof cakeOptionCreateSchema>;
export type CakeOptionPatchInput = z.infer<typeof cakeOptionPatchSchema>;
export type CakePriceCreateInput = z.infer<typeof cakePriceCreateSchema>;
export type CakePricePatchInput = z.infer<typeof cakePricePatchSchema>;
export type CakeCustomRequestCreateInput = z.infer<typeof cakeCustomRequestCreateSchema>;
