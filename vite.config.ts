import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths, so the build works wherever it is served from: a
  // GitHub Pages project site at /<repo>/, a user site at /, or straight off
  // the filesystem. Absolute paths would 404 on a project site.
  base: "./",
  server: { port: 8000, strictPort: true },
  build: { target: "es2022" },
});
