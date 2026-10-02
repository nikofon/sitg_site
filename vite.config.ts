import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "SITG_");
  const target = env.SITG_WEBSITE_API_TARGET ?? "http://127.0.0.1:8080";
  // Same-origin GETs may omit Origin and Referer; preserve Host for backend checks.
  const proxy = {
    "/api": { target, changeOrigin: false },
    "/auth": { target, changeOrigin: false },
  };
  return {
    build: { sourcemap: false, target: "es2022" },
    server: { host: "127.0.0.1", port: 5174, strictPort: true, proxy },
    preview: { host: "127.0.0.1", port: 4174, strictPort: true, proxy },
    test: { environment: "jsdom", include: ["src/**/*.test.ts", "tests/**/*.test.js"], restoreMocks: true },
  };
});
