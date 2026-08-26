"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ProductFilters({
  q,
  category,
  categories,
}: {
  q: string;
  category: string;
  categories: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(q);

  function pushParams(mutate: (sp: URLSearchParams) => void) {
    const sp = new URLSearchParams(searchParams.toString());
    mutate(sp);
    router.push(`/products?${sp.toString()}`, { scroll: false });
  }

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <form
        className="flex flex-1 gap-2 sm:max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          pushParams((sp) => {
            if (search) sp.set("q", search);
            else sp.delete("q");
            sp.delete("page");
          });
        }}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or SKU…"
          aria-label="Search products"
        />
        <Button type="submit" variant="secondary">
          <PackageSearch className="sm:hidden" />
          <span className="hidden sm:inline">Search</span>
        </Button>
      </form>
      <Select
        value={category || "all"}
        onValueChange={(v) =>
          pushParams((sp) => {
            if (v === "all") sp.delete("category");
            else sp.set("category", v);
            sp.delete("page");
          })
        }
      >
        <SelectTrigger className="w-full sm:w-52" aria-label="Filter by category">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
