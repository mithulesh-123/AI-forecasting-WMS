import { describe, expect, it } from "vitest";
import { can, canAny, ROLE_PERMISSIONS } from "@/lib/permissions";
import type { Role } from "@prisma/client";

const ROLES: Role[] = ["ADMIN", "MANAGER", "WAREHOUSE_STAFF", "VIEWER"];

describe("RBAC permission matrix", () => {
  it("grants ADMIN every registered permission", () => {
    expect(ROLE_PERMISSIONS.ADMIN.length).toBeGreaterThan(15);
    for (const p of ROLE_PERMISSIONS.ADMIN) {
      expect(can("ADMIN", p)).toBe(true);
    }
  });

  it("gives VIEWER read access but zero write/process permissions", () => {
    const writes = ROLE_PERMISSIONS.VIEWER.filter((p) => p.endsWith(":write") || p.endsWith(":process"));
    expect(writes).toHaveLength(0);
    expect(can("VIEWER", "dashboard:read")).toBe(true);
    expect(can("VIEWER", "products:read")).toBe(true);
    expect(can("VIEWER", "inventory:read")).toBe(true);
    expect(can("VIEWER", "forecast:run")).toBe(false);
    expect(can("VIEWER", "users:write")).toBe(false);
  });

  it("lets WAREHOUSE_STAFF operate stock & dispatch but not manage users or forecasts", () => {
    expect(can("WAREHOUSE_STAFF", "inventory:write")).toBe(true);
    expect(can("WAREHOUSE_STAFF", "movements:write")).toBe(true);
    expect(can("WAREHOUSE_STAFF", "dispatch:write")).toBe(true);
    expect(can("WAREHOUSE_STAFF", "dispatch:process")).toBe(true);
    expect(can("WAREHOUSE_STAFF", "users:read")).toBe(false);
    expect(can("WAREHOUSE_STAFF", "audit:read")).toBe(false);
    expect(can("WAREHOUSE_STAFF", "reports:read")).toBe(false);
    expect(can("WAREHOUSE_STAFF", "products:write")).toBe(false);
  });

  it("lets MANAGER manage catalog/warehouses/inventory/dispatch/forecasts but not users", () => {
    expect(can("MANAGER", "products:write")).toBe(true);
    expect(can("MANAGER", "warehouses:write")).toBe(true);
    expect(can("MANAGER", "inventory:write")).toBe(true);
    expect(can("MANAGER", "dispatch:process")).toBe(true);
    expect(can("MANAGER", "forecast:run")).toBe(true);
    expect(can("MANAGER", "users:write")).toBe(false);
    expect(can("MANAGER", "audit:read")).toBe(false); // audit is admin-only
  });

  it("never grants write without read on the same resource", () => {
    for (const role of ROLES) {
      for (const p of ROLE_PERMISSIONS[role]) {
        if (p.endsWith(":write")) {
          const resource = p.split(":")[0];
          expect(can(role, `${resource}:read` as (typeof p))).toBe(true);
        }
      }
    }
  });

  it("canAny matches can() semantics", () => {
    expect(canAny("ADMIN", ["users:write"])).toBe(true);
    expect(canAny("VIEWER", ["users:write", "inventory:write"])).toBe(false);
    expect(canAny("VIEWER", ["users:write", "products:read"])).toBe(true);
  });
});
