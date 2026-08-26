import { z } from "zod";

export const forecastRequestSchema = z.object({
  productId: z.string().trim().min(1),
  horizon: z.union([z.literal(7), z.literal(14), z.literal(30)]),
});

export const userQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(["", "ADMIN", "MANAGER", "WAREHOUSE_STAFF", "VIEWER"]).default(""),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(10),
});

export const auditLogQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  action: z.string().trim().max(60).optional().or(z.literal("")),
  entity: z.string().trim().max(40).optional().or(z.literal("")),
  from: z.string().trim().optional().or(z.literal("")),
  to: z.string().trim().optional().or(z.literal("")),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(15),
});

export const reportTypeSchema = z.enum(["inventory", "stock-movement", "dispatch", "forecast"]);

export const reportQuerySchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  warehouseId: z.string().trim().optional().or(z.literal("")),
  productId: z.string().trim().optional().or(z.literal("")),
  category: z.string().trim().optional().or(z.literal("")),
});
