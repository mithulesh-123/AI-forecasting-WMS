"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({ name }: { name: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [value, setValue] = React.useState(name);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("name", value);
      const { updateProfileAction } = await import("./actions");
      const res = await updateProfileAction(fd);
      if (!res.ok) throw new Error(res.error);
      toast.success("Profile updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your public display identity</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex max-w-sm items-end gap-2">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="profile-name">Full name</Label>
            <Input id="profile-name" value={value} onChange={(e) => setValue(e.target.value)} required minLength={2} />
          </div>
          <Button type="submit" disabled={loading || value === name}>
            {loading && <Loader2 className="animate-spin" />} Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function PasswordForm() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const { changePasswordAction } = await import("./actions");
      const res = await changePasswordAction(fd);
      if (!res.ok) throw new Error(res.error);
      toast.success("Password changed");
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Minimum 8 characters including a letter and a number</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid max-w-sm gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input id="current-password" name="currentPassword" type="password" required autoComplete="current-password" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input id="confirm-password" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-fit">
            {loading && <Loader2 className="animate-spin" />} Change password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
