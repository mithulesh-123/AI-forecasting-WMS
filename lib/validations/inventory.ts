import { z } from "zod";
import { MOVEMENT_TYPES } from "@/lib/constants";

export const inventoryQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  warehouseId: z.string().trim().cuid().optional().or(z.literal("")),
  filter: z.enum(["all", "low", "out"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(15),
});

/** Accepts "", null or undefined - normalizes to "" (JSON clients send null). */
const emptyable = () =>
  z.union([z.string().trim(), z.null()]).optional().transform((v) => v ?? "");

export const stockOperationSchema = z
  .object({
    type: z.enum(MOVEMENT_TYPES),
    productId: z.string().trim().min(1, "Select a product"),
    warehouseId: z.string().trim().min(1, "Select a warehouse"),
    destinationWarehouseId: emptyable(),
    quantity: z.coerce.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1").max(1_000_000),
    reason: emptyable(),
    reference: emptyable(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "TRANSFER" && !value.destinationWarehouseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationWarehouseId"],
        message: "Destination warehouse is required for transfers",
      });
      return;
    }
    if (value.type === "TRANSFER" && value.destinationWarehouseId === value.warehouseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationWarehouseId"],
        message: "Destination must differ from source warehouse",
      });
    }
    if (value.type !== "TRANSFER" && value.type !== "ADJUSTMENT") return;
  });

export type StockOperationInput = {
  type: (typeof MOVEMENT_TYPES)[number];
  productId: string;
  warehouseId: string;
  destinationWarehouseId?: string;
  quantity: number;
  reason?: string;
  reference?: string;
};
export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;

export const movementQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(["", ...MOVEMENT_TYPES] as const).default(""),
  warehouseId: z.string().trim().optional().or(z.literal("")),
  productId: z.string().trim().optional().or(z.literal("")),
  from: z.string().trim().optional().or(z.literal("")),
  to: z.string().trim().optional().or(z.literal("")),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(15),
});

export type MovementQuery = z.infer<typeof movementQuerySchema>;
