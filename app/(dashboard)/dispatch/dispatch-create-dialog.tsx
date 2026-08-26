"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PickerProduct, PickerWarehouse } from "@/app/(dashboard)/inventory/stock-op-dialog";

interface Line {
  productId: string;
  quantity: string;
}

export function CreateDispatchDialog({
  products,
  warehouses,
}: {
  products: PickerProduct[];
  warehouses: PickerWarehouse[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [customerName, setCustomerName] = React.useState("");
  const [customerRef, setCustomerRef] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<Line[]>([{ productId: "", quantity: "" }]);
  const [availability, setAvailability] = React.useState<Record<string, number>>({});

  const productById = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  async function loadAvailability(whId: string) {
    if (!whId) return setAvailability({});
    try {
      const res = await fetch(`/api/inventory/availability?warehouseId=${encodeURIComponent(whId)}`);
      const json = await res.json();
      if (json.success) setAvailability(json.data.availability ?? {});
    } catch {
      setAvailability({});
    }
  }

  function addLine() {
    setLines((l) => [...l, { productId: "", quantity: "" }]);
  }

  function removeLine(index: number) {
    setLines((l) => (l.length > 1 ? l.filter((_, i) => i !== index) : l));
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((l) => l.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Client-side availability pre-check for fast feedback; server enforces authoritatively.
    for (const line of lines) {
      const qty = parseInt(line.quantity, 10);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError("Every line needs a valid quantity");
        setLoading(false);
        return;
      }
      if (availability[line.productId] !== undefined && qty > availability[line.productId]) {
        const p = productById.get(line.productId);
        setError(`${p?.sku ?? "Product"}: requested ${qty}, available ${availability[line.productId]}`);
        setLoading(false);
        return;
      }
    }

    try {
      const fd = new FormData();
      fd.set("customerName", customerName);
      fd.set("customerRef", customerRef);
      fd.set("warehouseId", warehouseId);
      fd.set("notes", notes);
      fd.set(
        "items",
        JSON.stringify(lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }))),
      );
      const { createDispatchAction } = await import("./actions");
      const res = await createDispatchAction(fd);
      if (!res.ok) throw new Error(res.error);
      toast.success(`Dispatch ${res.number} created — stock reserved`);
      setOpen(false);
      setCustomerName("");
      setCustomerRef("");
      setNotes("");
      setLines([{ productId: "", quantity: "" }]);
      router.push(`/dispatch/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create dispatch");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
      <DialogTrigger asChild>
        <Button>
          <Truck /> New Dispatch
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create dispatch</DialogTitle>
          <DialogDescription>Available stock is validated and reserved immediately.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="customerName">Customer *</Label>
              <Input id="customerName" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Acme Corp" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="customerRef">Reference</Label>
              <Input id="customerRef" value={customerRef} onChange={(e) => setCustomerRef(e.target.value)} placeholder="PO / SO number" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Origin warehouse *</Label>
            <Select
              value={warehouseId}
              onValueChange={(v) => {
                setWarehouseId(v);
                void loadAvailability(v);
              }}
            >
              <SelectTrigger aria-label="Origin warehouse">
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="rounded-lg border p-3">
            <legend className="px-1 text-sm font-semibold">Products</legend>
            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select
                      value={line.productId}
                      onValueChange={(v) => updateLine(index, { productId: v })}
                    >
                      <SelectTrigger aria-label={`Product line ${index + 1}`}>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.sku} — {p.name}
                            {warehouseId && availability[p.id] !== undefined && (
                              ` (${availability[p.id]} avail)`
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    className="w-24"
                    placeholder="Qty"
                    aria-label={`Quantity line ${index + 1}`}
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: e.target.value })}
                  />
                  {line.productId && warehouseId && availability[line.productId] !== undefined && (
                    <span className="hidden w-20 text-right text-xs tabular-nums text-muted-foreground sm:block">
                      {availability[line.productId]} avail
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(index)}
                    disabled={lines.length === 1}
                    aria-label={`Remove line ${index + 1}`}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine} className="mt-2">
              <Plus /> Add line
            </Button>
          </fieldset>

          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional handling notes" maxLength={500} />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading || !warehouseId}>
              {loading && <Loader2 className="animate-spin" />} Create & reserve stock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
