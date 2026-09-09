# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication - Demo Account Logins >> Admin can sign in successfully via demo card and access admin features
- Location: tests\e2e\auth.spec.ts:41:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /.*\/dashboard/
Received string:  "http://localhost:3000/login"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    14 × locator resolved to <html lang="en" class="__variable_8adcd2 light">…</html>
       - unexpected value "http://localhost:3000/login"

```

```yaml
- text: N NexusWMS
- heading "Warehouse intelligence, from shelf to forecast." [level=1]
- paragraph: Real-time inventory
- paragraph: Multi-warehouse stock with reservations
- paragraph: AI demand forecasting
- paragraph: Statistical engine with stockout risk scoring
- paragraph: Role-based security
- paragraph: Server-enforced RBAC and audit trails
- paragraph: © 2026 NexusWMS · Enterprise Logistics Suite
- text: "N"
- heading "Welcome back" [level=3]
- paragraph: Sign in to your warehouse workspace
- text: Email
- textbox "Email":
  - /placeholder: you@company.com
- text: Password
- textbox "Password":
  - /placeholder: ••••••••
- button "Sign in"
- paragraph: Demo accounts (seeded)
- button "Adminadmin@nexuswms.io"
- button "Managermanager@nexuswms.io"
- button "Staffstaff@nexuswms.io"
- button "Viewerviewer@nexuswms.io"
- paragraph:
  - text: "Password for all demo accounts:"
  - code: Password123!
- region "Notifications alt+T"
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | const PASSWORD = "Password123!";
  4   | 
  5   | test.describe("Authentication - Demo Account Buttons", () => {
  6   |   test.beforeEach(async ({ page }) => {
  7   |     await page.goto("/login");
  8   |   });
  9   | 
  10  |   test("clicking demo account buttons populates credentials without premature form submission", async ({ page }) => {
  11  |     const emailInput = page.locator("#email");
  12  |     const passwordInput = page.locator("#password");
  13  | 
  14  |     // Admin demo card
  15  |     await page.getByRole("button", { name: /Admin/i }).click();
  16  |     await expect(emailInput).toHaveValue("admin@nexuswms.io");
  17  |     await expect(passwordInput).toHaveValue(PASSWORD);
  18  |     await expect(page).toHaveURL(/.*\/login/);
  19  | 
  20  |     // Manager demo card
  21  |     await page.getByRole("button", { name: /Manager/i }).click();
  22  |     await expect(emailInput).toHaveValue("manager@nexuswms.io");
  23  |     await expect(passwordInput).toHaveValue(PASSWORD);
  24  |     await expect(page).toHaveURL(/.*\/login/);
  25  | 
  26  |     // Staff demo card
  27  |     await page.getByRole("button", { name: /Staff/i }).click();
  28  |     await expect(emailInput).toHaveValue("staff@nexuswms.io");
  29  |     await expect(passwordInput).toHaveValue(PASSWORD);
  30  |     await expect(page).toHaveURL(/.*\/login/);
  31  | 
  32  |     // Viewer demo card
  33  |     await page.getByRole("button", { name: /Viewer/i }).click();
  34  |     await expect(emailInput).toHaveValue("viewer@nexuswms.io");
  35  |     await expect(passwordInput).toHaveValue(PASSWORD);
  36  |     await expect(page).toHaveURL(/.*\/login/);
  37  |   });
  38  | });
  39  | 
  40  | test.describe("Authentication - Demo Account Logins", () => {
  41  |   test("Admin can sign in successfully via demo card and access admin features", async ({ page }) => {
  42  |     await page.goto("/login");
  43  |     await page.getByRole("button", { name: /Admin/i }).click();
  44  |     await page.getByRole("button", { name: "Sign in" }).click();
  45  | 
> 46  |     await expect(page).toHaveURL(/.*\/dashboard/);
      |                        ^ Error: expect(page).toHaveURL(expected) failed
  47  |     await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  48  |     await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
  49  |     await expect(page.getByRole("link", { name: "Audit Logs" })).toBeVisible();
  50  |   });
  51  | 
  52  |   test("Manager can sign in successfully and access operational features", async ({ page }) => {
  53  |     await page.goto("/login");
  54  |     await page.getByRole("button", { name: /Manager/i }).click();
  55  |     await page.getByRole("button", { name: "Sign in" }).click();
  56  | 
  57  |     await expect(page).toHaveURL(/.*\/dashboard/);
  58  |     await expect(page.getByRole("link", { name: "Inventory" })).toBeVisible();
  59  |     await expect(page.getByRole("link", { name: "Dispatch" })).toBeVisible();
  60  |     await expect(page.getByRole("link", { name: "AI Forecast" })).toBeVisible();
  61  |     // Manager does not have access to Users or Audit Logs navigation
  62  |     await expect(page.getByRole("link", { name: "Users" })).not.toBeVisible();
  63  |     await expect(page.getByRole("link", { name: "Audit Logs" })).not.toBeVisible();
  64  |   });
  65  | 
  66  |   test("Staff can sign in successfully and access stock & dispatch operations", async ({ page }) => {
  67  |     await page.goto("/login");
  68  |     await page.getByRole("button", { name: /Staff/i }).click();
  69  |     await page.getByRole("button", { name: "Sign in" }).click();
  70  | 
  71  |     await expect(page).toHaveURL(/.*\/dashboard/);
  72  |     await expect(page.getByRole("link", { name: "Inventory" })).toBeVisible();
  73  |     await expect(page.getByRole("link", { name: "Stock Movement" })).toBeVisible();
  74  |     await expect(page.getByRole("link", { name: "Dispatch" })).toBeVisible();
  75  |     // Staff does not have Forecast, Reports, Users, or Audit Logs
  76  |     await expect(page.getByRole("link", { name: "AI Forecast" })).not.toBeVisible();
  77  |     await expect(page.getByRole("link", { name: "Reports" })).not.toBeVisible();
  78  |   });
  79  | 
  80  |   test("Viewer can sign in successfully and has read-only access", async ({ page }) => {
  81  |     await page.goto("/login");
  82  |     await page.getByRole("button", { name: /Viewer/i }).click();
  83  |     await page.getByRole("button", { name: "Sign in" }).click();
  84  | 
  85  |     await expect(page).toHaveURL(/.*\/dashboard/);
  86  |     await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  87  |     await expect(page.getByRole("link", { name: "AI Forecast" })).toBeVisible();
  88  |     await expect(page.getByRole("link", { name: "Reports" })).toBeVisible();
  89  |     // Viewer does not have Users or Audit Logs
  90  |     await expect(page.getByRole("link", { name: "Users" })).not.toBeVisible();
  91  |   });
  92  | });
  93  | 
  94  | test.describe("Authentication - Invalid Cases and Normalization", () => {
  95  |   test.beforeEach(async ({ page }) => {
  96  |     await page.goto("/login");
  97  |   });
  98  | 
  99  |   test("shows error message for wrong password", async ({ page }) => {
  100 |     await page.locator("#email").fill("admin@nexuswms.io");
  101 |     await page.locator("#password").fill("WrongPassword123!");
  102 |     await page.getByRole("button", { name: "Sign in" }).click();
  103 | 
  104 |     const alert = page.locator("form p[role='alert']");
  105 |     await expect(alert).toBeVisible();
  106 |     await expect(alert).toHaveText(/Invalid credentials/i);
  107 |     await expect(page).toHaveURL(/.*\/login/);
  108 |   });
  109 | 
  110 |   test("shows error message for non-existent email", async ({ page }) => {
  111 |     await page.locator("#email").fill("nonexistent@nexuswms.io");
  112 |     await page.locator("#password").fill(PASSWORD);
  113 |     await page.getByRole("button", { name: "Sign in" }).click();
  114 | 
  115 |     const alert = page.locator("form p[role='alert']");
  116 |     await expect(alert).toBeVisible();
  117 |     await expect(alert).toHaveText(/Invalid credentials/i);
  118 |   });
  119 | 
  120 |   test("handles email with whitespace and mixed casing correctly", async ({ page }) => {
  121 |     await page.locator("#email").fill("   Admin@NexusWMS.io   ");
  122 |     await page.locator("#password").fill(PASSWORD);
  123 |     await page.getByRole("button", { name: "Sign in" }).click();
  124 | 
  125 |     await expect(page).toHaveURL(/.*\/dashboard/);
  126 |   });
  127 | 
  128 |   test("validates required inputs before submitting", async ({ page }) => {
  129 |     // Attempt submit with empty fields
  130 |     await page.getByRole("button", { name: "Sign in" }).click();
  131 |     await expect(page).toHaveURL(/.*\/login/);
  132 |   });
  133 | });
  134 | 
  135 | test.describe("Session Management & RBAC Enforcement", () => {
  136 |   test("persists session across page refresh and navigation", async ({ page }) => {
  137 |     await page.goto("/login");
  138 |     await page.getByRole("button", { name: /Admin/i }).click();
  139 |     await page.getByRole("button", { name: "Sign in" }).click();
  140 |     await expect(page).toHaveURL(/.*\/dashboard/);
  141 | 
  142 |     // Refresh page
  143 |     await page.reload();
  144 |     await expect(page).toHaveURL(/.*\/dashboard/);
  145 |     await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  146 | 
```