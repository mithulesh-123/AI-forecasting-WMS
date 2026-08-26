"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Bell,
  BrainCircuit,
  Boxes,
  FileBarChart2,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScrollText,
  Settings,
  Truck,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import type { NavItem } from "@/lib/navigation";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Boxes,
  Package,
  Warehouse,
  ArrowLeftRight,
  Truck,
  BrainCircuit,
  FileBarChart2,
  Users,
  ScrollText,
  Settings,
};

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "WARNING" | "CRITICAL";
  createdAt: string;
}

export interface AppShellUser {
  name: string;
  email: string;
  role: string;
}

export function AppShell({
  user,
  navigation,
  unreadCount,
  children,
}: {
  user: AppShellUser;
  navigation: NavItem[];
  unreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationItem[] | null>(null);

  React.useEffect(() => setMobileOpen(false), [pathname]);

  async function loadNotifications() {
    if (notifications) return;
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data.items ?? []);
      }
    } catch {
      setNotifications([]);
    }
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "POST" });
    await loadNotificationsForce();
  }

  async function loadNotificationsForce() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data.items ?? []);
      }
    } catch {
      /* keep previous state */
    }
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
          N
        </div>
        <div>
          <p className="text-sm font-bold leading-tight tracking-wide">NexusWMS</p>
          <p className="text-[10px] uppercase tracking-widest opacity-60">Logistics Suite</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main navigation">
        {navigation.map((item) => {
          const Icon = ICONS[item.icon] ?? Package;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/90 text-primary-foreground shadow"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4 text-xs opacity-60">
        NexusWMS v1.0 · Secure Session
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 lg:block">{sidebar}</aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-xl">
            <button
              className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-white/80 hover:bg-white/10"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />

            <DropdownMenu onOpenChange={(open) => open && void loadNotifications()}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Notifications (${unreadCount} unread)`}>
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  Notifications
                  <button onClick={markAllRead} className="text-xs font-normal text-primary hover:underline">
                    Mark all read
                  </button>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!notifications ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</div>
                ) : notifications.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    You are all caught up.
                  </div>
                ) : (
                  notifications.slice(0, 8).map((n) => (
                    <div key={n.id} className="flex gap-2 px-3 py-2 text-sm hover:bg-accent">
                      <Badge
                        variant={n.type === "CRITICAL" ? "destructive" : n.type === "WARNING" ? "warning" : "secondary"}
                        className="mt-0.5 shrink-0"
                      >
                        {n.type}
                      </Badge>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{n.title}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Account menu"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                    {initials(user.name)}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
                  <Badge variant="secondary" className="mt-1.5">
                    {user.role.replace("_", " ")}
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
