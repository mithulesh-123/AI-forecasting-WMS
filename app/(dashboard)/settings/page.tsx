import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth/guards";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { hasExternalProvider } from "@/lib/ai/provider";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm, PasswordForm } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requirePageUser();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Account preferences and workspace information" />

      <ProfileForm name={user.name} />
      <PasswordForm />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Switch between light and dark themes using the toggle in the header.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your role & permissions</CardTitle>
          <CardDescription>
            Access is enforced server-side on every page, action and API route.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          <Badge variant="warning">{user.role.replace("_", " ")}</Badge>
          {ROLE_PERMISSIONS[user.role].map((p) => (
            <span key={p} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {p}
            </span>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <InfoRow label="Platform" value="Vercel serverless (Next.js App Router)" />
          <InfoRow label="Database" value="PostgreSQL via Prisma ORM" />
          <InfoRow
            label="Forecast engine"
            value={
              hasExternalProvider()
                ? "External AI provider configured (statistical fallback)"
                : "Local statistical engine (Holt + weekly seasonality)"
            }
          />
          <InfoRow label="Session" value={`JWT (HS256), httpOnly cookie, 7-day expiry`} />
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-lg border p-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
