import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { authApi } from "./server/plugin.js";


export default defineConfig({
  plugins: [react(), tailwindcss(), authApi()],
});
