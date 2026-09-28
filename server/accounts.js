import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const dataDir = path.join(process.cwd(), "server", "data");
const dataFile = path.join(dataDir, "accounts.json");

const VERIFY_MS = 24 * 60 * 60 * 1000;
const RESET_MS = 60 * 60 * 1000;
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;

let queue = Promise.resolve();
let state = load();
const usedVerify = new Map();

function load() {
  try {
    return JSON.parse(readFileSync(dataFile, "utf8"));
  } catch {
    return { users: [], sessions: [] };
  }
}

function persist() {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(dataFile, JSON.stringify(state));
}

function update(fn) {
  const run = queue.then(fn);
  queue = run.then(
    () => {},
    () => {}
  );
  return run;
}

function token() {
  return randomBytes(32).toString("base64url");
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120;
}

export function validPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 72 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function validName(name) {
  const trimmed = String(name || "").trim();
  return trimmed.length >= 1 && trimmed.length <= 40 ? trimmed : "";
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 32)).toString("hex");
  return `${salt}:${hash}`;
}

async function checkPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const actual = await scryptAsync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    verified: user.verified,
  };
}

function findEmail(email) {
  return state.users.find((user) => user.email === email);
}

export function registerAccount({ name, email, password }) {
  return update(async () => {
    const existing = findEmail(email);
    const verify = token();
    if (existing && existing.verified) return { status: 409, error: "An account with this email already exists." };
    const passwordHash = await hashPassword(password);
    const record = existing || {
      id: randomBytes(12).toString("hex"),
      email,
      createdAt: Date.now(),
    };
    record.name = name;
    record.passwordHash = passwordHash;
    record.verified = false;
    record.verifyTokenHash = digest(verify);
    record.verifyExpires = Date.now() + VERIFY_MS;
    record.resetTokenHash = "";
    record.resetExpires = 0;
    if (!existing) state.users.push(record);
    persist();
    return { status: 201, verifyToken: verify, email };
  });
}

export function verifyAccount(rawToken) {
  return update(() => {
    const hash = digest(String(rawToken || ""));
    if ((usedVerify.get(hash) || 0) > Date.now()) return { status: 200 };
    const user = state.users.find((item) => item.verifyTokenHash && item.verifyTokenHash === hash);
    if (!user || user.verifyExpires < Date.now()) return { status: 400, error: "This verification link is invalid or has expired." };
    user.verified = true;
    user.verifyTokenHash = "";
    user.verifyExpires = 0;
    usedVerify.set(hash, Date.now() + 10 * 60 * 1000);
    persist();
    return { status: 200 };
  });
}

export function resendVerification(email) {
  return update(() => {
    const user = findEmail(email);
    if (!user || user.verified) return { status: 200 };
    const verify = token();
    user.verifyTokenHash = digest(verify);
    user.verifyExpires = Date.now() + VERIFY_MS;
    persist();
    return { status: 200, verifyToken: verify, email: user.email, name: user.name };
  });
}

export function loginAccount({ email, password }) {
  return update(async () => {
    const user = findEmail(email);
    const matches = user ? await checkPassword(password, user.passwordHash) : false;
    if (!user || !matches) return { status: 401, error: "Email or password is incorrect." };
    if (!user.verified) return { status: 403, error: "Verify your email before signing in.", code: "unverified" };
    const session = token();
    state.sessions = state.sessions.filter((item) => item.expires > Date.now() && item.userId !== user.id);
    state.sessions.push({ tokenHash: digest(session), userId: user.id, expires: Date.now() + SESSION_MS });
    persist();
    return { status: 200, session, user: publicUser(user) };
  });
}

export function logoutAccount(rawToken) {
  return update(() => {
    const hash = digest(String(rawToken || ""));
    state.sessions = state.sessions.filter((item) => item.tokenHash !== hash);
    persist();
    return { status: 200 };
  });
}

export function currentAccount(rawToken) {
  const hash = digest(String(rawToken || ""));
  const session = state.sessions.find((item) => item.tokenHash === hash && item.expires > Date.now());
  if (!session) return null;
  const user = state.users.find((item) => item.id === session.userId && item.verified);
  return user ? publicUser(user) : null;
}

export function requestReset(email) {
  return update(() => {
    const user = findEmail(email);
    if (!user) return { status: 200 };
    const reset = token();
    user.resetTokenHash = digest(reset);
    user.resetExpires = Date.now() + RESET_MS;
    persist();
    return { status: 200, resetToken: reset, email: user.email, name: user.name };
  });
}

export function resetPassword(rawToken, password) {
  return update(async () => {
    const hash = digest(String(rawToken || ""));
    const user = state.users.find((item) => item.resetTokenHash && item.resetTokenHash === hash);
    if (!user || user.resetExpires < Date.now()) return { status: 400, error: "This reset link is invalid or has expired." };
    user.passwordHash = await hashPassword(password);
    user.resetTokenHash = "";
    user.resetExpires = 0;
    user.verified = true;
    user.verifyTokenHash = "";
    state.sessions = state.sessions.filter((item) => item.userId !== user.id);
    persist();
    return { status: 200 };
  });
}

export const SESSION_MS_PUBLIC = SESSION_MS;
