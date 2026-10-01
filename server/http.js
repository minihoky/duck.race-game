import {
  currentAccount,
  loginAccount,
  logoutAccount,
  normalizeEmail,
  registerAccount,
  requestReset,
  resendVerification,
  resetPassword,
  validEmail,
  validName,
  validPassword,
  verifyAccount,
  SESSION_MS_PUBLIC,
} from "./accounts.js";
import { langOf, mailText, translate } from "./i18n.js";
import { canPreviewMail, sendMail } from "./mail.js";
import { handlePlatform } from "./platform.js";

const hits = new Map();

function limited(key, max = 12) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((time) => now - time < 15 * 60 * 1000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 20_000) {
    for (const [name, times] of hits) if (!times.length || now - times[times.length - 1] > 15 * 60 * 1000) hits.delete(name);
  }
  return recent.length > max;
}

function trustProxy() {
  return String(process.env.TRUST_PROXY || "").trim() === "true";
}

function clientIp(req) {
  if (trustProxy()) {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket?.remoteAddress || "local";
}

function cookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index < 0) return;
    try {
      out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      out[part.slice(0, index).trim()] = "";
    }
  });
  return out;
}

function origin(req) {
  const configured = String(process.env.PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const forwarded = trustProxy() ? String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() : "";
  const proto = forwarded || (req.socket && req.socket.encrypted ? "https" : "http");
  const host = (trustProxy() && req.headers["x-forwarded-host"]) || req.headers.host;
  return `${proto}://${host}`;
}

function readRaw(req, limit = 20_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function readBody(req, limit = 20_000) {
  return readRaw(req, limit).then((raw) => {
    if (!raw.length) return {};
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      throw new Error("Invalid JSON");
    }
  });
}

function send(res, status, body, extraHeaders) {
  const localized = body && typeof body.error === "string" ? { ...body, error: translate(res.lang, body.error) } : body;
  const payload = JSON.stringify(localized);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(extraHeaders || {}),
  });
  res.end(payload);
}

function sessionCookie(token, secure) {
  const secureFlag = secure ? "; Secure" : "";
  if (!token) return `dr_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`;
  return `dr_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_MS_PUBLIC / 1000)}${secureFlag}`;
}

async function deliver({ to, subject, text, link }) {
  try {
    const result = await sendMail({ to, subject, text });
    if (result.delivered) return {};
    if (canPreviewMail()) return { previewUrl: link };
    return { error: "Email could not be sent. Add SMTP settings and try again." };
  } catch (error) {
    console.error(error);
    return { error: "Email could not be sent. Try again in a moment." };
  }
}

export function authMiddleware(req, res, next) {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/")) {
    next();
    return;
  }
  res.lang = langOf(req);
  if (!url.pathname.startsWith("/api/auth/")) {
    handlePlatform(req, res, url, { send, cookies, origin, readBody, readRaw, limited, ip: clientIp(req) }).catch((error) => {
      if (res.headersSent) return;
      if (error.message === "Body too large") {
        send(res, 413, { error: "That upload is too large." });
        return;
      }
      if (error.message === "Invalid JSON") {
        send(res, 400, { error: "The request could not be read." });
        return;
      }
      console.error(error);
      send(res, 500, { error: "The request could not be completed." });
    });
    return;
  }
  handle(req, res, url).catch((error) => {
    if (res.headersSent) return;
    if (error.message === "Invalid JSON" || error.message === "Body too large") {
      send(res, 400, { error: "The request could not be read." });
      return;
    }
    console.error(error);
    send(res, 500, { error: "The request could not be completed." });
  });
}

async function handle(req, res, url) {
  const path = url.pathname;
  const secure = origin(req).startsWith("https:");
  const ip = clientIp(req);
  const lang = res.lang;

  if (req.method === "GET" && path === "/api/auth/me") {
    const user = currentAccount(cookies(req).dr_session);
    if (!user) {
      send(res, 401, { user: null });
      return;
    }
    send(res, 200, { user });
    return;
  }

  if (req.method !== "POST") {
    send(res, 405, { error: "Method not allowed." });
    return;
  }

  if (limited(`${ip}:${path}`)) {
    send(res, 429, { error: "Too many attempts. Wait a few minutes and try again." });
    return;
  }

  const body = await readBody(req);

  if (path === "/api/auth/register") {
    const name = validName(body.name);
    const email = normalizeEmail(body.email);
    if (!name) {
      send(res, 400, { error: "Enter your name." });
      return;
    }
    if (!validEmail(email)) {
      send(res, 400, { error: "Enter a valid email address." });
      return;
    }
    if (!validPassword(body.password)) {
      send(res, 400, { error: "Use 8 to 72 characters with at least one letter and one number." });
      return;
    }
    const created = await registerAccount({ name, email, password: body.password });
    if (created.error) {
      send(res, created.status, { error: created.error });
      return;
    }
    const link = `${origin(req)}/verify-email?token=${encodeURIComponent(created.verifyToken)}`;
    const mail = await deliver({ to: email, subject: mailText(lang, "verifySubject"), link, text: mailText(lang, "verifyText", name, link) });
    if (mail.error) {
      send(res, 502, { error: mail.error });
      return;
    }
    send(res, 201, { ok: true, email, ...mail });
    return;
  }

  if (path === "/api/auth/resend") {
    const email = normalizeEmail(body.email);
    const result = await resendVerification(email);
    if (result.verifyToken) {
      const link = `${origin(req)}/verify-email?token=${encodeURIComponent(result.verifyToken)}`;
      const mail = await deliver({ to: result.email, subject: mailText(lang, "verifySubject"), link, text: mailText(lang, "resendText", result.name, link) });
      if (mail.error) {
        send(res, 502, { error: mail.error });
        return;
      }
      send(res, 200, { ok: true, ...mail });
      return;
    }
    send(res, 200, { ok: true });
    return;
  }

  if (path === "/api/auth/verify") {
    const token = body.token || url.searchParams.get("token");
    const result = await verifyAccount(token);
    if (result.error) {
      send(res, result.status, { error: result.error });
      return;
    }
    send(res, 200, { ok: true });
    return;
  }

  if (path === "/api/auth/login") {
    const email = normalizeEmail(body.email);
    const result = await loginAccount({ email, password: String(body.password || "") });
    if (result.error) {
      send(res, result.status, { error: result.error, code: result.code });
      return;
    }
    send(res, 200, { user: result.user }, { "Set-Cookie": sessionCookie(result.session, secure) });
    return;
  }

  if (path === "/api/auth/logout") {
    await logoutAccount(cookies(req).dr_session);
    send(res, 200, { ok: true }, { "Set-Cookie": sessionCookie("", secure) });
    return;
  }

  if (path === "/api/auth/forgot") {
    const email = normalizeEmail(body.email);
    if (!validEmail(email)) {
      send(res, 400, { error: "Enter a valid email address." });
      return;
    }
    const result = await requestReset(email);
    if (result.resetToken) {
      const link = `${origin(req)}/reset-password?token=${encodeURIComponent(result.resetToken)}`;
      const mail = await deliver({ to: result.email, subject: mailText(lang, "resetSubject"), link, text: mailText(lang, "resetText", result.name, link) });
      if (mail.error) console.error(mail.error);
      send(res, 200, { ok: true, previewUrl: mail.previewUrl });
      return;
    }
    send(res, 200, { ok: true });
    return;
  }

  if (path === "/api/auth/reset") {
    if (!validPassword(body.password)) {
      send(res, 400, { error: "Use 8 to 72 characters with at least one letter and one number." });
      return;
    }
    const result = await resetPassword(body.token, body.password);
    if (result.error) {
      send(res, result.status, { error: result.error });
      return;
    }
    send(res, 200, { ok: true });
    return;
  }

  send(res, 404, { error: "Not found." });
}
