import { loadEnv } from "vite";
import { authMiddleware } from "./http.js";

function applyEnv(mode) {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] == null) process.env[key] = value;
  }
  if (!process.env.NODE_ENV) process.env.NODE_ENV = mode === "production" ? "production" : "development";
}

export function authApi() {
  return {
    name: "duck-auth",
    configureServer(server) {
      applyEnv(server.config.mode);
      server.middlewares.use(authMiddleware);
    },
    configurePreviewServer(server) {
      applyEnv("production");
      server.middlewares.use(authMiddleware);
    },
  };
}
