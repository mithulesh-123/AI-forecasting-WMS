"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Repeat, Scale, Undo2 } from "lucide-react";
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

export interface PickerProduct {
  id: string;
  sku: string;
  name: string;
}
export interface PickerWarehouse {
  id: string;
  code: string;
  name: string;
}

const OPERATIONS = [
  { value: "IN", label: "Stock IN", icon: ArrowDownToLine, hint: "Receive goods into stock" },
  { value: "OUT", label: "Stock OUT", icon: ArrowUpFromLine, hint: "Ship goods out of stock" },
  { value: "TRANSFER", label: "Transfer", icon: Repeat, hint: "Move stock between warehouses" },
  { value: "ADJUSTMENT", label: "Adjustment", icon: Scale, hint: "Set counted physical quantity" },
  { value: "RETURN", label: "Return", icon: Undo2, hint: "Customer return into stock" },
] as const;

type OpType = (typeof OPERATIONS)[number]["value"];

interface StockOpDialogProps {
  products: PickerProduct[];
  warehouses: PickerWarehouse[];
  /** Pre-select product / warehouse when opened from a row */
  defaultProductId?: string;
  defaultWarehouseId?: string;
  lockProduct?: boolean;
  /** Optional custom trigger element */
  trigger?: React.ReactNode;
}

export function StockOperationDialog({
  products,
  warehouses,
  defaultProductId,
  defaultWarehouseId,
  lockProduct = false,
  trigger,
}: StockOpDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [type, setType] = React.useState<OpType>("IN");
  const [productId, setProductId] = React.useState(defaultProductId ?? "");
  const [warehouseId, setWarehouseId] = React.useState(defaultWarehouseId ?? "");
  const [destinationWarehouseId, setDestination] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [reference, setReference] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setProductId(defaultProductId ?? "");
      setWarehouseId(defaultWarehouseId ?? "");
      setQuantity("");
      setError(null);
    }
  }, [open, defaultProductId, defaultWarehouseId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("type", type);
      fd.set("productId", productId);
      fd.set("warehouseId", warehouseId);
      if (destinationWarehouseId) fd.set("destinationWarehouseId", destinationWarehouseId);
      fd.set("quantity", quantity);
      fd.set("reason", reason);
      fd.set("reference", reference);

      const { applyStockOperationAction } = await import("./actions");
      const res = await applyStockOperationAction(fd);
      if (!res.ok) throw new Error(res.error);
      toast.success(`${OPERATIONS.find((o) => o.value === type)?.label} recorded`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setLoading(false);
    }
  }

  const isTransfer = type === "TRANSFER";

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <ArrowDownToLine /> Stock Operation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Stock operation</DialogTitle>
          <DialogDescription>All changes are transactional and fully audited.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Operation type">
          {OPERATIONS.map((op) => (
            <button
              key={op.value}
              type="button"
              role="radio"
              aria-checked={type === op.value}
              onClick={() => setType(op.value)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[11px] font-medium transition-colors ${
                type === op.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-accent"
              }`}
            >
              <op.icon className="h-4 w-4" />
              {op.label.replace("Stock ", "")}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="grid gap-4">
          {!lockProduct && (
            <div className="grid gap-1.5">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId} required>
                <SelectTrigger aria-label="Product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className={`grid gap-3 ${isTransfer ? "grid-cols-2" : "grid-cols-1"}`}>
            <div className="grid gap-1.5">
              <Label>{isTransfer ? "From warehouse" : "Warehouse"}</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger aria-label="Source warehouse">
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
            {isTransfer && (
              <div className="grid gap-1.5">
                <Label>To warehouse</Label>
                <Select value={destinationWarehouseId} onValueChange={setDestination}>
                  <SelectTrigger aria-label="Destination warehouse">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses
                      .filter((w) => w.id !== warehouseId)
                      .map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.code} — {w.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="op-quantity">
              {type === "ADJUSTMENT" ? "Counted quantity (new total)" : "Quantity"}
            </Label>
            <Input
              id="op-quantity"
              type="number"
              min="1"
              step="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="op-reason">Reason</Label>
              <Input
                id="op-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Purchase order #123"
                maxLength={240}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="op-reference">Reference</Label>
              <Input
                id="op-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="PO / RMA / note"
                maxLength={80}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading || !productId || !warehouseId || (isTransfer && !destinationWarehouseId)}>
              {loading && <Loader2 className="animate-spin" />} Apply operation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
