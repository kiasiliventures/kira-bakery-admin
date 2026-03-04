import { z } from "zod";

const uuidSchema = z.uuid("Invalid UUID");
const isoTimestampSchema = z.string().datetime("Invalid timestamp");

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
  categoryId: uuidSchema,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  imageUrl: z.string().url().optional().or(z.literal("")),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(false),
});

export const productPatchSchema = z.object({
  categoryId: uuidSchema.optional(),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  imageUrl: z.string().url().optional().or(z.literal("")),
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
    "pending",
    "confirmed",
    "preparing",
    "ready_for_pickup",
    "out_for_delivery",
    "completed",
    "cancelled",
  ]),
  updatedAt: isoTimestampSchema,
});

export const productImageUploadSchema = z.object({
  fileName: z.string().trim().min(3).max(180),
  contentType: z.string().trim().min(3).max(100),
  base64File: z.string().trim().min(20),
});

export const userRolePatchSchema = z.object({
  role: z.enum(["admin", "manager", "staff"]),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryPatchInput = z.infer<typeof categoryPatchSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductPatchInput = z.infer<typeof productPatchSchema>;
export type VariantCreateInput = z.infer<typeof variantCreateSchema>;
export type VariantPatchInput = z.infer<typeof variantPatchSchema>;
export type OrderStatusPatchInput = z.infer<typeof orderStatusPatchSchema>;
export type ProductImageUploadInput = z.infer<typeof productImageUploadSchema>;
export type UserRolePatchInput = z.infer<typeof userRolePatchSchema>;

