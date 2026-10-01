import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { appendAudit } from "./audit.js";
import { emptyState, openStore } from "./store.js";

const scryptAsync = promisify(scrypt);

const VERIFY_MS = 24 * 60 * 60 * 1000;
const RESET_MS = 60 * 60 * 1000;
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;

export const USER_STATUSES = ["active", "restricted", "blocked"];

let store = null;
let state = emptyState();
let readyPromise = null;
let queue = Promise.resolve();
const usedVerify = new Map();

export function ready() {
  if (!readyPromise) {
    readyPromise = (async () => {
      store = await openStore();
      state = ensureCollections(await store.load());
      return store;
    })();
  }
  return readyPromise;
}

export function storeKind() {
  return store ? store.kind : "none";
}

export async function closeStore() {
  if (store) await store.close();
}

function adminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function ensureCollections(data = state) {
  for (const user of data.users) applyRole(user);
  return data;
}

function applyRole(user) {
  if (!user.role) user.role = "user";
  if (!Number.isFinite(user.credits)) user.credits = 0;
  if (!USER_STATUSES.includes(user.status)) user.status = "active";
  if (adminEmails().includes(user.email)) user.role = "admin";
  return user;
}

async function persist() {
  try {
    await store.persist(state);
  } catch (error) {
    // The in-memory copy may now be ahead of the database; reload the last committed state.
    console.error("Saving failed, reloading the last saved state.", error);
    state = ensureCollections(await store.load());
    throw error;
  }
}

function update(fn) {
  const previous = queue;
  const run = ready()
    .then(() => previous)
    .then(fn);
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
  applyRole(user);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    verified: Boolean(user.verified),
    role: user.role,
    credits: user.credits,
    status: user.status,
    statusNote: user.status === "active" ? "" : user.statusNote || "",
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
    if (existing && existing.status === "blocked") return { status: 403, error: "This account is blocked. Contact support." };
    const passwordHash = await hashPassword(password);
    const record = existing || {
      id: randomBytes(12).toString("hex"),
      email,
      createdAt: Date.now(),
      credits: 0,
      role: "user",
      status: "active",
    };
    if (!Number.isFinite(record.credits)) record.credits = 0;
    if (!record.role) record.role = "user";
    record.name = name;
    record.passwordHash = passwordHash;
    record.verified = false;
    record.verifyTokenHash = digest(verify);
    record.verifyExpires = Date.now() + VERIFY_MS;
    record.resetTokenHash = "";
    record.resetExpires = 0;
    if (!existing) {
      state.users.push(record);
      appendAudit(state, { actorId: record.id, action: "user.registered", targetType: "user", targetId: record.id });
    }
    applyRole(record);
    await persist();
    return { status: 201, verifyToken: verify, email };
  });
}

export function verifyAccount(rawToken) {
  return update(async () => {
    const hash = digest(String(rawToken || ""));
    if ((usedVerify.get(hash) || 0) > Date.now()) return { status: 200 };
    const user = state.users.find((item) => item.verifyTokenHash && item.verifyTokenHash === hash);
    if (!user || user.verifyExpires < Date.now()) return { status: 400, error: "This verification link is invalid or has expired." };
    user.verified = true;
    user.verifyTokenHash = "";
    user.verifyExpires = 0;
    usedVerify.set(hash, Date.now() + 10 * 60 * 1000);
    appendAudit(state, { actorId: user.id, action: "user.verified", targetType: "user", targetId: user.id });
    await persist();
    return { status: 200 };
  });
}

export function resendVerification(email) {
  return update(async () => {
    const user = findEmail(email);
    if (!user || user.verified || user.status === "blocked") return { status: 200 };
    const verify = token();
    user.verifyTokenHash = digest(verify);
    user.verifyExpires = Date.now() + VERIFY_MS;
    await persist();
    return { status: 200, verifyToken: verify, email: user.email, name: user.name };
  });
}

export function loginAccount({ email, password }) {
  return update(async () => {
    const user = findEmail(email);
    const matches = user ? await checkPassword(password, user.passwordHash) : false;
    if (!user || !matches) return { status: 401, error: "Email or password is incorrect." };
    applyRole(user);
    if (user.status === "blocked") return { status: 403, error: "This account is blocked. Contact support.", code: "blocked" };
    if (!user.verified) return { status: 403, error: "Verify your email before signing in.", code: "unverified" };
    const session = token();
    state.sessions = state.sessions.filter((item) => item.expires > Date.now() && item.userId !== user.id);
    state.sessions.push({ tokenHash: digest(session), userId: user.id, expires: Date.now() + SESSION_MS });
    await persist();
    return { status: 200, session, user: publicUser(user) };
  });
}

export function logoutAccount(rawToken) {
  return update(async () => {
    const hash = digest(String(rawToken || ""));
    state.sessions = state.sessions.filter((item) => item.tokenHash !== hash);
    await persist();
    return { status: 200 };
  });
}

export function readSession(rawToken) {
  const hash = digest(String(rawToken || ""));
  const session = state.sessions.find((item) => item.tokenHash === hash && item.expires > Date.now());
  if (!session) return null;
  const user = state.users.find((item) => item.id === session.userId && item.verified);
  if (!user) return null;
  applyRole(user);
  if (user.status === "blocked") return null;
  return user;
}

export function currentAccount(rawToken) {
  const user = readSession(rawToken);
  return user ? publicUser(user) : null;
}

export function viewUser(user) {
  return publicUser(user);
}

export function devAdminOpen() {
  return process.env.NODE_ENV !== "production" && adminEmails().length === 0;
}

export function mutate(fn) {
  return update(async () => {
    const result = await fn(state);
    if (!result || result.persist !== false) await persist();
    return result;
  });
}

export function saveImage(id, buf) {
  return ready().then(() => store.saveImage(id, buf));
}

export function readImage(id) {
  return ready().then(() => store.readImage(id));
}

export function requestReset(email) {
  return update(async () => {
    const user = findEmail(email);
    if (!user || user.status === "blocked") return { status: 200 };
    const reset = token();
    user.resetTokenHash = digest(reset);
    user.resetExpires = Date.now() + RESET_MS;
    await persist();
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
    appendAudit(state, { actorId: user.id, action: "user.password_reset", targetType: "user", targetId: user.id });
    await persist();
    return { status: 200 };
  });
}

export const SESSION_MS_PUBLIC = SESSION_MS;
