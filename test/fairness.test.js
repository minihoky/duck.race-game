import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { buildEntrants, namesDigest, orderLabel, paramsDigest, paramsText, sha256Hex } from "../server/platform.js";
import * as client from "../src/lib/fairness.js";

function makeRace(algorithm, names) {
  const seed = randomBytes(32).toString("hex");
  const race = {
    id: randomBytes(9).toString("base64url"),
    algorithm,
    animal: "frog",
    seed,
    seedHash: sha256Hex(seed),
    namesHash: namesDigest(names),
    durationMs: 20000,
    leadInMs: 3000,
    createdAt: 1_790_000_000_000,
    clientSeed: "browser-seed_42",
    paramsHash: "",
  };
  if (algorithm === "race-v4") race.paramsHash = paramsDigest(race);
  race.entrants = buildEntrants(names, seed, race.durationMs, orderLabel(race));
  return race;
}

function publicView(race, names) {
  return {
    id: race.id,
    animal: race.animal,
    durationMs: race.durationMs,
    leadInMs: race.leadInMs,
    createdAt: race.createdAt,
    names,
    places: race.entrants.map(({ lane, place }) => ({ lane, place })),
    algorithm: race.algorithm,
    fairness: {
      algorithm: race.algorithm,
      seedHash: race.seedHash,
      namesHash: race.namesHash,
      paramsHash: race.paramsHash,
      clientSeed: race.clientSeed,
      serverSeed: race.seed,
    },
    audit: [{ action: "race.created", data: { seedHash: race.seedHash, namesHash: race.namesHash, paramsHash: race.paramsHash } }],
  };
}

const NAMES = Array.from({ length: 37 }, (_, index) => `Pessoa ${index + 1}`);

for (const algorithm of ["race-v3", "race-v4"]) {
  test(`${algorithm}: the browser check reproduces the server order`, async () => {
    for (let round = 0; round < 10; round += 1) {
      const race = makeRace(algorithm, NAMES);
      const checks = await client.verifyRace(publicView(race, NAMES));
      assert.equal(checks.namesHash, true);
      assert.equal(checks.seedHash, true);
      assert.equal(checks.order, true);
      assert.equal(checks.audit, true);
      if (algorithm === "race-v4") assert.equal(checks.paramsHash, true);
    }
  });
}

test("every place is used exactly once and the winner finishes first", () => {
  const race = makeRace("race-v4", NAMES);
  const places = race.entrants.map((entrant) => entrant.place).sort((a, b) => a - b);
  assert.deepEqual(places, NAMES.map((_, index) => index + 1));
  const winner = race.entrants.find((entrant) => entrant.place === 1);
  assert.equal(winner.finishMs, race.durationMs);
  for (const entrant of race.entrants) assert.ok(entrant.finishMs >= winner.finishMs);
});

test("client and server build the same parameter text", () => {
  const race = makeRace("race-v4", NAMES);
  assert.equal(client.paramsText(race), paramsText(race));
  assert.equal(client.orderLabel(race), orderLabel(race));
});

test("tampering is detected", async () => {
  const race = makeRace("race-v4", NAMES);
  const view = publicView(race, NAMES);

  const renamed = await client.verifyRace({ ...view, names: [...NAMES.slice(0, -1), "Intruso"] });
  assert.equal(renamed.namesHash, false);

  const longer = await client.verifyRace({ ...view, durationMs: 30000 });
  assert.equal(longer.paramsHash, false);

  const otherSeed = await client.verifyRace({ ...view, fairness: { ...view.fairness, serverSeed: randomBytes(32).toString("hex") } });
  assert.equal(otherSeed.seedHash, false);

  const swapped = view.places.map((row) => ({ ...row, place: row.place === 1 ? 2 : row.place === 2 ? 1 : row.place }));
  const reordered = await client.verifyRace({ ...view, places: swapped });
  assert.equal(reordered.order, false);

  const otherClient = await client.verifyRace({ ...view, fairness: { ...view.fairness, clientSeed: "different" } });
  assert.equal(otherClient.order, false);

  const audit = await client.verifyRace({ ...view, audit: [{ action: "race.created", data: { ...view.audit[0].data, seedHash: "0".repeat(64) } }] });
  assert.equal(audit.audit, false);
});

test("the order is roughly uniform", () => {
  const names = ["A", "B", "C", "D"];
  const wins = [0, 0, 0, 0];
  const rounds = 4000;
  for (let i = 0; i < rounds; i += 1) {
    const entrants = buildEntrants(names, `seed-${i}`, 10000, `race-v4:order:x:${i}`);
    wins[entrants.find((entrant) => entrant.place === 1).lane] += 1;
  }
  for (const count of wins) assert.ok(Math.abs(count - rounds / 4) < rounds * 0.05, `wins ${wins.join(",")}`);
});
