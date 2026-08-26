import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Integration tests hit a REAL PostgreSQL database.
 * Configure TEST_DATABASE_URL to run them:
 *   TEST_DATABASE_URL="postgresql://...wms_test" npm run test:integration
 * They are skipped automatically when the variable is absent.
 */
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    hookTimeout: 120_000,
    testTimeout: 60_000,
    maxConcurrency: 1,
    sequence: { concurrent: false },
    setupFiles: ["tests/integration/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
