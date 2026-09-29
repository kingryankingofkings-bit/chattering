import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      APP_ENCRYPTION_KEYS: "v1:" + Buffer.alloc(32, 1).toString("base64") + ",v2:" + Buffer.alloc(32, 2).toString("base64"),
      APP_ENCRYPTION_ACTIVE_KEY: "v2",
      SESSION_SECRET: "test-secret-test-secret-test-secret",
      DATABASE_URL: "file:../data/test.db",
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
