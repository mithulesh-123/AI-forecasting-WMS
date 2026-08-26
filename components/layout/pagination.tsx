import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Server-rendered pagination driven entirely by URL search params.
 */
export function Pagination({
  page,
  perPage,
  total,
  basePath,
  searchParams,
}: {
  page: number;
  perPage: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (totalPages <= 1) return <p className="text-xs text-muted-foreground">{total} result{total === 1 ? "" : "s"}</p>;

  function hrefFor(pageNum: number): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") sp.set(k, v);
    }
    sp.set("page", String(pageNum));
    return `${basePath}?${sp.toString()}`;
  }

  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  return (
    <nav className="flex items-center justify-between pt-3" aria-label="Pagination">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}–{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <Button asChild variant="outline" size="sm" disabled={page <= 1} className={cn(page <= 1 && "pointer-events-none opacity-50")}>
          <Link href={hrefFor(page - 1)} scroll={false} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" /> Prev
          </Link>
        </Button>
        <span className="px-2 text-xs text-muted-foreground">
          Page {page} / {totalPages}
        </span>
        <Button
          asChild
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          className={cn(page >= totalPages && "pointer-events-none opacity-50")}
        >
          <Link href={hrefFor(page + 1)} scroll={false} aria-label="Next page">
            Next <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </nav>
  );
}
