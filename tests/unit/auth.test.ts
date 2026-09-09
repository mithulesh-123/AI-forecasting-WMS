import { describe, it, expect, beforeAll } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSession, verifySessionToken } from "@/lib/auth/session";
import { verifySessionToken as verifyEdgeSessionToken } from "@/lib/auth/session.edge";
import { loginSchema, createUserSchema, changePasswordSchema } from "@/lib/validations/auth";

describe("Password Hashing and Verification", () => {
  it("hashes password and successfully verifies the correct plain password", async () => {
    const plain = "Password123!";
    const hash = await hashPassword(plain);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(plain);
    expect(await verifyPassword(plain, hash)).toBe(true);
  });

  it("fails verification for incorrect password", async () => {
    const hash = await hashPassword("Password123!");
    expect(await verifyPassword("WrongPassword123!", hash)).toBe(false);
  });

  it("handles malformed hash gracefully without throwing", async () => {
    expect(await verifyPassword("Password123!", "invalid_hash_string")).toBe(false);
  });
});

describe("JWT Session Creation and Verification", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "dev-only-secret-replace-in-production-0123456789abcdef";
  });

  const payload = {
    sub: "user-cuid-12345",
    email: "admin@nexuswms.io",
    role: "ADMIN" as const,
    name: "Alex Rivera",
  };

  it("signs a token and verifies it with Node runtime session verifier", async () => {
    const token = await signSession(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe(payload.sub);
    expect(verified?.email).toBe(payload.email);
    expect(verified?.role).toBe(payload.role);
    expect(verified?.name).toBe(payload.name);
  });

  it("verifies the signed token with Edge runtime session verifier", async () => {
    const token = await signSession(payload);
    const verified = await verifyEdgeSessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe(payload.sub);
    expect(verified?.email).toBe(payload.email);
    expect(verified?.role).toBe(payload.role);
    expect(verified?.name).toBe(payload.name);
  });

  it("returns null for expired or invalid token strings", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("invalid.jwt.token")).toBeNull();
    expect(await verifyEdgeSessionToken("invalid.jwt.token")).toBeNull();
  });
});

describe("Auth Validation Schemas", () => {
  it("normalizes and accepts valid login credentials with mixed case and whitespace", () => {
    const parsed = loginSchema.safeParse({
      email: "  Admin@NexusWMS.io  ",
      password: "Password123!",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("admin@nexuswms.io");
      expect(parsed.data.password).toBe("Password123!");
    }
  });

  it("rejects empty email or missing password", () => {
    expect(loginSchema.safeParse({ email: "", password: "Password123!" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "admin@nexuswms.io", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "not-an-email", password: "Password123!" }).success).toBe(false);
  });

  it("validates password complexity in createUserSchema", () => {
    expect(
      createUserSchema.safeParse({
        name: "Test User",
        email: "test@nexuswms.io",
        password: "short",
        role: "VIEWER",
      }).success,
    ).toBe(false);

    expect(
      createUserSchema.safeParse({
        name: "Test User",
        email: "test@nexuswms.io",
        password: "ValidPassword123",
        role: "VIEWER",
      }).success,
    ).toBe(true);
  });

  it("enforces password confirmation matching in changePasswordSchema", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "OldPassword123",
        newPassword: "NewPassword123",
        confirmPassword: "MismatchPassword123",
      }).success,
    ).toBe(false);

    expect(
      changePasswordSchema.safeParse({
        currentPassword: "OldPassword123",
        newPassword: "NewPassword123",
        confirmPassword: "NewPassword123",
      }).success,
    ).toBe(true);
  });
});
