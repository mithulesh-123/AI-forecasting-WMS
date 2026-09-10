import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { can } from "@/lib/permissions";
import { productQuerySchema } from "@/lib/validations/catalog";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Pagination } from "@/components/layout/pagination";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { CreateProductDialog, EditProductDialog, DeleteProductDialog } from "./product-dialogs";
import { ProductFilters } from "./product-filters";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const user = await requirePagePermission("products:read", "/products");
  const query = productQuerySchema.parse(await searchParams);

  const where: Prisma.ProductWhereInput = {};
  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { sku: { contains: query.q, mode: "insensitive" } },
    ];
  }
  if (query.category) where.category = { equals: query.category, mode: "insensitive" };

  const orderByMap: Record<string, Prisma.ProductOrderByWithRelationInput> = {
    name: { name: query.order },
    sku: { sku: query.order },
    price: { price: query.order },
    createdAt: { createdAt: query.order },
    stock: { inventories: { _count: query.order } },
  };

  const [products, total, categories, stockAgg] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: orderByMap[query.sort],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    }),
    db.product.count({ where }),
    db.product.findMany({ distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
    db.inventory.groupBy({ by: ["productId"], _sum: { quantity: true } }),
  ]);

  const stockByProduct = new Map(stockAgg.map((s) => [s.productId, s._sum.quantity ?? 0]));
  const rows = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    category: p.category,
    unit: p.unit,
    price: parseFloat(p.price.toString()),
    reorderLevel: p.reorderLevel,
    reorderQuantity: p.reorderQuantity,
    isActive: p.isActive,
    stock: stockByProduct.get(p.id) ?? 0,
  }));

  function sortHref(sortValue: string): string {
    const sp = new URLSearchParams();
    const newOrder = query.sort === sortValue && query.order === "asc" ? "desc" : "asc";
    Object.entries(query).forEach(([k, v]) => {
      if (v && k !== "sort" && k !== "order") sp.set(k, String(v));
    });
    sp.set("sort", sortValue);
    sp.set("order", newOrder);
    return `/products?${sp.toString()}`;
  }

  const canWrite = can(user.role, "products:write");

  return (
    <div>
      <PageHeader
        title="Products"
        description={`${formatNumber(total)} SKUs in the catalog`}
        actions={
          canWrite ? (
            <CreateProductDialog categories={categories.map((c) => c.category)} />
          ) : (
            <Badge variant="secondary">Read-only access</Badge>
          )
        }
      />

      <ProductFilters
        q={query.q ?? ""}
        category={query.category ?? "all"}
        categories={categories.map((c) => c.category)}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description={query.q || query.category ? "Try adjusting your filters." : "Create your first product to get started."}
        />
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Link href={sortHref("sku")} className="hover:text-foreground">SKU</Link>
                  </TableHead>
                  <TableHead>
                    <Link href={sortHref("name")} className="hover:text-foreground">Name</Link>
                  </TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">
                    <Link href={sortHref("price")} className="hover:text-foreground">Price</Link>
                  </TableHead>
                  <TableHead className="text-right">Reorder</TableHead>
                  <TableHead>Status</TableHead>
                  {canWrite && <TableHead className="w-16"><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs font-semibold">{p.sku}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Image
                            src="/product-placeholder.svg"
                            alt=""
                            width={18}
                            height={18}
                            className="text-muted-foreground"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.description || `${p.unit}`}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(p.stock)}{" "}
                      <span className="text-xs text-muted-foreground">{p.unit}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(p.price)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {p.reorderLevel}/{p.reorderQuantity}
                    </TableCell>
                    <TableCell>
                      {!p.isActive ? (
                        <Badge variant="secondary">Archived</Badge>
                      ) : p.stock <= 0 ? (
                        <Badge variant="destructive">Out</Badge>
                      ) : p.stock <= p.reorderLevel ? (
                        <Badge variant="warning">Low</Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex items-center justify-end">
                          <DropdownWrapper>
                            <EditProductDialog product={p} categories={categories.map((c) => c.category)} />
                            <DeleteProductDialog product={p} />
                          </DropdownWrapper>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={query.page} perPage={query.perPage} total={total} basePath="/products" searchParams={{ q: query.q, category: query.category }} />
        </>
      )}
    </div>
  );
}

function DropdownWrapper({ children }: { children: React.ReactNode }) {
  // Row actions are rendered inline via dialogs; wrapper keeps layout tidy.
  return <div className="flex items-center gap-1">{children}</div>;
}
