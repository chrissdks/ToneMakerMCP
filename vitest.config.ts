import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "ui/**/*.test.tsx"],
    testTimeout: 15000,
  },
});
