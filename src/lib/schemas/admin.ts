import { z } from "zod";

const uuidSchema = z.uuid("Invalid UUID");
const isoTimestampSchema = z.string().datetime({ offset: true, message: "Invalid timestamp" });

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export const categoryPatchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  updatedAt: isoTimestampSchema,
});

export const productCreateSchema = z.object({
  clientRequestId: z.string().trim().min(1).max(120).optional(),
  categoryId: uuidSchema,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  imageUrl: z.string().url().optional().or(z.literal("")),
  basePrice: z.coerce.number().min(0).max(9999999).default(0),
  stockQuantity: z.coerce.number().int().min(0).max(999999).default(0),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(true),
});

export const productBatchCreateSchema = z.object({
  products: z.array(productCreateSchema).min(1).max(25),
});

export const productPatchSchema = z.object({
  categoryId: uuidSchema.optional(),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  imageUrl: z.string().url().optional().or(z.literal("")),
  basePrice: z.coerce.number().min(0).max(9999999).optional(),
  stockQuantity: z.coerce.number().int().min(0).max(999999).optional(),
  isAvailable: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  updatedAt: isoTimestampSchema,
});

export const variantCreateSchema = z.object({
  productId: uuidSchema,
  name: z.string().trim().min(1).max(120),
  price: z.coerce.number().positive().max(9999999),
  isAvailable: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export const variantPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  price: z.coerce.number().positive().max(9999999).optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  updatedAt: isoTimestampSchema,
});

export const orderStatusPatchSchema = z.object({
  orderStatus: z.enum([
    "Pending",
    "Approved",
    "Ready",
    "Cancelled",
  ]),
  updatedAt: isoTimestampSchema,
});

export const userRolePatchSchema = z.object({
  role: z.enum(["admin", "manager", "staff"]),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryPatchInput = z.infer<typeof categoryPatchSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductBatchCreateInput = z.infer<typeof productBatchCreateSchema>;
export type ProductPatchInput = z.infer<typeof productPatchSchema>;
export type VariantCreateInput = z.infer<typeof variantCreateSchema>;
export type VariantPatchInput = z.infer<typeof variantPatchSchema>;
export type OrderStatusPatchInput = z.infer<typeof orderStatusPatchSchema>;
export type UserRolePatchInput = z.infer<typeof userRolePatchSchema>;
