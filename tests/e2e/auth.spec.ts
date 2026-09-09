import { test, expect } from "@playwright/test";

const PASSWORD = "Password123!";

test.describe("Authentication - Demo Account Buttons", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("clicking demo account buttons populates credentials without premature form submission", async ({ page }) => {
    const emailInput = page.locator("#email");
    const passwordInput = page.locator("#password");

    // Admin demo card
    await page.getByRole("button", { name: /Admin/i }).click();
    await expect(emailInput).toHaveValue("admin@nexuswms.io");
    await expect(passwordInput).toHaveValue(PASSWORD);
    await expect(page).toHaveURL(/.*\/login/);

    // Manager demo card
    await page.getByRole("button", { name: /Manager/i }).click();
    await expect(emailInput).toHaveValue("manager@nexuswms.io");
    await expect(passwordInput).toHaveValue(PASSWORD);
    await expect(page).toHaveURL(/.*\/login/);

    // Staff demo card
    await page.getByRole("button", { name: /Staff/i }).click();
    await expect(emailInput).toHaveValue("staff@nexuswms.io");
    await expect(passwordInput).toHaveValue(PASSWORD);
    await expect(page).toHaveURL(/.*\/login/);

    // Viewer demo card
    await page.getByRole("button", { name: /Viewer/i }).click();
    await expect(emailInput).toHaveValue("viewer@nexuswms.io");
    await expect(passwordInput).toHaveValue(PASSWORD);
    await expect(page).toHaveURL(/.*\/login/);
  });
});

test.describe("Authentication - Demo Account Logins", () => {
  test("Admin can sign in successfully via demo card and access admin features", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Admin/i }).click();
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Audit Logs" })).toBeVisible();
  });

  test("Manager can sign in successfully and access operational features", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Manager/i }).click();
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByRole("link", { name: "Inventory" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dispatch" })).toBeVisible();
    await expect(page.getByRole("link", { name: "AI Forecast" })).toBeVisible();
    // Manager does not have access to Users or Audit Logs navigation
    await expect(page.getByRole("link", { name: "Users" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Audit Logs" })).not.toBeVisible();
  });

  test("Staff can sign in successfully and access stock & dispatch operations", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Staff/i }).click();
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByRole("link", { name: "Inventory" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Stock Movement" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dispatch" })).toBeVisible();
    // Staff does not have Forecast, Reports, Users, or Audit Logs
    await expect(page.getByRole("link", { name: "AI Forecast" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Reports" })).not.toBeVisible();
  });

  test("Viewer can sign in successfully and has read-only access", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Viewer/i }).click();
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "AI Forecast" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reports" })).toBeVisible();
    // Viewer does not have Users or Audit Logs
    await expect(page.getByRole("link", { name: "Users" })).not.toBeVisible();
  });
});

test.describe("Authentication - Invalid Cases and Normalization", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows error message for wrong password", async ({ page }) => {
    await page.locator("#email").fill("admin@nexuswms.io");
    await page.locator("#password").fill("WrongPassword123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    const alert = page.locator("form p[role='alert']");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(/Invalid credentials/i);
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("shows error message for non-existent email", async ({ page }) => {
    await page.locator("#email").fill("nonexistent@nexuswms.io");
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    const alert = page.locator("form p[role='alert']");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(/Invalid credentials/i);
  });

  test("handles email with whitespace and mixed casing correctly", async ({ page }) => {
    await page.locator("#email").fill("   Admin@NexusWMS.io   ");
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test("validates required inputs before submitting", async ({ page }) => {
    // Attempt submit with empty fields
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/.*\/login/);
  });
});

test.describe("Session Management & RBAC Enforcement", () => {
  test("persists session across page refresh and navigation", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Admin/i }).click();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Refresh page
    await page.reload();
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();

    // Navigate to Inventory
    await page.goto("/inventory");
    await expect(page).toHaveURL(/.*\/inventory/);
  });

  test("enforces role-based guards: Staff is redirected away from forbidden routes", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Staff/i }).click();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Attempt to access Users page
    await page.goto("/users");
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Attempt to access Audit Logs page
    await page.goto("/audit-logs");
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Attempt to access Forecast page
    await page.goto("/forecast");
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test("enforces role-based guards: Viewer is redirected away from Users and Audit Logs", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Viewer/i }).click();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);

    await page.goto("/users");
    await expect(page).toHaveURL(/.*\/dashboard/);

    await page.goto("/audit-logs");
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test("logout invalidates session and blocks protected routes", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Admin/i }).click();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Open user menu and click Sign out
    await page.getByLabel("Account menu").click();
    await page.getByRole("menuitem", { name: /Sign out/i }).click();

    await expect(page).toHaveURL(/.*\/login/);

    // Attempting to access protected route after logout redirects to login
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*\/login.*next=%2Fdashboard/);
  });
});
