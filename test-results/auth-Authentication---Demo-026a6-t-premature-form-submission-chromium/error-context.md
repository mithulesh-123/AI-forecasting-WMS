# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication - Demo Account Buttons >> clicking demo account buttons populates credentials without premature form submission
- Location: tests\e2e\auth.spec.ts:10:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /Admin/i })

```

# Page snapshot

```yaml
- generic:
  - generic [active]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - navigation [ref=e6]:
          - button [disabled] [ref=e7]:
            - img "previous" [ref=e8]
          - generic [ref=e10]:
            - generic [ref=e11]: 1/
            - text: "1"
          - button [disabled] [ref=e12]:
            - img "next" [ref=e13]
        - link "Next.js 15.5.24 (outdated) Webpack" [ref=e16] [cursor=pointer]:
          - /url: https://nextjs.org/docs/messages/version-staleness
          - generic "An outdated version detected (latest is 16.3.4), upgrade is highly recommended!" [ref=e19]: Next.js 15.5.24 (outdated)
          - generic [ref=e20]: Webpack
      - generic [ref=e21]:
        - dialog "Runtime TypeError" [ref=e22]:
          - generic [ref=e25]:
            - generic [ref=e26]:
              - generic [ref=e27]:
                - generic [ref=e28]: Runtime TypeError
                - generic [ref=e30]:
                  - button "Copy Error Info" [ref=e31] [cursor=pointer]
                  - button "No related documentation found" [disabled] [ref=e34]
                  - link "Learn more about enabling Node.js inspector for server code with Chrome DevTools" [ref=e37] [cursor=pointer]:
                    - /url: https://nextjs.org/docs/app/building-your-application/configuring/debugging#server-side-code
              - paragraph [ref=e47]: __webpack_modules__[moduleId] is not a function
            - generic [ref=e50]:
              - paragraph [ref=e51]:
                - text: Call Stack
                - generic [ref=e52]: "15"
              - button "Show 15 ignore-listed frame(s)" [ref=e53] [cursor=pointer]
          - generic [ref=e56]:
            - generic [ref=e57]: "1"
            - generic [ref=e58]: "2"
        - contentinfo [ref=e59]:
          - region "Error feedback" [ref=e60]:
            - paragraph [ref=e61]:
              - link "Was this helpful?" [ref=e62] [cursor=pointer]:
                - /url: https://nextjs.org/telemetry#error-feedback
            - button "Mark as helpful" [ref=e63] [cursor=pointer]
            - button "Mark as not helpful" [ref=e67] [cursor=pointer]
    - generic [ref=e74] [cursor=pointer]:
      - button "Open Next.js Dev Tools" [ref=e75]
      - generic [ref=e79]:
        - button "Open issues overlay" [ref=e80]:
          - generic [ref=e81]:
            - generic [aria-hidden] [ref=e82]: "0"
            - generic [ref=e83]: "1"
          - generic [ref=e84]: Issue
        - button "Collapse issues badge" [ref=e85]
  - alert [ref=e88]
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
> 15  |     await page.getByRole("button", { name: /Admin/i }).click();
      |                                                        ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  46  |     await expect(page).toHaveURL(/.*\/dashboard/);
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
```