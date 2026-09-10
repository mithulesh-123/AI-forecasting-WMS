"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
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
import { createWarehouseAction, updateWarehouseAction } from "./actions";

interface WarehouseFormState {
  name: string;
  code: string;
  location: string;
  capacity: string;
  managerName: string;
}

const emptyForm: WarehouseFormState = { name: "", code: "", location: "", capacity: "", managerName: "" };

export function CreateWarehouseDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<WarehouseFormState>(emptyForm);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));
    try {
      const res = await createWarehouseAction(fd);
      if (!res.ok) return setError(res.error);
    } catch (err) {
      return setError(err instanceof Error ? err.message : "Failed to create warehouse");
    }
    toast.success("Warehouse created");
    setOpen(false);
    setForm(emptyForm);
    router.refresh();
  }

  const bind = (name: keyof WarehouseFormState) => ({
    id: name,
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [name]: e.target.value })),
    required: name !== "managerName",
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New Warehouse
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create warehouse</DialogTitle>
          <DialogDescription>Register a new storage facility.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input {...bind("name")} placeholder="Central DC" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="code">Code</Label>
              <Input {...bind("code")} placeholder="WH-EAST" className="uppercase" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="capacity">Capacity (units)</Label>
              <Input {...bind("capacity")} type="number" min="1" step="1" placeholder="10000" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Input {...bind("location")} placeholder="Chicago, IL" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="managerName">Manager</Label>
            <Input {...bind("managerName")} placeholder="Optional" />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />} Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditWarehouseDialog({
  warehouse,
}: {
  warehouse: { id: string; name: string; code: string; location: string; capacity: number; managerName: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<WarehouseFormState>({
    name: warehouse.name,
    code: warehouse.code,
    location: warehouse.location,
    capacity: String(warehouse.capacity),
    managerName: warehouse.managerName ?? "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));
    try {
      const res = await updateWarehouseAction(warehouse.id, fd);
      if (!res.ok) return setError(res.error);
    } catch (err) {
      return setError(err instanceof Error ? err.message : "Failed to update");
    }
    toast.success("Warehouse updated");
    setOpen(false);
    router.refresh();
  }

  const bind = (name: keyof WarehouseFormState) => ({
    id: `${warehouse.id}-${name}`,
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [name]: e.target.value })),
    required: name !== "managerName",
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" aria-label={`Edit ${warehouse.name}`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit warehouse</DialogTitle>
          <DialogDescription>{warehouse.code}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={`${warehouse.id}-name`}>Name</Label>
            <Input {...bind("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`${warehouse.id}-code`}>Code</Label>
              <Input {...bind("code")} className="uppercase" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${warehouse.id}-capacity`}>Capacity (units)</Label>
              <Input {...bind("capacity")} type="number" min="1" step="1" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${warehouse.id}-location`}>Location</Label>
            <Input {...bind("location")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${warehouse.id}-managerName`}>Manager</Label>
            <Input {...bind("managerName")} />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
