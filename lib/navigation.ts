import type { Role } from "@prisma/client";
import { can, type Permission } from "@/lib/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  permission?: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", permission: "dashboard:read" },
  { label: "Inventory", href: "/inventory", icon: "Boxes", permission: "inventory:read" },
  { label: "Products", href: "/products", icon: "Package", permission: "products:read" },
  { label: "Warehouses", href: "/warehouses", icon: "Warehouse", permission: "warehouses:read" },
  { label: "Stock Movement", href: "/stock-movements", icon: "ArrowLeftRight", permission: "movements:read" },
  { label: "Dispatch", href: "/dispatch", icon: "Truck", permission: "dispatch:read" },
  { label: "AI Forecast", href: "/forecast", icon: "BrainCircuit", permission: "forecast:read" },
  { label: "Reports", href: "/reports", icon: "FileBarChart2", permission: "reports:read" },
  { label: "Users", href: "/users", icon: "Users", permission: "users:read" },
  { label: "Audit Logs", href: "/audit-logs", icon: "ScrollText", permission: "audit:read" },
  { label: "Settings", href: "/settings", icon: "Settings" },
];

/** Server-side navigation filtering - the UI never invents access rules. */
export function filterNavigation(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.permission || can(role, item.permission));
}
