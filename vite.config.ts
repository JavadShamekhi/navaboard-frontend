import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy: browser talks to one origin; /api goes to Django (guide section 7).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } } },
});
