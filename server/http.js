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
import { canPreviewMail, sendMail } from "./mail.js";
import { handlePlatform } from "./platform.js";

const hits = new Map();

function limited(key) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((time) => now - time < 15 * 60 * 1000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 12;
}

function cookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index < 0) return;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  });
  return out;
}

function origin(req) {
  const forwarded = req.headers["x-forwarded-proto"];
  const proto = forwarded || (req.socket && req.socket.encrypted ? "https" : "http");
  return `${proto}://${req.headers.host}`;
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
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(extraHeaders || {}),
  });
  res.end(payload);
}

function sessionCookie(token, secure) {
  const secureFlag = secure ? "; Secure" : "";
  if (!token) return `dr_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`;
  return `dr_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_MS_PUBLIC / 1000)}${secureFlag}`;
}

async function deliver(req, { to, subject, text, link }) {
  try {
    const result = await sendMail({ to, subject, text });
    if (result.delivered) return {};
    if (canPreviewMail()) return { previewUrl: link };
    return { error: "Email could not be sent. Add SMTP settings and try again." };
  } catch {
    return { error: "Email could not be sent. Try again in a moment." };
  }
}

export function authMiddleware(req, res, next) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth/")) {
    handlePlatform(req, res, url, { send, cookies, origin, readBody, readRaw, limited }).catch((error) => {
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
  if (!url.pathname.startsWith("/api/auth/")) {
    next();
    return;
  }
  handle(req, res, url).catch(() => {
    if (!res.headersSent) send(res, 400, { error: "The request could not be read." });
  });
}

async function handle(req, res, url) {
  const path = url.pathname;
  const secure = origin(req).startsWith("https:");
  const ip = req.socket?.remoteAddress || "local";

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
    if (created.status === 409) {
      send(res, 409, { error: created.error });
      return;
    }
    const link = `${origin(req)}/verify-email?token=${encodeURIComponent(created.verifyToken)}`;
    const mail = await deliver(req, {
      to: email,
      subject: "Verify your Duck Race email",
      link,
      text: `Hi ${name},\n\nConfirm your email to finish creating your Duck Race account:\n${link}\n\nThis link expires in 24 hours.\n`,
    });
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
      const mail = await deliver(req, {
        to: result.email,
        subject: "Verify your Duck Race email",
        link,
        text: `Hi ${result.name},\n\nConfirm your email:\n${link}\n\nThis link expires in 24 hours.\n`,
      });
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
      const mail = await deliver(req, {
        to: result.email,
        subject: "Reset your Duck Race password",
        link,
        text: `Hi ${result.name},\n\nChoose a new password:\n${link}\n\nThis link expires in 1 hour. If you did not ask for a reset, you can ignore this email.\n`,
      });
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
