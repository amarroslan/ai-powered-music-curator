import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Same-origin API calls in dev; the API runs on :4000
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
