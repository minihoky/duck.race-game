import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { authApi } from "./server/plugin.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (!env.VITE_SITE_NAME) process.env.VITE_SITE_NAME = "Animal Race";
  return {
    plugins: [react(), tailwindcss(), authApi()],
  };
});
