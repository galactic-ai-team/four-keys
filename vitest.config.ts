import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
 
// Matches the scaffold's tsconfig path alias ("@/*" -> "./*").
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Fake secret so HMAC code paths can run in tests. Never a real value.
    env: { FOURKEYS_SECRET: "test-only-secret-not-for-production" },
    restoreMocks: true,
  },
});
