import { defineConfig } from "vitest/config";

export default defineConfig({
  // Only the playground's own tests: .eucalypt/ holds a eucalypt checkout
  // with test files of its own.
  test: { include: ["tests/**/*.test.ts"] },
});
