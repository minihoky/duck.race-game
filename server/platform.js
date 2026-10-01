import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { devAdminOpen, mutate, readSession, viewUser } from "./accounts.js";
import {
  accessToken,
  assessCharge,
  chargeCurrency,
  createPreference,
  fetchMerchantOrder,
  fetchPayment,
  notificationKind,
  signedDataId,
  verifyWebhookSignature,
  webhookSecret,
} from "./mercadopago.js";

const sponsorDir = path.join(process.cwd(), "server", "data", "sponsors");

export const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];

export const PACKAGES = [
  { id: "pack-10", credits: 10, amount: 900, currency: "USD", name: "Starter", detail: "10 official races" },
  { id: "pack-25", credits: 25, amount: 1900, currency: "USD", name: "Event", detail: "25 official races" },
  { id: "pack-50", credits: 50, amount: 2900, currency: "USD", name: "Season", detail: "50 official races" },
];

function gatewayMode() {
  const configured = String(process.env.PAYMENT_GATEWAY || "").trim().toLowerCase();
  if (configured === "demo") return "demo";
  if (configured === "mercadopago") return "mercadopago";
  if (!configured && process.env.NODE_ENV !== "production") return "demo";
  return configured || "unconfigured";
}

function publicPackages() {
  const currency = gatewayMode() === "mercadopago" ? chargeCurrency() : null;
  return PACKAGES.map((pack) => (currency ? { ...pack, currency } : pack));
}

function appOrigin(req, origin) {
  const configured = String(process.env.PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  return origin(req);
}

function id12() {
  return randomBytes(9).toString("base64url");
}

export const RACE_ALGORITHM = "race-v3";
export const LEAD_IN_MS = 3000;
export const ANIMALS = ["rabbit", "frog", "fish", "turtle", "snail"];

function animalOf(race) {
  return ANIMALS.includes(race.animal) ? race.animal : "rabbit";
}

function seedStream(seed, label) {
  let counter = 0;
  let block = Buffer.alloc(0);
  let offset = 0;
  return function nextUint32() {
    if (offset + 4 > block.length) {
      block = createHmac("sha256", String(seed)).update(`${label}:${counter}`).digest();
      counter += 1;
      offset = 0;
    }
    const value = block.readUInt32BE(offset);
    offset += 4;
    return value;
  };
}

function uniformBelow(next, n) {
  const limit = Math.floor(0x100000000 / n) * n;
  let value = next();
  while (value >= limit) value = next();
  return value % n;
}

export function sha256Hex(text) {
  return createHash("sha256").update(String(text), "utf8").digest("hex");
}

export function namesDigest(names) {
  return sha256Hex(names.join("\n"));
}

const CLIENT_SEED = /^[A-Za-z0-9_-]{1,64}$/;

export function orderLabel(race) {
  if (race.algorithm === "race-v3") return `race-v3:order:${race.namesHash}:${race.clientSeed}`;
  return "race-v2:order";
}

export function buildEntrants(names, seed, durationMs, label) {
  const next = seedStream(seed, label);
  const order = names.map((_, lane) => lane);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = uniformBelow(next, i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const tailMs = Math.min(6000, 1200 + names.length * 30, durationMs * 0.3);
  const weights = order.slice(1).map(() => 0.35 + next() / 0x100000000);
  const total = weights.reduce((sum, value) => sum + value, 0) || 1;
  let finishMs = durationMs;
  const rows = order.map((lane, index) => {
    if (index > 0) finishMs += Math.max(16, Math.round((weights[index - 1] / total) * tailMs));
    return { name: names[lane], lane, finishMs, place: index + 1 };
  });
  return rows.sort((a, b) => a.lane - b.lane);
}

function motionSeed(race) {
  return createHmac("sha256", String(race.seed)).update(`${race.algorithm || "race-v1"}:motion`).digest("hex").slice(0, 16);
}

function raceEnd(race) {
  return race.startedAt + race.entrants.reduce((max, entrant) => Math.max(max, entrant.finishMs), 0);
}

function settle(race, now = Date.now()) {
  if (race.status !== "racing" || !race.startedAt) return false;
  if (now < raceEnd(race)) return false;
  race.status = "finished";
  race.finishedAt = raceEnd(race);
  return true;
}

function raceHasRun(race) {
  return race.status === "racing" || race.status === "finished";
}

function fairnessOf(race) {
  if (!race.seedHash) return null;
  const visible = raceHasRun(race);
  return {
    algorithm: race.algorithm,
    seedHash: race.seedHash,
    namesHash: race.namesHash,
    clientSeed: visible ? race.clientSeed : "",
    serverSeed: race.status === "finished" ? race.seed : "",
  };
}

function publicRace(race) {
  const visible = raceHasRun(race);
  return {
    id: race.id,
    name: race.name,
    animal: animalOf(race),
    status: race.status,
    createdAt: race.createdAt || null,
    startedAt: race.startedAt || null,
    finishedAt: race.finishedAt || null,
    names: race.entrants.map((entrant) => entrant.name),
    places: visible ? race.entrants.map(({ lane, place }) => ({ lane, place })) : [],
    algorithm: race.algorithm || "race-v1",
    fairness: fairnessOf(race),
  };
}

function presentRace(race) {
  const visible = raceHasRun(race);
  return {
    id: race.id,
    name: race.name,
    names: race.entrants.map((entrant) => entrant.name),
    entrants: visible ? race.entrants.map(({ name, lane, finishMs, place }) => ({ name, lane, finishMs, place })) : [],
    sponsors: race.sponsors,
    animal: animalOf(race),
    status: race.status,
    startedAt: race.startedAt || null,
    finishedAt: race.finishedAt || null,
    durationMs: race.durationMs,
    leadInMs: race.leadInMs || 0,
    algorithm: race.algorithm || "race-v1",
    motionSeed: visible ? motionSeed(race) : "",
    fairness: fairnessOf(race),
    createdAt: race.createdAt || null,
    serverNow: Date.now(),
  };
}

function summarize(race) {
  const winner = race.entrants.find((entrant) => entrant.place === 1);
  const visible = raceHasRun(race);
  return {
    id: race.id,
    name: race.name,
    names: race.entrants.map((entrant) => entrant.name),
    winner: visible && winner ? winner.name : "",
    animal: animalOf(race),
    status: race.status,
    startedAt: race.startedAt || null,
    finishedAt: race.finishedAt || null,
    createdAt: race.createdAt || null,
    places: visible
      ? [...race.entrants]
          .sort((a, b) => a.place - b.place)
          .map((entrant) => ({ place: entrant.place, name: entrant.name }))
      : [],
  };
}

const CREDIT_ERROR = "You need 1 credit to start an official race. Credits stay in Duck Race and cannot be transferred or refunded for cash.";

export function applyRaceStart(user, race, now = Date.now()) {
  if (race.status === "finished" || race.status === "racing") return { charged: false };
  if (race.status !== "ready") return { status: 409, error: "This race cannot be started." };
  if (race.creditUsed) {
    race.status = "racing";
    if (!race.startedAt) race.startedAt = now;
    return { charged: false };
  }
  if ((user.credits || 0) < 1) return { status: 402, error: CREDIT_ERROR };
  user.credits -= 1;
  race.creditUsed = true;
  race.status = "racing";
  race.startedAt = now;
  return { charged: true };
}

function ledgerView(entry) {
  const labels = { topup: "Credit purchase", race: "Official race", adjust: "Balance adjustment" };
  return {
    id: entry.id,
    type: entry.type,
    credits: entry.credits,
    balance: entry.balance,
    note: entry.note || "",
    raceId: entry.raceId || "",
    paymentId: entry.paymentId || "",
    createdAt: entry.createdAt,
    label: labels[entry.type] || "Credit activity",
  };
}

function paymentView(payment) {
  return {
    id: payment.id,
    packageId: payment.packageId,
    packageName: payment.packageName,
    credits: payment.credits,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    demo: payment.gateway === "demo",
    gateway: payment.gateway,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt || null,
    checkoutUrl: payment.status === "pending" ? payment.checkoutUrl || "" : "",
    gatewayStatus: payment.gatewayStatus || "",
  };
}

function applyRemoteCharge(state, remote) {
  const local = state.payments.find((item) => item.id === String(remote.external_reference || ""));
  if (!local || local.gateway !== "mercadopago") return false;
  const decision = assessCharge(local, remote);
  if (decision.action === "ignore") return false;
  if (decision.action === "reject") {
    if (local.status === "paid" || local.gatewayStatus === "amount_mismatch") return false;
    local.gatewayStatus = "amount_mismatch";
    console.error(`Mercado Pago payment ${remote.id} did not match checkout ${local.id}.`);
    return true;
  }
  if (decision.action === "grant") {
    const prior = state.payments.find((item) => item.gatewayRef === decision.mpId && item.id !== local.id && item.status === "paid");
    if (prior) return false;
    if (local.status === "paid") {
      if (local.gatewayStatus === "approved") return false;
      local.gatewayStatus = "approved";
      return true;
    }
    if (!grantPayment(state, local, decision.mpId)) return false;
    local.gatewayStatus = "approved";
    return true;
  }
  if (decision.action === "fail" && local.status === "pending") {
    local.status = "failed";
    local.gatewayRef = decision.mpId;
    local.gatewayStatus = decision.status;
    return true;
  }
  if (local.status === "paid") return false;
  let changed = false;
  if (decision.mpId && local.status !== "paid" && local.gatewayRef !== decision.mpId) {
    local.gatewayRef = decision.mpId;
    changed = true;
  }
  if (local.gatewayStatus !== decision.status) {
    local.gatewayStatus = decision.status;
    changed = true;
  }
  return changed;
}

function sponsorView(sponsor) {
  return { id: sponsor.id, name: sponsor.name, createdAt: sponsor.createdAt };
}

function ownRace(state, user, raceId) {
  const race = state.races.find((item) => item.id === raceId);
  if (!race) return null;
  if (race.userId !== user.id && user.role !== "admin") return null;
  return race;
}

function grantPayment(state, payment, gatewayRef) {
  if (payment.status === "paid") return false;
  const user = state.users.find((item) => item.id === payment.userId);
  if (!user) return false;
  payment.status = "paid";
  payment.paidAt = Date.now();
  payment.gatewayRef = gatewayRef || payment.gatewayRef || "";
  user.credits += payment.credits;
  state.ledger.push({
    id: id12(),
    userId: user.id,
    type: "topup",
    credits: payment.credits,
    balance: user.credits,
    note: payment.packageName,
    paymentId: payment.id,
    createdAt: Date.now(),
  });
  return true;
}

function cleanNameList(value) {
  if (!Array.isArray(value)) return { error: "Add one name per line." };
  const names = value.map((item) => String(item || "").trim()).filter(Boolean);
  if (names.length < 2) return { error: "Add at least two names." };
  if (names.length > 200) return { error: "An official race can include up to 200 names." };
  if (names.some((name) => name.length > 40)) return { error: "Each name can be at most 40 characters." };
  return { names };
}

function pngSize(buf) {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function reply(res, send, result) {
  const status = result.status || 200;
  const body = { ...result };
  delete body.status;
  delete body.persist;
  send(res, status, body);
}

function requireUser(req, cookies) {
  return readSession(cookies(req).dr_session);
}

function parseNotice(raw) {
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    return {};
  }
}

function isMercadoPagoNotice(req, url, body) {
  if (req.headers["x-signature"]) return true;
  const kind = notificationKind(url, body);
  return kind === "payment" || kind === "merchant_order" || Boolean(url.searchParams.get("data.id"));
}

async function mercadoPagoPaymentIds(token, url, body) {
  const dataId = signedDataId(url, body);
  if (!dataId) return [];
  if (notificationKind(url, body) === "merchant_order") {
    const order = await fetchMerchantOrder(token, dataId);
    return (Array.isArray(order.payments) ? order.payments : []).map((item) => item.id).filter((id) => id != null).map(String);
  }
  return [String(dataId)];
}

async function settleMercadoPagoIds(ids) {
  const token = accessToken();
  const remotes = [];
  for (const id of ids) remotes.push(await fetchPayment(token, id));
  return mutate((state) => {
    let changed = false;
    for (const remote of remotes) {
      if (applyRemoteCharge(state, remote)) changed = true;
    }
    return { status: 200, persist: changed, ok: true };
  });
}

export async function handlePlatform(req, res, url, ctx) {
  const pathName = url.pathname;
  const { send, cookies, origin, readBody, readRaw, limited } = ctx;
  const ip = req.socket?.remoteAddress || "local";

  if (req.method === "GET" && pathName === "/api/credits/packages") {
    send(res, 200, { packages: publicPackages(), gateway: gatewayMode() });
    return;
  }

  if (req.method === "POST" && pathName === "/api/credits/webhook") {
    const raw = await readRaw(req, 20_000);
    const notice = parseNotice(raw);
    if (isMercadoPagoNotice(req, url, notice)) {
      const token = accessToken();
      if (!token) {
        send(res, 503, { error: "Mercado Pago is not configured." });
        return;
      }
      const secret = webhookSecret();
      const dataId = signedDataId(url, notice);
      const check = verifyWebhookSignature({
        secret,
        signatureHeader: req.headers["x-signature"],
        requestId: String(req.headers["x-request-id"] || ""),
        dataId,
      });
      if (!check.ok) {
        send(res, 401, { error: check.error });
        return;
      }
      try {
        const ids = await mercadoPagoPaymentIds(token, url, notice);
        if (!ids.length) {
          send(res, 200, { ok: true });
          return;
        }
        const result = await settleMercadoPagoIds(ids);
        reply(res, send, result);
      } catch (error) {
        console.error(error);
        send(res, 502, { error: "Mercado Pago could not be confirmed." });
      }
      return;
    }
    const secret = process.env.PAYMENT_WEBHOOK_SECRET || "";
    const header = String(req.headers["x-duck-signature"] || "");
    if (!secret || !header) {
      send(res, 401, { error: "The payment webhook signature is missing." });
      return;
    }
    const expected = createHmac("sha256", secret).update(raw).digest();
    const actual = Buffer.from(header, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      send(res, 401, { error: "The payment webhook signature is invalid." });
      return;
    }
    let body = {};
    try {
      body = JSON.parse(raw.toString("utf8"));
    } catch {
      send(res, 400, { error: "The request could not be read." });
      return;
    }
    const result = await mutate((state) => {
      const payment = state.payments.find((item) => item.id === body.paymentId);
      if (!payment) return { status: 404, persist: false, error: "That payment was not found." };
      if (payment.gateway === "mercadopago") {
        return { status: 400, persist: false, error: "This payment is confirmed by Mercado Pago." };
      }
      if (body.status === "paid") {
        grantPayment(state, payment, String(body.gatewayRef || ""));
        return { status: 200, ok: true };
      }
      if (body.status === "failed" && payment.status === "pending") {
        payment.status = "failed";
        return { status: 200, ok: true };
      }
      if (payment.status === "paid" && body.status === "paid") return { status: 200, ok: true };
      return { status: 400, persist: false, error: "That payment status is not recognized." };
    });
    reply(res, send, result);
    return;
  }

  const verifyMatch = pathName.match(/^\/api\/verify\/([A-Za-z0-9_-]{8,32})$/);
  if (req.method === "GET" && verifyMatch) {
    if (limited(`${ip}:verify:${verifyMatch[1]}`)) {
      send(res, 429, { error: "Too many attempts. Wait a few minutes and try again." });
      return;
    }
    const result = await mutate((state) => {
      const race = state.races.find((item) => item.id === verifyMatch[1]);
      if (!race) return { status: 404, persist: false, error: "That result ID was not found." };
      const changed = settle(race);
      return { status: 200, persist: changed, race: publicRace(race) };
    });
    reply(res, send, result);
    return;
  }

  const user = requireUser(req, cookies);

  if (req.method === "GET" && pathName === "/api/account") {
    if (!user) {
      send(res, 401, { user: null });
      return;
    }
    const result = await mutate((state) => {
      let changed = false;
      for (const race of state.races) {
        if (race.userId === user.id && settle(race)) changed = true;
      }
      const active = state.races.find((race) => race.userId === user.id && race.status === "racing");
      const ledger = state.ledger.filter((entry) => entry.userId === user.id).slice(-50).reverse();
      const sponsors = state.sponsors.filter((sponsor) => sponsor.userId === user.id && sponsor.active !== false);
      return {
        status: 200,
        persist: changed,
        user: viewUser(user),
        ledger: ledger.map(ledgerView),
        sponsors: sponsors.map(sponsorView),
        activeRace: active ? summarize(active) : null,
        devAdminAvailable: devAdminOpen() && user.role !== "admin",
      };
    });
    reply(res, send, result);
    return;
  }

  if (!user && req.method === "GET" && /^\/api\/sponsors\/[a-f0-9]{24}\/image$/.test(pathName)) {
    send(res, 401, { error: "Sign in to view this sponsor image." });
    return;
  }

  if (!user) {
    send(res, 401, { error: "Sign in to continue." });
    return;
  }

  if (req.method === "POST" && pathName === "/api/account/dev-admin") {
    await readBody(req);
    const result = await mutate(() => {
      if (!devAdminOpen()) return { status: 403, persist: false, error: "Administrator access is assigned with ADMIN_EMAILS." };
      user.role = "admin";
      return { status: 200, user: viewUser(user) };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "GET" && pathName === "/api/races/active") {
    const result = await mutate((state) => {
      let changed = false;
      for (const race of state.races) {
        if (race.userId === user.id && settle(race)) changed = true;
      }
      const active = state.races.find((race) => race.userId === user.id && race.status === "racing");
      return { status: 200, persist: changed, race: active ? presentRace(active) : null };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "GET" && pathName === "/api/races") {
    const result = await mutate((state) => {
      let changed = false;
      const races = state.races.filter((race) => race.userId === user.id);
      for (const race of races) {
        if (settle(race)) changed = true;
      }
      const history = races
        .slice()
        .sort((a, b) => (b.startedAt || b.createdAt || 0) - (a.startedAt || a.createdAt || 0))
        .map(summarize);
      return { status: 200, persist: changed, races: history };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "POST" && pathName === "/api/races") {
    if (limited(`${ip}:race-setup`)) {
      send(res, 429, { error: "Too many attempts. Wait a few minutes and try again." });
      return;
    }
    const body = await readBody(req);
    const result = await mutate((state) => {
      let changed = false;
      for (const race of state.races) {
        if (race.userId === user.id && settle(race)) changed = true;
      }
      const list = cleanNameList(body.names);
      if (list.error) return { status: 400, persist: changed, error: list.error };
      const durationSec = Number(body.durationSec);
      if (!DURATIONS.includes(durationSec)) return { status: 400, persist: changed, error: "Choose a race length from the list." };
      const title = String(body.name || "").trim() || "Official race";
      if (title.length > 60) return { status: 400, persist: changed, error: "The race name can be at most 60 characters." };
      const requested = Array.isArray(body.sponsorIds) ? body.sponsorIds.map(String) : [];
      if (requested.length > 8) return { status: 400, persist: changed, error: "Choose up to 8 sponsor images." };
      const sponsors = [];
      for (const sponsorId of requested) {
        const sponsor = state.sponsors.find((item) => item.id === sponsorId && item.userId === user.id && item.active !== false);
        if (sponsor && !sponsors.some((item) => item.id === sponsor.id)) sponsors.push({ id: sponsor.id, name: sponsor.name });
      }
      const animal = ANIMALS.includes(body.animal) ? body.animal : "rabbit";
      const seed = randomBytes(32).toString("hex");
      const durationMs = durationSec * 1000;
      const createdAt = Date.now();
      const race = {
        id: id12(),
        userId: user.id,
        name: title,
        animal,
        algorithm: RACE_ALGORITHM,
        seed,
        seedHash: sha256Hex(seed),
        namesHash: namesDigest(list.names),
        clientSeed: "",
        durationMs,
        leadInMs: LEAD_IN_MS,
        createdAt,
        startedAt: 0,
        finishedAt: 0,
        status: "ready",
        creditUsed: false,
        entrants: list.names.map((name, lane) => ({ name, lane, finishMs: 0, place: 0 })),
        sponsors,
      };
      state.races.push(race);
      return { status: 201, charged: false, race: presentRace(race), user: viewUser(user) };
    });
    reply(res, send, result);
    return;
  }

  const startMatch = pathName.match(/^\/api\/races\/([A-Za-z0-9_-]{8,32})\/start$/);
  if (req.method === "POST" && startMatch) {
    if (limited(`${ip}:race-start`)) {
      send(res, 429, { error: "Too many attempts. Wait a few minutes and try again." });
      return;
    }
    const body = await readBody(req);
    const requestedSeed = String(body?.clientSeed || "").trim();
    if (requestedSeed && !CLIENT_SEED.test(requestedSeed)) {
      send(res, 400, { error: "The client seed can use up to 64 letters, numbers, - or _." });
      return;
    }
    const result = await mutate((state) => {
      let changed = false;
      for (const race of state.races) {
        if (race.userId === user.id && settle(race)) changed = true;
      }
      const race = ownRace(state, user, startMatch[1]);
      if (!race) return { status: 404, persist: changed, error: "That race result was not found." };
      if (race.status === "finished" || race.status === "racing") {
        return { status: 200, persist: changed, charged: false, race: presentRace(race), user: viewUser(user) };
      }
      const active = state.races.find((item) => item.userId === user.id && item.status === "racing" && item.id !== race.id);
      if (active) {
        return {
          status: 409,
          persist: changed,
          error: "An official race is already in progress.",
          race: presentRace(active),
        };
      }
      const now = Date.now();
      const outcome = applyRaceStart(user, race, now + (race.leadInMs || 0));
      if (outcome.error) return { status: outcome.status, persist: changed, error: outcome.error };
      if (race.algorithm === "race-v3") {
        race.clientSeed = requestedSeed || randomBytes(16).toString("hex");
        const names = race.entrants.map((entrant) => entrant.name);
        race.entrants = buildEntrants(names, race.seed, race.durationMs, orderLabel(race));
      }
      if (outcome.charged) {
        state.ledger.push({
          id: id12(),
          userId: user.id,
          type: "race",
          credits: -1,
          balance: user.credits,
          note: race.name,
          raceId: race.id,
          createdAt: now,
        });
      }
      return { status: 200, charged: Boolean(outcome.charged), race: presentRace(race), user: viewUser(user) };
    });
    reply(res, send, result);
    return;
  }

  const raceMatch = pathName.match(/^\/api\/races\/([A-Za-z0-9_-]{8,32})$/);
  if (req.method === "GET" && raceMatch) {
    const result = await mutate((state) => {
      const race = ownRace(state, user, raceMatch[1]);
      if (!race) return { status: 404, persist: false, error: "That race result was not found." };
      const changed = settle(race);
      return { status: 200, persist: changed, race: presentRace(race) };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "POST" && pathName === "/api/credits/checkout") {
    if (limited(`${ip}:checkout`)) {
      send(res, 429, { error: "Too many attempts. Wait a few minutes and try again." });
      return;
    }
    const body = await readBody(req);
    const pack = PACKAGES.find((item) => item.id === body.packageId);
    if (!pack) {
      send(res, 400, { error: "Choose a credit package." });
      return;
    }
    const mode = gatewayMode();
    if (mode !== "demo" && mode !== "mercadopago") {
      send(res, 503, { error: "The payment gateway is not configured." });
      return;
    }
    if (mode === "mercadopago" && !accessToken()) {
      send(res, 503, { error: "Mercado Pago is not configured. Add MERCADOPAGO_ACCESS_TOKEN." });
      return;
    }
    const currency = mode === "mercadopago" ? chargeCurrency() : pack.currency;
    const created = await mutate((state) => {
      const payment = {
        id: id12(),
        userId: user.id,
        packageId: pack.id,
        packageName: pack.name,
        credits: pack.credits,
        amount: pack.amount,
        currency,
        status: "pending",
        gateway: mode === "demo" ? "demo" : mode,
        createdAt: Date.now(),
      };
      state.payments.push(payment);
      return { status: 201, paymentId: payment.id, demo: mode === "demo" };
    });
    if (created.status !== 201) {
      reply(res, send, created);
      return;
    }
    if (mode !== "mercadopago") {
      const listed = await mutate((state) => {
        const payment = state.payments.find((item) => item.id === created.paymentId);
        return { status: 201, persist: false, payment: paymentView(payment), demo: mode === "demo" };
      });
      reply(res, send, listed);
      return;
    }
    try {
      const preference = await createPreference({
        token: accessToken(),
        payment: { id: created.paymentId, packageId: pack.id, packageName: pack.name, credits: pack.credits, amount: pack.amount, currency },
        origin: appOrigin(req, origin),
        payerEmail: user.email,
      });
      const listed = await mutate((state) => {
        const payment = state.payments.find((item) => item.id === created.paymentId);
        if (!payment) return { status: 404, persist: false, error: "That payment was not found." };
        payment.preferenceId = preference.preferenceId;
        payment.checkoutUrl = preference.checkoutUrl;
        return { status: 201, payment: paymentView(payment), checkoutUrl: preference.checkoutUrl, demo: false };
      });
      reply(res, send, listed);
    } catch (error) {
      console.error(error);
      await mutate((state) => {
        const payment = state.payments.find((item) => item.id === created.paymentId);
        if (payment && payment.status === "pending") {
          payment.status = "failed";
          payment.gatewayStatus = "checkout_failed";
        }
        return { status: 200 };
      });
      send(res, 502, { error: "Mercado Pago could not start this checkout. Try again." });
    }
    return;
  }

  if (req.method === "POST" && pathName === "/api/credits/confirm") {
    const body = await readBody(req);
    const result = await mutate((state) => {
      const payment = state.payments.find((item) => item.id === body.paymentId && item.userId === user.id);
      if (!payment) return { status: 404, persist: false, error: "That payment was not found." };
      if (payment.status === "paid") return { status: 200, persist: false, payment: paymentView(payment), user: viewUser(user) };
      if (gatewayMode() !== "demo" || payment.gateway !== "demo") {
        return { status: 403, persist: false, error: "This payment is waiting for the payment gateway." };
      }
      grantPayment(state, payment, "demo");
      return { status: 200, payment: paymentView(payment), user: viewUser(user) };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "POST" && pathName === "/api/credits/sync") {
    const body = await readBody(req);
    const mpPaymentId = String(body.mpPaymentId || "").trim();
    if (!/^\d{1,20}$/.test(mpPaymentId)) {
      send(res, 400, { error: "That Mercado Pago payment could not be read." });
      return;
    }
    const token = accessToken();
    if (!token) {
      send(res, 503, { error: "Mercado Pago is not configured." });
      return;
    }
    let remote;
    try {
      remote = await fetchPayment(token, mpPaymentId);
    } catch (error) {
      console.error(error);
      send(res, 502, { error: "Mercado Pago could not be confirmed." });
      return;
    }
    const result = await mutate((state) => {
      const payment = state.payments.find((item) => item.id === body.paymentId && item.userId === user.id);
      if (!payment) return { status: 404, persist: false, error: "That payment was not found." };
      if (String(remote.external_reference || "") !== payment.id) {
        return { status: 400, persist: false, error: "That Mercado Pago payment does not match this checkout." };
      }
      applyRemoteCharge(state, remote);
      const account = state.users.find((item) => item.id === user.id);
      return { status: 200, payment: paymentView(payment), user: viewUser(account), gateway: gatewayMode() };
    });
    reply(res, send, result);
    return;
  }

  const paymentMatch = pathName.match(/^\/api\/credits\/payments\/([A-Za-z0-9_-]{8,32})$/);
  if (req.method === "GET" && paymentMatch) {
    const peek = await mutate((state) => {
      const payment = state.payments.find((item) => item.id === paymentMatch[1] && (item.userId === user.id || user.role === "admin"));
      if (!payment) return { status: 404, persist: false, error: "That payment was not found." };
      const refreshId = payment.status === "pending" && payment.gateway === "mercadopago" ? String(payment.gatewayRef || "") : "";
      return { status: 200, persist: false, refreshId };
    });
    if (peek.status !== 200) {
      reply(res, send, peek);
      return;
    }
    if (/^\d{1,20}$/.test(peek.refreshId) && accessToken()) {
      try {
        const remote = await fetchPayment(accessToken(), peek.refreshId);
        await mutate((state) => {
          applyRemoteCharge(state, remote);
          return { status: 200 };
        });
      } catch (error) {
        console.error(error);
      }
    }
    const result = await mutate((state) => {
      const payment = state.payments.find((item) => item.id === paymentMatch[1] && (item.userId === user.id || user.role === "admin"));
      if (!payment) return { status: 404, persist: false, error: "That payment was not found." };
      const account = state.users.find((item) => item.id === user.id);
      return { status: 200, persist: false, payment: paymentView(payment), user: account ? viewUser(account) : viewUser(user), gateway: gatewayMode() };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "POST" && pathName === "/api/sponsors") {
    const body = await readBody(req, 2_500_000);
    const name = String(body.name || "").trim().slice(0, 40);
    if (!name) {
      send(res, 400, { error: "Name this sponsor." });
      return;
    }
    const encoded = String(body.png || "").replace(/^data:image\/png;base64,/i, "");
    let buf;
    try {
      buf = Buffer.from(encoded, "base64");
    } catch {
      send(res, 400, { error: "Upload a PNG image." });
      return;
    }
    const size = pngSize(buf);
    if (!size || size.width < 1 || size.height < 1 || size.width > 4096 || size.height > 4096) {
      send(res, 400, { error: "Upload a PNG image up to 4096 pixels on a side." });
      return;
    }
    if (buf.length > 1_500_000) {
      send(res, 413, { error: "Use a PNG smaller than 1.5 MB." });
      return;
    }
    const result = await mutate((state) => {
      const owned = state.sponsors.filter((sponsor) => sponsor.userId === user.id && sponsor.active !== false);
      if (owned.length >= 12) return { status: 400, persist: false, error: "You can keep up to 12 sponsor images." };
      const id = randomBytes(12).toString("hex");
      mkdirSync(sponsorDir, { recursive: true });
      writeFileSync(path.join(sponsorDir, `${id}.png`), buf);
      const sponsor = { id, userId: user.id, name, createdAt: Date.now(), active: true };
      state.sponsors.push(sponsor);
      return { status: 201, sponsor: sponsorView(sponsor) };
    });
    reply(res, send, result);
    return;
  }

  const imageMatch = pathName.match(/^\/api\/sponsors\/([a-f0-9]{24})\/image$/);
  if (req.method === "GET" && imageMatch) {
    const found = await mutate((state) => {
      const sponsor = state.sponsors.find((item) => item.id === imageMatch[1]);
      if (!sponsor || (sponsor.userId !== user.id && user.role !== "admin")) return { persist: false, id: "" };
      return { persist: false, id: sponsor.id };
    });
    if (!found.id) {
      send(res, 404, { error: "That sponsor image was not found." });
      return;
    }
    try {
      const buf = readFileSync(path.join(sponsorDir, `${found.id}.png`));
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
        "Content-Length": buf.length,
      });
      res.end(buf);
    } catch {
      send(res, 404, { error: "That sponsor image was not found." });
    }
    return;
  }

  const sponsorMatch = pathName.match(/^\/api\/sponsors\/([a-f0-9]{24})$/);
  if (req.method === "DELETE" && sponsorMatch) {
    const result = await mutate((state) => {
      const sponsor = state.sponsors.find((item) => item.id === sponsorMatch[1] && item.userId === user.id);
      if (!sponsor || sponsor.active === false) return { status: 404, persist: false, error: "That sponsor image was not found." };
      sponsor.active = false;
      return { status: 200, ok: true };
    });
    reply(res, send, result);
    return;
  }

  if (pathName === "/api/admin/overview" && req.method === "GET") {
    if (user.role !== "admin") {
      send(res, 403, { error: "This account is not an administrator." });
      return;
    }
    const result = await mutate((state) => {
      let changed = false;
      for (const race of state.races) {
        if (settle(race)) changed = true;
      }
      const users = state.users.map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        role: item.role || "user",
        credits: item.credits || 0,
        verified: Boolean(item.verified),
        createdAt: item.createdAt,
      }));
      const races = state.races
        .slice()
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, 50)
        .map((race) => ({ ...summarize(race), ownerId: race.userId }));
      const payments = state.payments
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 50)
        .map(paymentView);
      const creditsSold = state.ledger.filter((entry) => entry.type === "topup").reduce((sum, entry) => sum + entry.credits, 0);
      const creditsOutstanding = users.reduce((sum, item) => sum + item.credits, 0);
      return {
        status: 200,
        persist: changed,
        users,
        races,
        payments,
        totals: { users: users.length, races: state.races.length, creditsSold, creditsOutstanding },
      };
    });
    reply(res, send, result);
    return;
  }

  if (pathName === "/api/admin/credits" && req.method === "POST") {
    if (user.role !== "admin") {
      send(res, 403, { error: "This account is not an administrator." });
      return;
    }
    const body = await readBody(req);
    const delta = Number(body.credits);
    const note = String(body.note || "").trim();
    if (!Number.isInteger(delta) || delta === 0 || delta < -1000 || delta > 1000) {
      send(res, 400, { error: "Enter a whole number of credits from -1000 to 1000, other than zero." });
      return;
    }
    if (note.length < 1 || note.length > 120) {
      send(res, 400, { error: "Add a short note for this adjustment. It does not refund cash." });
      return;
    }
    const result = await mutate((state) => {
      const target = state.users.find((item) => item.id === body.userId && item.verified);
      if (!target) return { status: 404, persist: false, error: "That account was not found." };
      if ((target.credits || 0) + delta < 0) return { status: 400, persist: false, error: "The balance cannot go below zero." };
      target.credits = (target.credits || 0) + delta;
      const entry = {
        id: id12(),
        userId: target.id,
        type: "adjust",
        credits: delta,
        balance: target.credits,
        note,
        createdAt: Date.now(),
      };
      state.ledger.push(entry);
      return { status: 200, user: viewUser(target), entry: ledgerView(entry) };
    });
    reply(res, send, result);
    return;
  }

  send(res, 404, { error: "Not found." });
}
