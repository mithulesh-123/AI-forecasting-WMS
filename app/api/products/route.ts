import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { createProductSchema, productQuerySchema } from "@/lib/validations/catalog";
import { writeAudit } from "@/lib/audit";
import { ConflictError } from "@/lib/errors";
import { created, fail, handleApiError, ok } from "@/lib/api/response";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("products:read");
    const query = productQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const where: Prisma.ProductWhereInput = {};
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { sku: { contains: query.q, mode: "insensitive" } },
      ];
    }
    if (query.category) where.category = query.category;

    const orderByMap: Record<string, Prisma.ProductOrderByWithRelationInput> = {
      name: { name: query.order },
      sku: { sku: query.order },
      price: { price: query.order },
      createdAt: { createdAt: query.order },
      stock: { inventories: { _count: query.order } },
    };

    const [items, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: orderByMap[query.sort],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      db.product.count({ where }),
    ]);

    return ok({ items, total, page: query.page, perPage: query.perPage });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("products:write");
    const parsed = createProductSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("Invalid product payload", 422, "VALIDATION_ERROR");

    const existing = await db.product.findUnique({ where: { sku: parsed.data.sku } });
    if (existing) throw new ConflictError(`SKU ${parsed.data.sku} already exists`);

    const product = await db.product.create({ data: parsed.data });
    await writeAudit({
      userId: user.id,
      userEmail: user.email,
      action: "PRODUCT_CREATED",
      entity: "Product",
      entityId: product.id,
      metadata: { sku: product.sku },
    });
    return created(product);
  } catch (error) {
    return handleApiError(error);
  }
}
