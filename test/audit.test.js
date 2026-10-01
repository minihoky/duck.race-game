import assert from "node:assert/strict";
import test from "node:test";
import { GENESIS, appendAudit, entryHash, verifyChain } from "../server/audit.js";
import { emptyState } from "../server/store.js";

function chain(count = 5) {
  const state = emptyState();
  for (let i = 0; i < count; i += 1) {
    appendAudit(state, { actorId: "user", action: "race.created", targetType: "race", targetId: `race-${i}`, data: { n: i, nested: { b: 2, a: 1 } } });
  }
  return state.audit;
}

test("entries are linked by hash", () => {
  const entries = chain();
  assert.equal(entries[0].prevHash, GENESIS);
  for (let i = 1; i < entries.length; i += 1) assert.equal(entries[i].prevHash, entries[i - 1].hash);
  assert.deepEqual(verifyChain(entries), { ok: true, length: 5, head: entries[4].hash });
});

test("editing an old entry breaks the chain", () => {
  const entries = chain();
  entries[1].data.n = 99;
  assert.deepEqual(verifyChain(entries), { ok: false, brokenAt: 2 });
});

test("removing an entry breaks the chain", () => {
  const entries = chain();
  entries.splice(2, 1);
  assert.equal(verifyChain(entries).ok, false);
});

test("rehashing one entry still breaks the link to the next", () => {
  const entries = chain();
  entries[1].data.n = 99;
  entries[1].hash = entryHash(entries[1]);
  assert.deepEqual(verifyChain(entries), { ok: false, brokenAt: 3 });
});

test("key order does not change the hash (PostgreSQL jsonb reorders keys)", () => {
  const entries = chain(1);
  const entry = entries[0];
  const reordered = { hash: entry.hash, prevHash: entry.prevHash, data: { nested: { a: 1, b: 2 }, n: 0 }, targetId: entry.targetId, targetType: entry.targetType, action: entry.action, actorId: entry.actorId, at: entry.at, id: entry.id, seq: entry.seq };
  assert.equal(entryHash(reordered), entry.hash);
  assert.equal(verifyChain([reordered]).ok, true);
});
