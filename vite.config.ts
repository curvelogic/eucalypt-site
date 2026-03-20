import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  base: "/eucalypt-playground/",
  plugins: [wasm()],
  build: {
    target: "es2020",
  },
  optimizeDeps: {
    exclude: ["eucalypt"],
  },
  assetsInclude: ["**/*.wasm"],
});
