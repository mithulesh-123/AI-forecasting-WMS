"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@nexuswms.io" },
  { role: "Manager", email: "manager@nexuswms.io" },
  { role: "Staff", email: "staff@nexuswms.io" },
  { role: "Viewer", email: "viewer@nexuswms.io" },
];

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Login failed");
      }
      toast.success(`Welcome back, ${json.data.name.split(" ")[0]}`);
      router.push(nextPath ?? "/dashboard");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground text-lg lg:hidden">
          N
        </div>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your warehouse workspace</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={onSubmit} className="grid gap-4" noValidate={false}>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              minLength={1}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
            Sign in
          </Button>
        </form>

        <div className="rounded-lg border bg-muted/40 p-3 text-xs">
          <p className="mb-2 font-semibold text-muted-foreground">Demo accounts (seeded)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  const form = document.querySelector("form");
                  if (!form) return;
                  (form.elements.namedItem("email") as HTMLInputElement).value = acc.email;
                  (form.elements.namedItem("password") as HTMLInputElement).value = "Password123!";
                }}
                className="rounded-md border bg-card px-2 py-1.5 text-left transition-colors hover:border-primary hover:text-primary"
              >
                <span className="font-medium">{acc.role}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{acc.email}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Password for all demo accounts: <code className="font-mono font-semibold">Password123!</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
