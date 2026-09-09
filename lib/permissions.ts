import type { Role } from "@prisma/client";

/**
 * Permission catalogue. Format: "<resource>:<action>".
 * Authorization is enforced server-side in server actions, page guards and
 * route handlers - the UI only mirrors these decisions for UX.
 */
export const PERMISSIONS = [
  // read
  "dashboard:read",
  "products:read",
  "products:write",
  "warehouses:read",
  "warehouses:write",
  "inventory:read",
  "inventory:write",
  "movements:read",
  "movements:write",
  "dispatch:read",
  "dispatch:write",
  "dispatch:process",
  "forecast:read",
  "forecast:run",
  "reports:read",
  "users:read",
  "users:write",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const READ_ONLY: Permission[] = [
  "dashboard:read",
  "products:read",
  "warehouses:read",
  "inventory:read",
  "movements:read",
  "dispatch:read",
  "forecast:read",
  "reports:read",
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  MANAGER: [
    ...READ_ONLY,
    "products:write",
    "warehouses:write",
    "inventory:write",
    "dispatch:write",
    "dispatch:process",
    "forecast:run",
  ],
  WAREHOUSE_STAFF: [
    "dashboard:read",
    "products:read",
    "warehouses:read",
    "inventory:read",
    "inventory:write",
    "movements:read",
    "movements:write",
    "dispatch:read",
    "dispatch:write",
    "dispatch:process",
  ],
  VIEWER: READ_ONLY,
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}
