import { createHash, randomBytes } from "node:crypto";

export const GENESIS = "0".repeat(64);

// Keys are sorted so the hash survives storage engines that reorder object keys (PostgreSQL jsonb).
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

function canonical(entry) {
  return stable({
    seq: entry.seq,
    id: entry.id,
    at: entry.at,
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    data: entry.data,
    prevHash: entry.prevHash,
  });
}

export function entryHash(entry) {
  return createHash("sha256").update(canonical(entry), "utf8").digest("hex");
}

export function appendAudit(state, { actorId = "", action, targetType = "", targetId = "", data = {}, at = Date.now() }) {
  const last = state.audit[state.audit.length - 1];
  const entry = {
    seq: last ? last.seq + 1 : 1,
    id: randomBytes(9).toString("base64url"),
    at,
    actorId: String(actorId || ""),
    action,
    targetType,
    targetId: String(targetId || ""),
    data: JSON.parse(JSON.stringify(data ?? {})),
    prevHash: last ? last.hash : GENESIS,
  };
  entry.hash = entryHash(entry);
  state.audit.push(entry);
  return entry;
}

export function verifyChain(entries) {
  let prev = GENESIS;
  let seq = 0;
  for (const entry of entries) {
    if (entry.seq !== seq + 1 || entry.prevHash !== prev || entryHash(entry) !== entry.hash) {
      return { ok: false, brokenAt: entry.seq };
    }
    prev = entry.hash;
    seq = entry.seq;
  }
  return { ok: true, length: entries.length, head: prev };
}
