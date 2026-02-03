import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/ezcrop/",
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ["@jsquash/avif"],
  },
  worker: {
    format: "es",
  },
});
