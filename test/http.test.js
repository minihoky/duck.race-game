import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

// Set TEST_DATABASE_URL to run the same flow against an empty PostgreSQL database.
const dataDir = mkdtempSync(path.join(tmpdir(), "animal-race-test-"));
Object.assign(process.env, {
  NODE_ENV: "development",
  DATA_DIR: dataDir,
  DATABASE_URL: process.env.TEST_DATABASE_URL || "",
  DATABASE_SSL: "",
  PAYMENT_GATEWAY: "demo",
  PAYMENT_WEBHOOK_SECRET: "",
  ADMIN_EMAILS: "admin@example.com",
  SERVE_STATIC: "false",
  PUBLIC_APP_URL: "",
  SMTP_HOST: "",
  TRUST_PROXY: "",
});

const { start } = await import("../server/index.js");
const { closeStore } = await import("../server/accounts.js");
const { verifyRace } = await import("../src/lib/fairness.js");

let server;
let base;

before(async () => {
  server = await start(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closeStore();
  rmSync(dataDir, { recursive: true, force: true });
});

function client(lang = "en") {
  let cookie = "";
  return async function call(pathName, { method = "GET", body } = {}) {
    const headers = { "X-Lang": lang };
    if (cookie) headers.Cookie = cookie;
    if (body) headers["Content-Type"] = "application/json";
    const response = await fetch(base + pathName, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  };
}

async function signUp(call, name, email) {
  const created = await call("/api/auth/register", { method: "POST", body: { name, email, password: "senha1234" } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const token = new URL(created.data.previewUrl).searchParams.get("token");
  assert.equal((await call("/api/auth/verify", { method: "POST", body: { token } })).status, 200);
  const login = await call("/api/auth/login", { method: "POST", body: { email, password: "senha1234" } });
  assert.equal(login.status, 200);
  return login.data.user;
}

const organizer = client("en");
const admin = client("pt");
let organizerUser;
let raceId;

test("health check", async () => {
  const { status, data } = await organizer("/api/health");
  assert.equal(status, 200);
  assert.equal(data.ok, true);
});

test("errors are translated to Portuguese", async () => {
  const { status, data } = await client("pt")("/api/auth/login", { method: "POST", body: { email: "nobody@example.com", password: "x" } });
  assert.equal(status, 401);
  assert.match(data.error, /[ãéçõ]|senha|e-mail/i);
});

test("sign up, verify and sign in", async () => {
  organizerUser = await signUp(organizer, "Organizadora", "org@example.com");
  assert.equal(organizerUser.credits, 0);
  assert.equal(organizerUser.status, "active");
});

test("buying credits adds them once", async () => {
  const packages = await organizer("/api/credits/packages");
  assert.equal(packages.data.gateway, "demo");
  const pack = packages.data.packages[0];
  assert.equal(pack.currency, "BRL");
  const checkout = await organizer("/api/credits/checkout", { method: "POST", body: { packageId: pack.id } });
  assert.equal(checkout.status, 201, JSON.stringify(checkout.data));
  const paymentId = checkout.data.payment.id;
  const paid = await organizer("/api/credits/confirm", { method: "POST", body: { paymentId } });
  assert.equal(paid.data.user.credits, pack.credits);
  const again = await organizer("/api/credits/confirm", { method: "POST", body: { paymentId } });
  assert.equal(again.data.user.credits, pack.credits);
  const account = await organizer("/api/account");
  assert.equal(account.data.payments.length, 1);
  assert.equal(account.data.payments[0].status, "paid");
  assert.equal(account.data.ledger.filter((entry) => entry.type === "topup").length, 1);
});

test("creating a race is free and starting uses one credit", async () => {
  const before = (await organizer("/api/account")).data.user.credits;
  const created = await organizer("/api/races", { method: "POST", body: { name: "Sorteio", names: ["Ana", "Bruno", "Carla"], durationSec: 10, animal: "fish" } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  raceId = created.data.race.id;
  assert.equal(created.data.race.algorithm, "race-v4");
  assert.equal(created.data.user.credits, before);

  const preview = await organizer(`/api/verify/${raceId}`);
  assert.equal(preview.data.race.fairness.serverSeed, "");
  assert.equal(preview.data.race.fairness.paramsHash.length, 64);

  const started = await organizer(`/api/races/${raceId}/start`, { method: "POST", body: { clientSeed: "test-seed" } });
  assert.equal(started.status, 200, JSON.stringify(started.data));
  assert.equal(started.data.charged, true);
  assert.equal(started.data.user.credits, before - 1);

  const repeat = await organizer(`/api/races/${raceId}/start`, { method: "POST", body: { clientSeed: "other" } });
  assert.equal(repeat.data.charged, false);
  assert.equal(repeat.data.user.credits, before - 1);

  const running = await organizer(`/api/verify/${raceId}`);
  assert.equal(running.data.race.fairness.clientSeed, "test-seed");
  assert.equal(running.data.race.fairness.serverSeed, "", "the seed stays hidden while racing");
});

test("administrators manage accounts", async () => {
  assert.equal((await organizer("/api/admin/overview")).status, 403);
  await signUp(admin, "Admin", "admin@example.com");
  const overview = await admin("/api/admin/overview");
  assert.equal(overview.status, 200);
  assert.equal(overview.data.audit.ok, true);

  const users = await admin("/api/admin/users?q=org@");
  assert.equal(users.data.total, 1);
  const target = users.data.items[0].id;

  const adjusted = await admin("/api/admin/credits", { method: "POST", body: { userId: target, credits: 5, note: "Cortesia" } });
  assert.equal(adjusted.status, 200);
  const detail = await admin(`/api/admin/users/${target}`);
  assert.ok(detail.data.ledger.some((entry) => entry.type === "adjust" && entry.credits === 5));

  const restricted = await admin(`/api/admin/users/${target}/status`, { method: "POST", body: { status: "restricted", note: "Revisão" } });
  assert.equal(restricted.data.user.status, "restricted");
  const refused = await organizer("/api/races", { method: "POST", body: { names: ["A", "B"], durationSec: 10 } });
  assert.equal(refused.status, 403);

  await admin(`/api/admin/users/${target}/status`, { method: "POST", body: { status: "blocked", note: "Fraude" } });
  assert.equal((await organizer("/api/auth/me")).status, 401);
  const login = await organizer("/api/auth/login", { method: "POST", body: { email: "org@example.com", password: "senha1234" } });
  assert.equal(login.data.code, "blocked");

  await admin(`/api/admin/users/${target}/status`, { method: "POST", body: { status: "active" } });
  assert.equal((await organizer("/api/auth/login", { method: "POST", body: { email: "org@example.com", password: "senha1234" } })).status, 200);
});

test("administrators manage packages and see the race audit", async () => {
  const created = await admin("/api/admin/packages", { method: "POST", body: { name: "Pacote 100", credits: 100, amount: 4900 } });
  assert.equal(created.status, 201);
  const hidden = await admin(`/api/admin/packages/${created.data.package.id}`, { method: "PATCH", body: { active: false } });
  assert.equal(hidden.data.package.active, false);
  const shop = await organizer("/api/credits/packages");
  assert.ok(!shop.data.packages.some((pack) => pack.id === created.data.package.id));

  const race = await admin(`/api/admin/races/${raceId}`);
  assert.equal(race.status, 200);
  assert.equal(race.data.race.creditUsed, true);
  assert.deepEqual(race.data.race.audit.map((entry) => entry.action).slice(0, 2), ["race.created", "race.started"]);
  assert.equal(race.data.chain.ok, true);
});

test("after the finish the seed is revealed and the result verifies", { timeout: 30_000 }, async () => {
  let race;
  for (let i = 0; i < 40; i += 1) {
    race = (await organizer(`/api/verify/${raceId}`)).data.race;
    if (race.status === "finished") break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.equal(race.status, "finished");
  assert.equal(race.fairness.serverSeed.length, 64);
  const checks = await verifyRace(race);
  assert.equal(checks.namesHash, true);
  assert.equal(checks.paramsHash, true);
  assert.equal(checks.seedHash, true);
  assert.equal(checks.order, true);
  assert.equal(checks.audit, true);
  assert.ok(race.audit.some((entry) => entry.action === "race.finished"));
  assert.equal((await admin("/api/admin/audit")).data.chain.ok, true);
});

test("saved data reloads with an intact audit chain", async () => {
  const { openStore } = await import("../server/store.js");
  const { verifyChain } = await import("../server/audit.js");
  const store = await openStore();
  try {
    const state = await store.load();
    const chain = verifyChain(state.audit);
    assert.equal(chain.ok, true);
    assert.ok(chain.length >= 8);
    const race = state.races.find((item) => item.id === raceId);
    assert.equal(race.status, "finished");
    assert.deepEqual(race.entrants.map((entrant) => entrant.name), ["Ana", "Bruno", "Carla"]);
    assert.deepEqual(race.entrants.map((entrant) => entrant.place).sort(), [1, 2, 3]);
    assert.equal(state.ledger.filter((entry) => entry.raceId === raceId && entry.type === "race").length, 1);
  } finally {
    await store.close();
  }
});
