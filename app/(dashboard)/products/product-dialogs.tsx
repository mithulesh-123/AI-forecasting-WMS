"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ProductDto } from "./types";
import { createProductAction, updateProductAction, deleteProductAction } from "./actions";

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" disabled={loading}>
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

const initialForm = (product?: ProductDto) => ({
  sku: product?.sku ?? "",
  name: product?.name ?? "",
  description: product?.description ?? "",
  category: product?.category ?? "",
  unit: product?.unit ?? "pcs",
  price: product ? String(product.price) : "",
  reorderLevel: product ? String(product.reorderLevel) : "10",
  reorderQuantity: product ? String(product.reorderQuantity) : "50",
});

export function CreateProductDialog({ categories }: { categories: string[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(() => initialForm());

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));
    const res = await createProduct(fd);
    setLoading(false);
    if (!res.ok) return setError(res.error);
    toast.success("Product created");
    setOpen(false);
    setForm(initialForm());
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create product</DialogTitle>
          <DialogDescription>Add a new SKU to the catalog.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <ProductFormFields form={form} setForm={setForm} categories={categories} />
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <SubmitButton loading={loading}>Create product</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditProductDialog({
  product,
  categories,
}: {
  product: ProductDto;
  categories: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(() => initialForm(product));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));
    const res = await updateProduct(product.id, fd);
    setLoading(false);
    if (!res.ok) return setError(res.error);
    toast.success("Product updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
      <DialogTrigger asChild>
        <button type="button" className="flex w-full items-center gap-2" aria-label={`Edit ${product.name}`}>
          <Pencil /> Edit
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit product</DialogTitle>
          <DialogDescription>Update catalog information for {product.sku}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <ProductFormFields form={form} setForm={setForm} categories={categories} />
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <SubmitButton loading={loading}>Save changes</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteProductDialog({ product }: { product: ProductDto }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function onDelete() {
    setLoading(true);
    const res = await removeProduct(product.id);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("archived" in res && res.archived ? "Product archived (has history)" : "Product deleted");
    setOpen(false);
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 text-destructive focus:text-destructive"
          aria-label={`Delete ${product.name}`}
        >
          <Trash2 /> Delete
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Products with movement history are archived instead of deleted to preserve the audit ledger.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onDelete();
            }}
            variant="destructive"
            disabled={loading}
          >
            {loading && <Loader2 className="animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Server action wrappers - surface thrown errors as dialog messages.
async function createProduct(fd: FormData) {
  try {
    return await createProductAction(fd);
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Failed" };
  }
}
async function updateProduct(id: string, fd: FormData) {
  try {
    return await updateProductAction(id, fd);
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Failed" };
  }
}
async function removeProduct(id: string) {
  try {
    return await deleteProductAction(id);
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Failed" };
  }
}

export function ProductFormFields({
  form,
  setForm,
  categories,
}: {
  form: ReturnType<typeof initialForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof initialForm>>>;
  categories: string[];
}) {
  const field = (name: keyof ReturnType<typeof initialForm>) => ({
    id: name,
    name,
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [name]: e.target.value })),
    required: name !== "description",
  });

  const categoryOptions = [...new Set([...categories.filter(Boolean), form.category].filter(Boolean))];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="sku">SKU</Label>
          <Input {...field("sku")} placeholder="WM-1001" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="category">Category</Label>
          <Input {...field("category")} list="category-options" placeholder="Electronics" />
          <datalist id="category-options">
            {categoryOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input {...field("name")} placeholder="Wireless Mouse" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Input {...field("description")} placeholder="Optional description" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="unit">Unit</Label>
          <Input {...field("unit")} placeholder="pcs" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="price">Price</Label>
          <Input {...field("price")} type="number" min="0" step="0.01" placeholder="19.99" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="reorderLevel">Reorder level</Label>
          <Input {...field("reorderLevel")} type="number" min="0" step="1" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="reorderQuantity">Reorder quantity</Label>
          <Input {...field("reorderQuantity")} type="number" min="1" step="1" />
        </div>
      </div>
    </div>
  );
}
