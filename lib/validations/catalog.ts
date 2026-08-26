import { z } from "zod";

export const productQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  sort: z.enum(["name", "sku", "price", "createdAt", "stock"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(10),
});

export const createProductSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2, "SKU must be at least 2 characters")
    .max(32)
    .regex(/^[A-Za-z0-9-]+$/, "SKU may only contain letters, numbers and dashes")
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.string().trim().min(2).max(60),
  unit: z.string().trim().min(1).max(20).default("pcs"),
  price: z.coerce.number().min(0, "Price cannot be negative").max(9_999_999).multipleOf(0.01),
  reorderLevel: z.coerce.number().int().min(0).max(1_000_000),
  reorderQuantity: z.coerce.number().int().min(1).max(1_000_000),
});

export const updateProductSchema = createProductSchema.partial();

export type ProductQuery = z.infer<typeof productQuerySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const warehouseQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["name", "code", "capacity", "createdAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(10),
});

export const warehouseIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{2,12}$/, "Code may only contain letters, numbers and dashes (2-12 chars)")
  .transform((v) => v.toUpperCase());

export const createWarehouseSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: warehouseIdSchema,
  location: z.string().trim().min(2).max(160),
  capacity: z.coerce.number().int().min(1).max(10_000_000),
  managerName: z.string().trim().max(80).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

export type WarehouseQuery = z.infer<typeof warehouseQuerySchema>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
