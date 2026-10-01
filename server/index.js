import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { closeStore, ready, storeKind } from "./accounts.js";
import { authMiddleware } from "./http.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (existsSync(path.join(root, ".env")) && typeof process.loadEnvFile === "function") process.loadEnvFile(path.join(root, ".env"));
if (!process.env.NODE_ENV) process.env.NODE_ENV = "production";

const distDir = path.resolve(process.env.STATIC_DIR || path.join(root, "dist"));
const serveStatic = process.env.SERVE_STATIC !== "false" && existsSync(path.join(distDir, "index.html"));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};
const COMPRESSIBLE = new Set([".html", ".js", ".css", ".json", ".svg", ".txt", ".xml", ".webmanifest"]);
const cache = new Map();

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function staticFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const file = path.resolve(distDir, `.${decoded}`);
  if (!file.startsWith(distDir + path.sep)) return null;
  try {
    if (statSync(file).isFile()) return file;
  } catch {
    return null;
  }
  return null;
}

function load(file) {
  if (cache.has(file)) return cache.get(file);
  const body = readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  const entry = { body, gzip: COMPRESSIBLE.has(ext) && body.length > 1024 ? gzipSync(body) : null, type: TYPES[ext] || "application/octet-stream" };
  cache.set(file, entry);
  return entry;
}

function sendStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, SECURITY_HEADERS);
    res.end();
    return;
  }
  let file = staticFile(url.pathname);
  let fallback = false;
  if (!file) {
    if (path.extname(url.pathname)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
      res.end("Not found");
      return;
    }
    file = path.join(distDir, "index.html");
    fallback = true;
  }
  const entry = load(file);
  const immutable = url.pathname.startsWith("/assets/");
  const headers = {
    "Content-Type": entry.type,
    "Cache-Control": immutable ? "public, max-age=31536000, immutable" : fallback || file.endsWith(".html") ? "no-cache" : "public, max-age=3600",
    Vary: "Accept-Encoding",
    ...SECURITY_HEADERS,
  };
  const useGzip = entry.gzip && /\bgzip\b/.test(String(req.headers["accept-encoding"] || ""));
  if (useGzip) headers["Content-Encoding"] = "gzip";
  const body = useGzip ? entry.gzip : entry.body;
  headers["Content-Length"] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === "HEAD" ? undefined : body);
}

function notFound(req, res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
  res.end("Not found");
}

export async function start(port = Number(process.env.PORT || 3000)) {
  await ready();
  const server = createServer((req, res) => {
    authMiddleware(req, res, () => (serveStatic ? sendStatic(req, res) : notFound(req, res)));
  });
  await new Promise((resolve) => server.listen(port, resolve));
  const address = server.address();
  console.log(`Server listening on port ${address.port} (storage: ${storeKind()}, static: ${serveStatic ? distDir : "off"})`);
  return server;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  start().then((server) => {
    const stop = () => {
      server.close(() => closeStore().finally(() => process.exit(0)));
      setTimeout(() => process.exit(0), 5000).unref();
    };
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
