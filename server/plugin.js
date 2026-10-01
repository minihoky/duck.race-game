import { loadEnv } from "vite";
import { ready } from "./accounts.js";
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
    name: "platform-api",
    async configureServer(server) {
      applyEnv(server.config.mode);
      await ready();
      server.middlewares.use(authMiddleware);
    },
    async configurePreviewServer(server) {
      applyEnv("production");
      await ready();
      server.middlewares.use(authMiddleware);
    },
  };
}
