const encoder = new TextEncoder();

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function cryptoAvailable() {
  return Boolean(globalThis.crypto && globalThis.crypto.subtle);
}

export async function sha256Hex(text) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

export function namesText(names) {
  return names.join("\n");
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

export function orderLabel({ algorithm, namesHash, paramsHash, clientSeed }) {
  if (algorithm === "race-v4") return `race-v4:order:${paramsHash}:${clientSeed}`;
  if (algorithm === "race-v3") return `race-v3:order:${namesHash}:${clientSeed}`;
  return "race-v2:order";
}

export function randomClientSeed() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

async function seedStream(seed, label) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(seed), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  let counter = 0;
  let block = new DataView(new ArrayBuffer(0));
  let offset = 0;
  return async function nextUint32() {
    if (offset + 4 > block.byteLength) {
      block = new DataView(await crypto.subtle.sign("HMAC", key, encoder.encode(`${label}:${counter}`)));
      counter += 1;
      offset = 0;
    }
    const value = block.getUint32(offset);
    offset += 4;
    return value;
  };
}

async function uniformBelow(next, n) {
  const limit = Math.floor(0x100000000 / n) * n;
  let value = await next();
  while (value >= limit) value = await next();
  return value % n;
}

export async function finishingOrder(count, seed, label) {
  const next = await seedStream(seed, label);
  const order = Array.from({ length: count }, (_, lane) => lane);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = await uniformBelow(next, i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export async function verifyRace(race) {
  const fair = race.fairness;
  const namesHash = await sha256Hex(namesText(race.names));
  const checks = { namesHash: namesHash === fair.namesHash, paramsHash: null, seedHash: null, order: null, audit: null, computed: [] };
  if (fair.algorithm === "race-v4") {
    const params = paramsText({ ...race, namesHash: fair.namesHash, seedHash: fair.seedHash, algorithm: fair.algorithm });
    checks.paramsHash = (await sha256Hex(params)) === fair.paramsHash;
  }
  const created = (race.audit || []).find((entry) => entry.action === "race.created");
  if (created) {
    checks.audit =
      created.data.seedHash === fair.seedHash &&
      created.data.namesHash === fair.namesHash &&
      (fair.algorithm !== "race-v4" || created.data.paramsHash === fair.paramsHash);
  }
  if (!fair.serverSeed) return checks;
  checks.seedHash = (await sha256Hex(fair.serverSeed)) === fair.seedHash;
  const order = await finishingOrder(race.names.length, fair.serverSeed, orderLabel(fair));
  checks.computed = order;
  const official = [...race.places].sort((a, b) => a.place - b.place).map((row) => row.lane);
  checks.order = official.length === order.length && official.every((lane, index) => lane === order[index]);
  return checks;
}
