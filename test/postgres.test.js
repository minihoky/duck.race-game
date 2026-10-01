import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

// Runs only with TEST_DATABASE_URL pointing at a disposable database. Everything happens inside a rolled-back transaction.
const url = process.env.TEST_DATABASE_URL;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let client;

before(async () => {
  if (!url) return;
  const { default: pg } = await import("pg");
  client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query(readFileSync(path.join(root, "server", "db", "schema.sql"), "utf8"));
  await client.query("BEGIN");
  await client.query("INSERT INTO users (id, email, name, created_at) VALUES ('u_pgtest', 'pgtest@example.com', 'PG', 1)");
  await client.query(
    "INSERT INTO races (id, user_id, name, algorithm, seed, seed_hash, names_hash, params_hash, duration_ms, status, created_at) VALUES ('r_pgtest', 'u_pgtest', 'Race', 'race-v4', 's', 'sh', 'nh', 'ph', 10000, 'ready', 1)"
  );
  await client.query("INSERT INTO race_participants (race_id, lane, name) VALUES ('r_pgtest', 0, 'Ana'), ('r_pgtest', 1, 'Bruno')");
  await client.query(
    "INSERT INTO audit_log (seq, id, at, action, prev_hash, hash) VALUES ((SELECT COALESCE(MAX(seq), 0) + 1 FROM audit_log), 'a_pgtest', 1, 'test', 'p', 'h')"
  );
  await client.query("INSERT INTO ledger (id, user_id, type, credits, balance, race_id, created_at) VALUES ('l_pgtest', 'u_pgtest', 'race', -1, 0, 'r_pgtest', 1)");
});

after(async () => {
  if (!client) return;
  await client.query("ROLLBACK");
  await client.end();
});

async function rejects(sql) {
  await client.query("SAVEPOINT probe");
  try {
    await assert.rejects(client.query(sql));
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT probe");
  }
}

async function allows(sql) {
  await client.query("SAVEPOINT probe");
  await client.query(sql);
  await client.query("RELEASE SAVEPOINT probe");
}

test("committed race parameters cannot change", { skip: !url }, async () => {
  await rejects("UPDATE races SET seed_hash = 'other' WHERE id = 'r_pgtest'");
  await rejects("UPDATE races SET params_hash = 'other' WHERE id = 'r_pgtest'");
  await rejects("UPDATE races SET duration_ms = 20000 WHERE id = 'r_pgtest'");
  await rejects("UPDATE race_participants SET name = 'Intruso' WHERE race_id = 'r_pgtest' AND lane = 0");
  await rejects("DELETE FROM race_participants WHERE race_id = 'r_pgtest'");
  await rejects("DELETE FROM races WHERE id = 'r_pgtest'");
});

test("a result is fixed once written", { skip: !url }, async () => {
  await allows("UPDATE races SET status = 'racing', client_seed = 'c', started_at = 5 WHERE id = 'r_pgtest'");
  await allows("UPDATE race_participants SET place = lane + 1, finish_ms = 10000 + lane WHERE race_id = 'r_pgtest'");
  await rejects("UPDATE races SET client_seed = 'other' WHERE id = 'r_pgtest'");
  await rejects("UPDATE races SET started_at = 6 WHERE id = 'r_pgtest'");
  await rejects("UPDATE races SET status = 'ready' WHERE id = 'r_pgtest'");
  await rejects("UPDATE race_participants SET place = 3 - place WHERE race_id = 'r_pgtest'");
  await allows("UPDATE races SET status = 'finished', finished_at = 10005 WHERE id = 'r_pgtest'");
  await rejects("UPDATE races SET status = 'racing' WHERE id = 'r_pgtest'");
});

test("audit log and ledger are append-only", { skip: !url }, async () => {
  await rejects("UPDATE audit_log SET data = '{\"x\":1}'::jsonb WHERE id = 'a_pgtest'");
  await rejects("DELETE FROM audit_log WHERE id = 'a_pgtest'");
  await rejects("UPDATE ledger SET credits = 99 WHERE id = 'l_pgtest'");
  await rejects("DELETE FROM ledger WHERE id = 'l_pgtest'");
});

test("a race is debited once and balances cannot go negative", { skip: !url }, async () => {
  await rejects("INSERT INTO ledger (id, user_id, type, credits, balance, race_id, created_at) VALUES ('l_pgtest2', 'u_pgtest', 'race', -1, 0, 'r_pgtest', 2)");
  await rejects("UPDATE users SET credits = -1 WHERE id = 'u_pgtest'");
});
