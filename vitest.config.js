import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/* Separate from vite.config.js so tests don't pull in the PWA plugin. */
export default defineConfig({
  plugins: [react()],
  test: { environment: "node" },
});
