import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const portalRoutes = [
  "/login",
  "/signup",
  "/account",
  "/admin",
  "/admin-preview",
  "/privacy",
  "/terms",
  "/refunds",
];

export default defineConfig({
  base: "/",

  plugins: [
    react(),
    {
      name: "portal-routes",

      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const url = new URL(
            req.url || "/",
            "http://localhost"
          );

          if (portalRoutes.includes(url.pathname)) {
            req.url = "/portal.html" + url.search;
          }

          next();
        });
      },
    },
  ],

  server: {
    proxy: {
      "/api": "http://127.0.0.1:8140",
      "/assets": "http://127.0.0.1:8140",
    },
  },

  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 800,

    rollupOptions: {
      input: {
        world: "index.html",
        portal: "portal.html",
      },

      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three/")) {
            return "three";
          }
        },
      },
    },
  },
});