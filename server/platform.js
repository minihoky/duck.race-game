import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { appendAudit, verifyChain } from "./audit.js";
import { USER_STATUSES, devAdminOpen, mutate, readImage, readSession, saveImage, storeKind, viewUser } from "./accounts.js";
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

export const MIN_DURATION = 10;
export const MAX_DURATION = 120;
export const MAX_PARTICIPANTS = 200;

export const DEFAULT_PACKAGES = [
  { id: "pack-10", name: "Pacote 10", credits: 10, amount: 900, sort: 1 },
  { id: "pack-25", name: "Pacote 25", credits: 25, amount: 1900, sort: 2 },
  { id: "pack-50", name: "Pacote 50", credits: 50, amount: 2900, sort: 3 },
];

export const RACE_ALGORITHM = "race-v4";
export const LEAD_IN_MS = 3000;
export const ANIMALS = ["rabbit", "frog", "fish", "turtle", "snail"];

const PAGE_SIZE = 25;
const CLIENT_SEED = /^[A-Za-z0-9_-]{1,64}$/;
const SPONSOR_ID = /^[a-f0-9]{24}$/;

function gatewayMode() {
  const configured = String(process.env.PAYMENT_GATEWAY || "").trim().toLowerCase();
  if (configured === "demo") return "demo";
  if (configured === "mercadopago") return "mercadopago";
  if (!configured && process.env.NODE_ENV !== "production") return "demo";
  return configured || "unconfigured";
}

function appOrigin(req, origin) {
  const configured = String(process.env.PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  return origin(req);
}

function id12() {
  return randomBytes(9).toString("base64url");
}

function animalOf(race) {
  return ANIMALS.includes(race.animal) ? race.animal : "rabbit";
}

function ensurePackages(state) {
  if (state.packages.length) return false;
  const now = Date.now();
  for (const pack of DEFAULT_PACKAGES) state.packages.push({ ...pack, active: true, createdAt: now });
  return true;
}

function activePackages(state) {
  return state.packages
    .filter((pack) => pack.active !== false)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.credits - b.credits);
}

function packageView(pack) {
  return {
    id: pack.id,
    name: pack.name,
    credits: pack.credits,
    amount: pack.amount,
    currency: chargeCurrency(),
    active: pack.active !== false,
    sort: pack.sort || 0,
  };
}

// ---------------------------------------------------------------------------
// Fairness

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

export function paramsText(race) {
  return [
    `algorithm=${race.algorithm}`,
    `race=${race.id}`,
    `animal=${race.animal}`,
    `durationMs=${race.durationMs}`,
    `leadInMs=${race.leadInMs}`,
    `createdAt=${race.createdAt}`,
    `namesHash=${race.namesHash}`,
    `seedHash=${race.seedHash}`,
  ].join("\n");
}

export function paramsDigest(race) {
  return sha256Hex(paramsText(race));
}

export function orderLabel(race) {
  if (race.algorithm === "race-v4") return `race-v4:order:${race.paramsHash}:${race.clientSeed}`;
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

function resultDigest(race) {
  const order = [...race.entrants].sort((a, b) => a.place - b.place).map((entrant) => entrant.lane);
  return sha256Hex(order.join(","));
}

function motionSeed(race) {
  return createHmac("sha256", String(race.seed)).update(`${race.algorithm || "race-v1"}:motion`).digest("hex").slice(0, 16);
}

function raceEnd(race) {
  return race.startedAt + race.entrants.reduce((max, entrant) => Math.max(max, entrant.finishMs), 0);
}

function settle(state, race, now = Date.now()) {
  if (race.status !== "racing" || !race.startedAt) return false;
  if (now < raceEnd(race)) return false;
  race.status = "finished";
  race.finishedAt = raceEnd(race);
  const winner = race.entrants.find((entrant) => entrant.place === 1);
  appendAudit(state, {
    action: "race.finished",
    targetType: "race",
    targetId: race.id,
    at: now,
    data: { finishedAt: race.finishedAt, serverSeed: String(race.seed), winnerLane: winner ? winner.lane : null, resultHash: resultDigest(race) },
  });
  return true;
}

function settleAll(state, filter = () => true) {
  let changed = false;
  for (const race of state.races) {
    if (filter(race) && settle(state, race)) changed = true;
  }
  return changed;
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
    paramsHash: race.paramsHash || "",
    clientSeed: visible ? race.clientSeed : "",
    serverSeed: race.status === "finished" ? String(race.seed) : "",
  };
}

function raceAudit(state, race) {
  return state.audit
    .filter((entry) => entry.targetType === "race" && entry.targetId === race.id)
    .map(({ seq, at, action, data, prevHash, hash }) => ({ seq, at, action, data, prevHash, hash }));
}

function publicRace(state, race) {
  const visible = raceHasRun(race);
  return {
    id: race.id,
    name: race.name,
    animal: animalOf(race),
    status: race.status,
    createdAt: race.createdAt || null,
    startedAt: race.startedAt || null,
    finishedAt: race.finishedAt || null,
    durationMs: race.durationMs,
    leadInMs: race.leadInMs || 0,
    names: race.entrants.map((entrant) => entrant.name),
    places: visible ? race.entrants.map(({ lane, place }) => ({ lane, place })) : [],
    algorithm: race.algorithm || "race-v1",
    fairness: fairnessOf(race),
    audit: raceAudit(state, race),
  };
}

function globalSponsors(state) {
  return state.sponsors
    .filter((sponsor) => sponsor.scope === "global" && sponsor.active !== false)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.createdAt - b.createdAt)
    .map(sponsorView);
}

function presentRace(state, race) {
  const visible = raceHasRun(race);
  return {
    id: race.id,
    name: race.name,
    names: race.entrants.map((entrant) => entrant.name),
    entrants: visible ? race.entrants.map(({ name, lane, finishMs, place }) => ({ name, lane, finishMs, place })) : [],
    sponsors: race.sponsors || [],
    globalSponsors: globalSponsors(state),
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
    algorithm: race.algorithm || "race-v1",
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

const CREDIT_ERROR = "You need 1 credit to start an official race. Credits stay on this platform and cannot be transferred or refunded for cash.";

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

// ---------------------------------------------------------------------------
// Credits and payments

function ledgerView(entry) {
  return {
    id: entry.id,
    userId: entry.userId,
    type: entry.type,
    credits: entry.credits,
    balance: entry.balance,
    note: entry.note || "",
    raceId: entry.raceId || "",
    paymentId: entry.paymentId || "",
    actorId: entry.actorId || "",
    createdAt: entry.createdAt,
  };
}

function paymentView(payment) {
  return {
    id: payment.id,
    userId: payment.userId,
    packageId: payment.packageId,
    packageName: payment.packageName,
    credits: payment.credits,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    demo: payment.gateway === "demo",
    gateway: payment.gateway,
    gatewayRef: payment.gatewayRef || "",
    createdAt: payment.createdAt,
    paidAt: payment.paidAt || null,
    checkoutUrl: payment.status === "pending" ? payment.checkoutUrl || "" : "",
    gatewayStatus: payment.gatewayStatus || "",
  };
}

export function grantPayment(state, payment, gatewayRef) {
  if (payment.status === "paid") return false;
  const user = state.users.find((item) => item.id === payment.userId);
  if (!user) return false;
  if (state.ledger.some((entry) => entry.type === "topup" && entry.paymentId === payment.id)) return false;
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
  appendAudit(state, {
    actorId: user.id,
    action: "credits.purchased",
    targetType: "payment",
    targetId: payment.id,
    data: { userId: user.id, credits: payment.credits, amount: payment.amount, currency: payment.currency, gateway: payment.gateway, gatewayRef: payment.gatewayRef, balance: user.credits },
  });
  return true;
}

export function applyRemoteCharge(state, remote) {
  const local = state.payments.find((item) => item.id === String(remote.external_reference || ""));
  if (!local || local.gateway !== "mercadopago") return false;
  const decision = assessCharge(local, remote);
  if (decision.action === "ignore") return false;
  if (decision.action === "reject") {
    if (local.status === "paid" || local.gatewayStatus === "amount_mismatch") return false;
    local.gatewayStatus = "amount_mismatch";
    appendAudit(state, { action: "payment.amount_mismatch", targetType: "payment", targetId: local.id, data: { gatewayRef: String(remote.id || "") } });
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
    appendAudit(state, { action: "payment.failed", targetType: "payment", targetId: local.id, data: { gatewayRef: decision.mpId, gatewayStatus: decision.status } });
    return true;
  }
  if (local.status === "paid") return false;
  let changed = false;
  if (decision.mpId && local.gatewayRef !== decision.mpId) {
    local.gatewayRef = decision.mpId;
    changed = true;
  }
  if (local.gatewayStatus !== decision.status) {
    local.gatewayStatus = decision.status;
    changed = true;
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Sponsors

function sponsorView(sponsor) {
  return {
    id: sponsor.id,
    name: sponsor.name,
    scope: sponsor.scope || "user",
    active: sponsor.active !== false,
    sort: sponsor.sort || 0,
    userId: sponsor.userId || "",
    createdAt: sponsor.createdAt,
    v: sponsor.updatedAt || sponsor.createdAt || 0,
  };
}

function pngSize(buf) {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function decodePng(value) {
  const encoded = String(value || "").replace(/^data:image\/png;base64,/i, "");
  let buf;
  try {
    buf = Buffer.from(encoded, "base64");
  } catch {
    return { status: 400, error: "Upload a PNG image." };
  }
  const size = pngSize(buf);
  if (!size || size.width < 1 || size.height < 1 || size.width > 4096 || size.height > 4096) {
    return { status: 400, error: "Upload a PNG image up to 4096 pixels on a side." };
  }
  if (buf.length > 1_500_000) return { status: 413, error: "Use a PNG smaller than 1.5 MB." };
  return { buf };
}

// ---------------------------------------------------------------------------
// Helpers

function cleanNameList(value) {
  if (!Array.isArray(value)) return { error: "Add one name per line." };
  const names = value.map((item) => String(item || "").trim()).filter(Boolean);
  if (names.length < 2) return { error: "Add at least two names." };
  if (names.length > MAX_PARTICIPANTS) return { error: "An official race can include up to 200 names." };
  if (names.some((name) => name.length > 40)) return { error: "Each name can be at most 40 characters." };
  return { names };
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

function paginate(list, url) {
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || PAGE_SIZE));
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(pages, Math.max(1, Number(url.searchParams.get("page")) || 1));
  return { items: list.slice((page - 1) * limit, page * limit), page, pages, total, limit };
}

function matches(query, ...values) {
  if (!query) return true;
  return values.some((value) => String(value || "").toLowerCase().includes(query));
}

function adminUserView(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "user",
    credits: user.credits || 0,
    verified: Boolean(user.verified),
    status: user.status || "active",
    statusNote: user.statusNote || "",
    createdAt: user.createdAt,
  };
}

function accountProblem(user) {
  if (user.status === "restricted") return { status: 403, error: "This account is restricted. Contact support.", code: "restricted" };
  return null;
}

function newest(a, b) {
  return (b.createdAt || 0) - (a.createdAt || 0);
}

// ---------------------------------------------------------------------------
// Routes

export async function handlePlatform(req, res, url, ctx) {
  const pathName = url.pathname;
  const { send, cookies, origin, readBody, readRaw, limited, ip } = ctx;

  if (req.method === "GET" && pathName === "/api/health") {
    send(res, 200, { ok: true, store: storeKind() });
    return;
  }

  if (req.method === "GET" && pathName === "/api/credits/packages") {
    const result = await mutate((state) => {
      const seeded = ensurePackages(state);
      return { status: 200, persist: seeded, packages: activePackages(state).map(packageView), gateway: gatewayMode() };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "GET" && pathName === "/api/sponsors/global") {
    const result = await mutate((state) => ({ status: 200, persist: false, sponsors: globalSponsors(state) }));
    reply(res, send, result);
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
      const dataId = signedDataId(url, notice);
      const check = verifyWebhookSignature({
        secret: webhookSecret(),
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
        reply(res, send, await settleMercadoPagoIds(ids));
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
      if (payment.gateway === "mercadopago") return { status: 400, persist: false, error: "This payment is confirmed by Mercado Pago." };
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
    if (limited(`${ip}:verify`, 300)) {
      send(res, 429, { error: "Too many attempts. Wait a few minutes and try again." });
      return;
    }
    const result = await mutate((state) => {
      const race = state.races.find((item) => item.id === verifyMatch[1]);
      if (!race) return { status: 404, persist: false, error: "That result ID was not found." };
      const changed = settle(state, race);
      return { status: 200, persist: changed, race: publicRace(state, race) };
    });
    reply(res, send, result);
    return;
  }

  const imageMatch = pathName.match(/^\/api\/sponsors\/([a-f0-9]{24})\/image$/);
  if (req.method === "GET" && imageMatch) {
    const viewer = requireUser(req, cookies);
    const found = await mutate((state) => {
      const sponsor = state.sponsors.find((item) => item.id === imageMatch[1]);
      if (!sponsor) return { persist: false, id: "", public: false };
      const isPublic = sponsor.scope === "global";
      const allowed = isPublic || (viewer && (sponsor.userId === viewer.id || viewer.role === "admin"));
      return { persist: false, id: allowed ? sponsor.id : "", public: isPublic };
    });
    const buf = found.id ? await readImage(found.id) : null;
    if (!buf) {
      send(res, 404, { error: "That sponsor image was not found." });
      return;
    }
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": `${found.public ? "public" : "private"}, max-age=3600`,
      "Content-Length": buf.length,
      "X-Content-Type-Options": "nosniff",
    });
    res.end(buf);
    return;
  }

  const user = requireUser(req, cookies);

  if (req.method === "GET" && pathName === "/api/account") {
    if (!user) {
      send(res, 401, { user: null });
      return;
    }
    const result = await mutate((state) => {
      const changed = settleAll(state, (race) => race.userId === user.id);
      const active = state.races.find((race) => race.userId === user.id && race.status === "racing");
      const ledger = state.ledger.filter((entry) => entry.userId === user.id).slice(-100).reverse();
      const payments = state.payments.filter((payment) => payment.userId === user.id).sort(newest).slice(0, 100);
      const sponsors = state.sponsors.filter((sponsor) => sponsor.userId === user.id && sponsor.scope !== "global" && sponsor.active !== false);
      return {
        status: 200,
        persist: changed,
        user: viewUser(user),
        ledger: ledger.map(ledgerView),
        payments: payments.map(paymentView),
        sponsors: sponsors.map(sponsorView),
        activeRace: active ? summarize(active) : null,
        devAdminAvailable: devAdminOpen() && user.role !== "admin",
      };
    });
    reply(res, send, result);
    return;
  }

  if (!user) {
    send(res, 401, { error: "Sign in to continue." });
    return;
  }

  if (req.method === "POST" && pathName === "/api/account/dev-admin") {
    await readBody(req);
    const result = await mutate((state) => {
      if (!devAdminOpen()) return { status: 403, persist: false, error: "Administrator access is assigned with ADMIN_EMAILS." };
      const account = state.users.find((item) => item.id === user.id);
      if (!account) return { status: 401, persist: false, error: "Sign in to continue." };
      account.role = "admin";
      appendAudit(state, { actorId: account.id, action: "user.dev_admin", targetType: "user", targetId: account.id });
      return { status: 200, user: viewUser(account) };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "GET" && pathName === "/api/races/active") {
    const result = await mutate((state) => {
      const changed = settleAll(state, (race) => race.userId === user.id);
      const active = state.races.find((race) => race.userId === user.id && race.status === "racing");
      return { status: 200, persist: changed, race: active ? presentRace(state, active) : null };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "GET" && pathName === "/api/races") {
    const result = await mutate((state) => {
      const changed = settleAll(state, (race) => race.userId === user.id);
      const history = state.races
        .filter((race) => race.userId === user.id)
        .sort((a, b) => (b.startedAt || b.createdAt || 0) - (a.startedAt || a.createdAt || 0))
        .map(summarize);
      return { status: 200, persist: changed, races: history };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "POST" && pathName === "/api/races") {
    if (limited(`${ip}:race-setup`, 30)) {
      send(res, 429, { error: "Too many attempts. Wait a few minutes and try again." });
      return;
    }
    const body = await readBody(req);
    const result = await mutate((state) => {
      const problem = accountProblem(user);
      if (problem) return { ...problem, persist: false };
      const changed = settleAll(state, (race) => race.userId === user.id);
      const list = cleanNameList(body.names);
      if (list.error) return { status: 400, persist: changed, error: list.error };
      const durationSec = Number(body.durationSec);
      if (!Number.isInteger(durationSec) || durationSec < MIN_DURATION || durationSec > MAX_DURATION) {
        return { status: 400, persist: changed, error: `Set a race length between ${MIN_DURATION} and ${MAX_DURATION} seconds.` };
      }
      const title = String(body.name || "").trim() || "Official race";
      if (title.length > 60) return { status: 400, persist: changed, error: "The race name can be at most 60 characters." };
      const requested = Array.isArray(body.sponsorIds) ? body.sponsorIds.map(String) : [];
      if (requested.length > 1) return { status: 400, persist: changed, error: "Choose one sponsor image." };
      const sponsors = [];
      for (const sponsorId of requested) {
        const sponsor = state.sponsors.find((item) => item.id === sponsorId && item.userId === user.id && item.scope !== "global" && item.active !== false);
        if (sponsor && sponsors.length < 1) sponsors.push({ id: sponsor.id, name: sponsor.name });
      }
      const seed = randomBytes(32).toString("hex");
      const race = {
        id: id12(),
        userId: user.id,
        name: title,
        animal: ANIMALS.includes(body.animal) ? body.animal : "rabbit",
        algorithm: RACE_ALGORITHM,
        seed,
        seedHash: sha256Hex(seed),
        namesHash: namesDigest(list.names),
        paramsHash: "",
        clientSeed: "",
        durationMs: durationSec * 1000,
        leadInMs: LEAD_IN_MS,
        createdAt: Date.now(),
        startedAt: 0,
        finishedAt: 0,
        status: "ready",
        creditUsed: false,
        entrants: list.names.map((name, lane) => ({ name, lane, finishMs: 0, place: 0 })),
        sponsors,
      };
      race.paramsHash = paramsDigest(race);
      state.races.push(race);
      appendAudit(state, {
        actorId: user.id,
        action: "race.created",
        targetType: "race",
        targetId: race.id,
        at: race.createdAt,
        data: {
          algorithm: race.algorithm,
          animal: race.animal,
          durationMs: race.durationMs,
          leadInMs: race.leadInMs,
          participants: list.names.length,
          seedHash: race.seedHash,
          namesHash: race.namesHash,
          paramsHash: race.paramsHash,
        },
      });
      return { status: 201, charged: false, race: presentRace(state, race), user: viewUser(user) };
    });
    reply(res, send, result);
    return;
  }

  const startMatch = pathName.match(/^\/api\/races\/([A-Za-z0-9_-]{8,32})\/start$/);
  if (req.method === "POST" && startMatch) {
    if (limited(`${ip}:race-start`, 30)) {
      send(res, 429, { error: "Too many attempts. Wait a few minutes and try again." });
      return;
    }
    const body = await readBody(req);
    const requestedSeed = String(body?.clientSeed || "").trim();
    if (requestedSeed && !CLIENT_SEED.test(requestedSeed)) {
      send(res, 400, { error: "The client seed can use up to 64 letters, numbers, - or _." });
      return;
    }
    const session = user;
    const result = await mutate((state) => {
      const changed = settleAll(state, (race) => race.userId === session.id);
      const user = state.users.find((item) => item.id === session.id);
      if (!user || user.status === "blocked") return { status: 401, persist: changed, error: "Sign in to continue." };
      const race = state.races.find((item) => item.id === startMatch[1] && (item.userId === user.id || user.role === "admin"));
      if (!race) return { status: 404, persist: changed, error: "That race result was not found." };
      if (race.status === "finished" || race.status === "racing") {
        return { status: 200, persist: changed, charged: false, race: presentRace(state, race), user: viewUser(user) };
      }
      if (race.userId !== user.id) return { status: 403, persist: changed, error: "Only the organizer can start this race." };
      const problem = accountProblem(user);
      if (problem) return { ...problem, persist: changed };
      const active = state.races.find((item) => item.userId === user.id && item.status === "racing" && item.id !== race.id);
      if (active) return { status: 409, persist: changed, error: "An official race is already in progress.", race: presentRace(state, active) };
      const now = Date.now();
      const outcome = applyRaceStart(user, race, now + (race.leadInMs || 0));
      if (outcome.error) return { status: outcome.status, persist: changed, error: outcome.error };
      if (race.algorithm === "race-v3" || race.algorithm === "race-v4") {
        race.clientSeed = requestedSeed || randomBytes(16).toString("hex");
        const names = race.entrants.map((entrant) => entrant.name);
        race.entrants = buildEntrants(names, race.seed, race.durationMs, orderLabel(race));
      }
      if (outcome.charged) {
        state.ledger.push({ id: id12(), userId: user.id, type: "race", credits: -1, balance: user.credits, note: race.name, raceId: race.id, createdAt: now });
      }
      appendAudit(state, {
        actorId: user.id,
        action: "race.started",
        targetType: "race",
        targetId: race.id,
        at: now,
        data: { startedAt: race.startedAt, clientSeed: race.clientSeed, charged: Boolean(outcome.charged), balance: user.credits },
      });
      return { status: 200, charged: Boolean(outcome.charged), race: presentRace(state, race), user: viewUser(user) };
    });
    reply(res, send, result);
    return;
  }

  const raceMatch = pathName.match(/^\/api\/races\/([A-Za-z0-9_-]{8,32})$/);
  if (req.method === "GET" && raceMatch) {
    const result = await mutate((state) => {
      const race = state.races.find((item) => item.id === raceMatch[1] && (item.userId === user.id || user.role === "admin"));
      if (!race) return { status: 404, persist: false, error: "That race result was not found." };
      const changed = settle(state, race);
      return { status: 200, persist: changed, race: presentRace(state, race) };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "GET" && pathName === "/api/credits/payments") {
    const result = await mutate((state) => ({
      status: 200,
      persist: false,
      payments: state.payments.filter((payment) => payment.userId === user.id).sort(newest).map(paymentView),
    }));
    reply(res, send, result);
    return;
  }

  if (req.method === "POST" && pathName === "/api/credits/checkout") {
    if (limited(`${ip}:checkout`)) {
      send(res, 429, { error: "Too many attempts. Wait a few minutes and try again." });
      return;
    }
    const body = await readBody(req);
    const problem = accountProblem(user);
    if (problem) {
      reply(res, send, problem);
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
    const currency = chargeCurrency();
    const created = await mutate((state) => {
      ensurePackages(state);
      const pack = activePackages(state).find((item) => item.id === body.packageId);
      if (!pack) return { status: 400, persist: false, error: "Choose a credit package." };
      const payment = {
        id: id12(),
        userId: user.id,
        packageId: pack.id,
        packageName: pack.name,
        credits: pack.credits,
        amount: pack.amount,
        currency,
        status: "pending",
        gateway: mode,
        createdAt: Date.now(),
      };
      state.payments.push(payment);
      return { status: 201, payment: paymentView(payment), demo: mode === "demo" };
    });
    if (created.status !== 201 || mode !== "mercadopago") {
      reply(res, send, created);
      return;
    }
    try {
      const pending = created.payment;
      const preference = await createPreference({
        token: accessToken(),
        payment: { id: pending.id, packageId: pending.packageId, packageName: pending.packageName, credits: pending.credits, amount: pending.amount, currency },
        origin: appOrigin(req, origin),
        payerEmail: user.email,
      });
      const listed = await mutate((state) => {
        const payment = state.payments.find((item) => item.id === pending.id);
        if (!payment) return { status: 404, persist: false, error: "That payment was not found." };
        payment.preferenceId = preference.preferenceId;
        payment.checkoutUrl = preference.checkoutUrl;
        return { status: 201, payment: paymentView(payment), checkoutUrl: preference.checkoutUrl, demo: false };
      });
      reply(res, send, listed);
    } catch (error) {
      console.error(error);
      await mutate((state) => {
        const payment = state.payments.find((item) => item.id === created.payment.id);
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
    const owns = (item) => item.id === paymentMatch[1] && (item.userId === user.id || user.role === "admin");
    const peek = await mutate((state) => {
      const payment = state.payments.find(owns);
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
        await mutate((state) => ({ status: 200, persist: applyRemoteCharge(state, remote) }));
      } catch (error) {
        console.error(error);
      }
    }
    const result = await mutate((state) => {
      const payment = state.payments.find(owns);
      if (!payment) return { status: 404, persist: false, error: "That payment was not found." };
      const account = state.users.find((item) => item.id === user.id);
      return { status: 200, persist: false, payment: paymentView(payment), user: viewUser(account || user), gateway: gatewayMode() };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "POST" && pathName === "/api/sponsors") {
    const body = await readBody(req, 2_500_000);
    const problem = accountProblem(user);
    if (problem) {
      reply(res, send, problem);
      return;
    }
    const name = String(body.name || "").trim().slice(0, 40);
    if (!name) {
      send(res, 400, { error: "Name this sponsor." });
      return;
    }
    const png = decodePng(body.png);
    if (png.error) {
      reply(res, send, png);
      return;
    }
    const id = randomBytes(12).toString("hex");
    const count = await mutate((state) => ({
      persist: false,
      owned: state.sponsors.filter((sponsor) => sponsor.userId === user.id && sponsor.scope !== "global" && sponsor.active !== false).length,
    }));
    if (count.owned >= 1) {
      send(res, 400, { error: "You can keep one sponsor image." });
      return;
    }
    await saveImage(id, png.buf);
    const result = await mutate((state) => {
      const owned = state.sponsors.filter((sponsor) => sponsor.userId === user.id && sponsor.scope !== "global" && sponsor.active !== false).length;
      if (owned >= 1) return { status: 400, persist: false, error: "You can keep one sponsor image." };
      const now = Date.now();
      const sponsor = { id, userId: user.id, name, scope: "user", createdAt: now, updatedAt: now, active: true, sort: 0 };
      state.sponsors.push(sponsor);
      return { status: 201, sponsor: sponsorView(sponsor) };
    });
    reply(res, send, result);
    return;
  }

  const sponsorMatch = pathName.match(/^\/api\/sponsors\/([a-f0-9]{24})$/);
  if (req.method === "DELETE" && sponsorMatch) {
    const result = await mutate((state) => {
      const sponsor = state.sponsors.find((item) => item.id === sponsorMatch[1] && item.userId === user.id && item.scope !== "global");
      if (!sponsor || sponsor.active === false) return { status: 404, persist: false, error: "That sponsor image was not found." };
      sponsor.active = false;
      sponsor.updatedAt = Date.now();
      return { status: 200, ok: true };
    });
    reply(res, send, result);
    return;
  }

  if (pathName.startsWith("/api/admin/")) {
    if (user.role !== "admin") {
      send(res, 403, { error: "This account is not an administrator." });
      return;
    }
    await handleAdmin(req, res, url, { ...ctx, user });
    return;
  }

  send(res, 404, { error: "Not found." });
}

// ---------------------------------------------------------------------------
// Administrator

async function handleAdmin(req, res, url, ctx) {
  const { send, readBody, user } = ctx;
  const pathName = url.pathname;
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();

  if (req.method === "GET" && pathName === "/api/admin/overview") {
    const result = await mutate((state) => {
      const changed = settleAll(state) || ensurePackages(state);
      const creditsSold = state.ledger.filter((entry) => entry.type === "topup").reduce((sum, entry) => sum + entry.credits, 0);
      const creditsUsed = -state.ledger.filter((entry) => entry.type === "race").reduce((sum, entry) => sum + entry.credits, 0);
      const revenue = {};
      for (const payment of state.payments.filter((item) => item.status === "paid" && item.gateway !== "demo")) {
        revenue[payment.currency] = (revenue[payment.currency] || 0) + payment.amount;
      }
      return {
        status: 200,
        persist: changed,
        totals: {
          users: state.users.length,
          blocked: state.users.filter((item) => item.status === "blocked").length,
          restricted: state.users.filter((item) => item.status === "restricted").length,
          races: state.races.length,
          finished: state.races.filter((race) => race.status === "finished").length,
          creditsSold,
          creditsUsed,
          creditsOutstanding: state.users.reduce((sum, item) => sum + (item.credits || 0), 0),
          paymentsPending: state.payments.filter((item) => item.status === "pending").length,
          revenue,
        },
        recentRaces: state.races.slice().sort((a, b) => (b.startedAt || b.createdAt) - (a.startedAt || a.createdAt)).slice(0, 8).map(summarize),
        recentPayments: state.payments.slice().sort(newest).slice(0, 8).map(paymentView),
        audit: verifyChain(state.audit),
        store: storeKind(),
        gateway: gatewayMode(),
      };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "GET" && pathName === "/api/admin/users") {
    const status = url.searchParams.get("status") || "";
    const result = await mutate((state) => {
      const list = state.users
        .filter((item) => (!status || item.status === status) && matches(q, item.name, item.email, item.id))
        .sort(newest)
        .map(adminUserView);
      return { status: 200, persist: false, ...paginate(list, url) };
    });
    reply(res, send, result);
    return;
  }

  const userMatch = pathName.match(/^\/api\/admin\/users\/([a-f0-9]{24})$/);
  if (req.method === "GET" && userMatch) {
    const result = await mutate((state) => {
      const target = state.users.find((item) => item.id === userMatch[1]);
      if (!target) return { status: 404, persist: false, error: "That account was not found." };
      return {
        status: 200,
        persist: false,
        user: adminUserView(target),
        ledger: state.ledger.filter((entry) => entry.userId === target.id).slice().reverse().map(ledgerView),
        payments: state.payments.filter((item) => item.userId === target.id).sort(newest).map(paymentView),
        races: state.races.filter((race) => race.userId === target.id).sort(newest).map(summarize),
        audit: state.audit.filter((entry) => (entry.targetType === "user" && entry.targetId === target.id) || entry.data?.userId === target.id).slice(-50).reverse(),
      };
    });
    reply(res, send, result);
    return;
  }

  const statusMatch = pathName.match(/^\/api\/admin\/users\/([a-f0-9]{24})\/status$/);
  if (req.method === "POST" && statusMatch) {
    const body = await readBody(req);
    const status = String(body.status || "");
    const note = String(body.note || "").trim().slice(0, 200);
    if (!USER_STATUSES.includes(status)) {
      send(res, 400, { error: "Choose a valid account status." });
      return;
    }
    const result = await mutate((state) => {
      const target = state.users.find((item) => item.id === statusMatch[1]);
      if (!target) return { status: 404, persist: false, error: "That account was not found." };
      if (target.id === user.id) return { status: 400, persist: false, error: "You cannot change the status of your own account." };
      if (target.status === status && (target.statusNote || "") === note) return { status: 200, persist: false, user: adminUserView(target) };
      target.status = status;
      target.statusNote = status === "active" ? "" : note;
      if (status === "blocked") state.sessions = state.sessions.filter((item) => item.userId !== target.id);
      appendAudit(state, { actorId: user.id, action: "user.status", targetType: "user", targetId: target.id, data: { status, note } });
      return { status: 200, user: adminUserView(target) };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "POST" && pathName === "/api/admin/credits") {
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
      const target = state.users.find((item) => item.id === body.userId);
      if (!target) return { status: 404, persist: false, error: "That account was not found." };
      if ((target.credits || 0) + delta < 0) return { status: 400, persist: false, error: "The balance cannot go below zero." };
      target.credits = (target.credits || 0) + delta;
      const entry = { id: id12(), userId: target.id, type: "adjust", credits: delta, balance: target.credits, note, actorId: user.id, createdAt: Date.now() };
      state.ledger.push(entry);
      appendAudit(state, { actorId: user.id, action: "credits.adjusted", targetType: "user", targetId: target.id, data: { userId: target.id, credits: delta, balance: target.credits, note } });
      return { status: 200, user: adminUserView(target), entry: ledgerView(entry) };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "GET" && pathName === "/api/admin/ledger") {
    const userId = url.searchParams.get("userId") || "";
    const type = url.searchParams.get("type") || "";
    const result = await mutate((state) => {
      const names = new Map(state.users.map((item) => [item.id, item.email]));
      const list = state.ledger
        .filter((entry) => (!userId || entry.userId === userId) && (!type || entry.type === type))
        .filter((entry) => matches(q, entry.note, entry.raceId, entry.paymentId, names.get(entry.userId)))
        .slice()
        .reverse()
        .map((entry) => ({ ...ledgerView(entry), email: names.get(entry.userId) || "" }));
      return { status: 200, persist: false, ...paginate(list, url) };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "GET" && pathName === "/api/admin/payments") {
    const status = url.searchParams.get("status") || "";
    const result = await mutate((state) => {
      const names = new Map(state.users.map((item) => [item.id, item.email]));
      const list = state.payments
        .filter((item) => (!status || item.status === status) && matches(q, item.id, item.gatewayRef, item.packageName, names.get(item.userId)))
        .sort(newest)
        .map((item) => ({ ...paymentView(item), email: names.get(item.userId) || "" }));
      return { status: 200, persist: false, ...paginate(list, url) };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "GET" && pathName === "/api/admin/races") {
    const status = url.searchParams.get("status") || "";
    const result = await mutate((state) => {
      const changed = settleAll(state);
      const names = new Map(state.users.map((item) => [item.id, item.email]));
      const list = state.races
        .filter((race) => (!status || race.status === status))
        .filter((race) => matches(q, race.id, race.name, names.get(race.userId), ...race.entrants.map((entrant) => entrant.name)))
        .sort((a, b) => (b.startedAt || b.createdAt) - (a.startedAt || a.createdAt))
        .map((race) => ({ ...summarize(race), ownerId: race.userId, email: names.get(race.userId) || "", participants: race.entrants.length }));
      const page = paginate(list, url);
      page.items = page.items.map(({ names: _names, places: _places, ...rest }) => rest);
      return { status: 200, persist: changed, ...page };
    });
    reply(res, send, result);
    return;
  }

  const adminRace = pathName.match(/^\/api\/admin\/races\/([A-Za-z0-9_-]{8,32})$/);
  if (req.method === "GET" && adminRace) {
    const result = await mutate((state) => {
      const race = state.races.find((item) => item.id === adminRace[1]);
      if (!race) return { status: 404, persist: false, error: "That race result was not found." };
      const changed = settle(state, race);
      const owner = state.users.find((item) => item.id === race.userId);
      const ledger = state.ledger.filter((entry) => entry.raceId === race.id).map(ledgerView);
      const emails = new Map(state.users.map((item) => [item.id, item.email]));
      return {
        status: 200,
        persist: changed,
        race: {
          ...publicRace(state, race),
          audit: state.audit
            .filter((entry) => entry.targetType === "race" && entry.targetId === race.id)
            .map((entry) => ({ ...entry, actorEmail: emails.get(entry.actorId) || "" })),
          owner: owner ? adminUserView(owner) : null,
          creditUsed: Boolean(race.creditUsed),
          sponsors: race.sponsors || [],
          entrants: raceHasRun(race) ? race.entrants.map(({ name, lane, finishMs, place }) => ({ name, lane, finishMs, place })) : [],
          ledger,
          resultHash: raceHasRun(race) ? resultDigest(race) : "",
        },
        chain: verifyChain(state.audit),
      };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "GET" && pathName === "/api/admin/audit") {
    const action = url.searchParams.get("action") || "";
    const result = await mutate((state) => {
      const emails = new Map(state.users.map((item) => [item.id, item.email]));
      const list = state.audit
        .filter((entry) => (!action || entry.action.startsWith(action)) && matches(q, entry.targetId, entry.action, emails.get(entry.actorId)))
        .slice()
        .reverse()
        .map((entry) => ({ ...entry, actorEmail: emails.get(entry.actorId) || "" }));
      return { status: 200, persist: false, chain: verifyChain(state.audit), ...paginate(list, url) };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "GET" && pathName === "/api/admin/sponsors") {
    const result = await mutate((state) => {
      const emails = new Map(state.users.map((item) => [item.id, item.email]));
      const list = state.sponsors
        .filter((sponsor) => sponsor.scope === "global" || sponsor.active !== false)
        .sort((a, b) => (a.scope === b.scope ? (a.sort || 0) - (b.sort || 0) || newest(a, b) : a.scope === "global" ? -1 : 1))
        .map((sponsor) => ({ ...sponsorView(sponsor), email: emails.get(sponsor.userId) || "" }));
      return { status: 200, persist: false, sponsors: list };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "POST" && pathName === "/api/admin/sponsors") {
    const body = await readBody(req, 2_500_000);
    const name = String(body.name || "").trim().slice(0, 40);
    if (!name) {
      send(res, 400, { error: "Name this sponsor." });
      return;
    }
    const png = decodePng(body.png);
    if (png.error) {
      reply(res, send, png);
      return;
    }
    const id = randomBytes(12).toString("hex");
    await saveImage(id, png.buf);
    const result = await mutate((state) => {
      const now = Date.now();
      const last = state.sponsors.filter((item) => item.scope === "global").reduce((max, item) => Math.max(max, item.sort || 0), 0);
      const sponsor = { id, userId: "", name, scope: "global", active: true, sort: last + 1, createdAt: now, updatedAt: now };
      state.sponsors.push(sponsor);
      appendAudit(state, { actorId: user.id, action: "sponsor.created", targetType: "sponsor", targetId: id, data: { name } });
      return { status: 201, sponsor: sponsorView(sponsor) };
    });
    reply(res, send, result);
    return;
  }

  const adminSponsor = pathName.match(/^\/api\/admin\/sponsors\/([a-f0-9]{24})$/);
  if (req.method === "PATCH" && adminSponsor) {
    const body = await readBody(req, 2_500_000);
    let png = null;
    if (body.png) {
      png = decodePng(body.png);
      if (png.error) {
        reply(res, send, png);
        return;
      }
    }
    const exists = await mutate((state) => ({ persist: false, found: state.sponsors.some((item) => item.id === adminSponsor[1] && SPONSOR_ID.test(item.id)) }));
    if (!exists.found) {
      send(res, 404, { error: "That sponsor image was not found." });
      return;
    }
    if (png) await saveImage(adminSponsor[1], png.buf);
    const result = await mutate((state) => {
      const sponsor = state.sponsors.find((item) => item.id === adminSponsor[1]);
      const changes = {};
      if (body.name != null) {
        const name = String(body.name).trim().slice(0, 40);
        if (!name) return { status: 400, persist: false, error: "Name this sponsor." };
        sponsor.name = name;
        changes.name = name;
      }
      if (body.active != null) {
        sponsor.active = Boolean(body.active);
        changes.active = sponsor.active;
      }
      if (body.sort != null && Number.isInteger(Number(body.sort))) {
        sponsor.sort = Number(body.sort);
        changes.sort = sponsor.sort;
      }
      if (png) changes.image = "replaced";
      sponsor.updatedAt = Date.now();
      appendAudit(state, { actorId: user.id, action: "sponsor.updated", targetType: "sponsor", targetId: sponsor.id, data: changes });
      return { status: 200, sponsor: sponsorView(sponsor) };
    });
    reply(res, send, result);
    return;
  }

  if (req.method === "GET" && pathName === "/api/admin/packages") {
    const result = await mutate((state) => {
      const seeded = ensurePackages(state);
      const list = state.packages.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)).map(packageView);
      return { status: 200, persist: seeded, packages: list, currency: chargeCurrency() };
    });
    reply(res, send, result);
    return;
  }

  const packMatch = pathName.match(/^\/api\/admin\/packages(?:\/([A-Za-z0-9_-]{3,32}))?$/);
  if ((req.method === "POST" && pathName === "/api/admin/packages") || (req.method === "PATCH" && packMatch && packMatch[1])) {
    const body = await readBody(req);
    const creating = req.method === "POST";
    const fields = {};
    if (creating || body.name != null) {
      const name = String(body.name || "").trim();
      if (!name || name.length > 40) {
        send(res, 400, { error: "Give the package a name of up to 40 characters." });
        return;
      }
      fields.name = name;
    }
    if (creating || body.credits != null) {
      const credits = Number(body.credits);
      if (!Number.isInteger(credits) || credits < 1 || credits > 10000) {
        send(res, 400, { error: "Credits must be a whole number from 1 to 10000." });
        return;
      }
      fields.credits = credits;
    }
    if (creating || body.amount != null) {
      const amount = Number(body.amount);
      if (!Number.isInteger(amount) || amount < 100 || amount > 10_000_000) {
        send(res, 400, { error: "The price must be at least 1.00." });
        return;
      }
      fields.amount = amount;
    }
    if (body.active != null) fields.active = Boolean(body.active);
    if (body.sort != null && Number.isInteger(Number(body.sort))) fields.sort = Number(body.sort);
    const result = await mutate((state) => {
      ensurePackages(state);
      let pack;
      if (creating) {
        pack = { id: `pack-${randomBytes(4).toString("hex")}`, active: true, sort: state.packages.length + 1, createdAt: Date.now(), ...fields };
        state.packages.push(pack);
      } else {
        pack = state.packages.find((item) => item.id === packMatch[1]);
        if (!pack) return { status: 404, persist: false, error: "That package was not found." };
        Object.assign(pack, fields);
      }
      appendAudit(state, { actorId: user.id, action: creating ? "package.created" : "package.updated", targetType: "package", targetId: pack.id, data: fields });
      return { status: creating ? 201 : 200, package: packageView(pack) };
    });
    reply(res, send, result);
    return;
  }

  send(res, 404, { error: "Not found." });
}
