/**
 * Runs before every integration test file - wires TEST_DATABASE_URL into the
 * standard DATABASE_URL slot BEFORE any module under test gets imported.
 */
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "integration-test-secret-key-0123456789";
