/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "../../package.json"), "utf-8"),
);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:9889",
        changeOrigin: true,
        // Preserve SSE frames (EventSource) through the dev proxy.
        // Without these, Vite's http-proxy middleware buffers the response
        // and EventSource never fires 'message'.
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes, req) => {
            // Only mutate SSE responses so REST responses stay cache-normal.
            const isSse =
              req.url?.includes("/events") ||
              (proxyRes.headers["content-type"] ?? "").includes(
                "text/event-stream",
              );
            if (isSse) {
              proxyRes.headers["cache-control"] = "no-cache";
              proxyRes.headers["x-accel-buffering"] = "no";
              proxyRes.headers["connection"] = "keep-alive";
            }
          });
        },
      },
    },
  },
});
