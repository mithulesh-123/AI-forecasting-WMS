import { z } from "zod";
import { DISPATCH_STATUSES } from "@/lib/constants";

export const dispatchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["", ...DISPATCH_STATUSES] as const).default(""),
  warehouseId: z.string().trim().optional().or(z.literal("")),
  from: z.string().trim().optional().or(z.literal("")),
  to: z.string().trim().optional().or(z.literal("")),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(10),
});

export const createDispatchSchema = z
  .object({
    customerName: z.string().trim().min(2, "Customer name is required").max(120),
    customerRef: z.string().trim().max(120).optional().or(z.literal("")),
    warehouseId: z.string().trim().min(1, "Select the origin warehouse"),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    items: z
      .array(
        z.object({
          productId: z.string().trim().min(1, "Select a product"),
          quantity: z.coerce
            .number()
            .int("Quantity must be a whole number")
            .min(1, "Quantity must be at least 1")
            .max(1_000_000),
        }),
      )
      .min(1, "Add at least one product line"),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const [index, item] of value.items.entries()) {
      if (seen.has(item.productId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "productId"],
          message: "Duplicate product lines are not allowed",
        });
      }
      seen.add(item.productId);
    }
  });

export const dispatchStatusUpdateSchema = z.object({
  status: z.enum(DISPATCH_STATUSES),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type DispatchQuery = z.infer<typeof dispatchQuerySchema>;
export type CreateDispatchInput = z.infer<typeof createDispatchSchema>;
