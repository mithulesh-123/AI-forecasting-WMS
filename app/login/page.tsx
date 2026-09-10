import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PackageSearch, ShieldCheck, TrendingUp } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

const HIGHLIGHTS = [
  { icon: PackageSearch, title: "Real-time inventory", text: "Multi-warehouse stock with reservations" },
  { icon: TrendingUp, title: "AI demand forecasting", text: "Statistical engine with stockout risk scoring" },
  { icon: ShieldCheck, title: "Role-based security", text: "Server-enforced RBAC and audit trails" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(600px circle at 20% 20%, var(--primary), transparent 45%), radial-gradient(500px circle at 80% 80%, color-mix(in oklab, var(--chart-3), transparent 60%), transparent 50%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground text-lg">
              N
            </div>
            <span className="text-lg font-bold tracking-wide">NexusWMS</span>
          </div>
        </div>
        <div className="relative space-y-8">
          <h1 className="max-w-md text-4xl font-bold leading-tight">
            Warehouse intelligence,
            <br /> from shelf to forecast.
          </h1>
          <div className="space-y-5">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <h.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{h.title}</p>
                  <p className="text-sm opacity-70">{h.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs opacity-60">© 2026 NexusWMS · Enterprise Logistics Suite</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <LoginForm nextPath={params.next && params.next.startsWith("/") ? params.next : undefined} />
      </div>
    </div>
  );
}
