import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const COLLECTIONS = ["users", "sessions", "ledger", "payments", "races", "sponsors", "packages", "audit"];

export function dataDir() {
  return path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "server", "data"));
}

export function emptyState() {
  const state = {};
  for (const name of COLLECTIONS) state[name] = [];
  return state;
}

function normalize(data) {
  const state = data && typeof data === "object" ? data : {};
  for (const name of COLLECTIONS) if (!Array.isArray(state[name])) state[name] = [];
  return state;
}

// Column maps: record field -> [column, type, default]. Fields not listed are kept in `extra`.
const TABLES = {
  users: {
    table: "users",
    key: "id",
    columns: {
      id: ["id", "text", ""],
      email: ["email", "text", ""],
      name: ["name", "text", ""],
      passwordHash: ["password_hash", "text", ""],
      verified: ["verified", "bool", false],
      verifyTokenHash: ["verify_token_hash", "text", ""],
      verifyExpires: ["verify_expires", "int", 0],
      resetTokenHash: ["reset_token_hash", "text", ""],
      resetExpires: ["reset_expires", "int", 0],
      role: ["role", "text", "user"],
      credits: ["credits", "int", 0],
      status: ["status", "text", "active"],
      statusNote: ["status_note", "text", ""],
      createdAt: ["created_at", "int", 0],
    },
  },
  sessions: {
    table: "sessions",
    key: "tokenHash",
    columns: {
      tokenHash: ["token_hash", "text", ""],
      userId: ["user_id", "text", ""],
      expires: ["expires", "int", 0],
    },
    noExtra: true,
  },
  packages: {
    table: "packages",
    key: "id",
    columns: {
      id: ["id", "text", ""],
      name: ["name", "text", ""],
      credits: ["credits", "int", 1],
      amount: ["amount", "int", 1],
      active: ["active", "bool", true],
      sort: ["sort", "int", 0],
      createdAt: ["created_at", "int", 0],
    },
  },
  payments: {
    table: "payments",
    key: "id",
    columns: {
      id: ["id", "text", ""],
      userId: ["user_id", "text", ""],
      packageId: ["package_id", "text", ""],
      packageName: ["package_name", "text", ""],
      credits: ["credits", "int", 0],
      amount: ["amount", "int", 0],
      currency: ["currency", "text", "BRL"],
      status: ["status", "text", "pending"],
      gateway: ["gateway", "text", ""],
      gatewayRef: ["gateway_ref", "text", ""],
      gatewayStatus: ["gateway_status", "text", ""],
      preferenceId: ["preference_id", "text", ""],
      checkoutUrl: ["checkout_url", "text", ""],
      createdAt: ["created_at", "int", 0],
      paidAt: ["paid_at", "int", 0],
    },
  },
  ledger: {
    table: "ledger",
    key: "id",
    appendOnly: true,
    columns: {
      id: ["id", "text", ""],
      userId: ["user_id", "text", ""],
      type: ["type", "text", ""],
      credits: ["credits", "int", 0],
      balance: ["balance", "int", 0],
      note: ["note", "text", ""],
      raceId: ["race_id", "text", ""],
      paymentId: ["payment_id", "text", ""],
      actorId: ["actor_id", "text", ""],
      createdAt: ["created_at", "int", 0],
    },
  },
  races: {
    table: "races",
    key: "id",
    columns: {
      id: ["id", "text", ""],
      userId: ["user_id", "text", ""],
      name: ["name", "text", ""],
      animal: ["animal", "text", "rabbit"],
      algorithm: ["algorithm", "text", ""],
      seed: ["seed", "text", ""],
      seedHash: ["seed_hash", "text", ""],
      namesHash: ["names_hash", "text", ""],
      paramsHash: ["params_hash", "text", ""],
      clientSeed: ["client_seed", "text", ""],
      durationMs: ["duration_ms", "int", 0],
      leadInMs: ["lead_in_ms", "int", 0],
      status: ["status", "text", "ready"],
      creditUsed: ["credit_used", "bool", false],
      sponsors: ["sponsors", "json", []],
      createdAt: ["created_at", "int", 0],
      startedAt: ["started_at", "int", 0],
      finishedAt: ["finished_at", "int", 0],
    },
    children: "entrants",
  },
  sponsors: {
    table: "sponsors",
    key: "id",
    columns: {
      id: ["id", "text", ""],
      userId: ["user_id", "text", ""],
      name: ["name", "text", ""],
      scope: ["scope", "text", "user"],
      active: ["active", "bool", true],
      sort: ["sort", "int", 0],
      createdAt: ["created_at", "int", 0],
      updatedAt: ["updated_at", "int", 0],
    },
  },
  audit: {
    table: "audit_log",
    key: "id",
    appendOnly: true,
    columns: {
      seq: ["seq", "int", 0],
      id: ["id", "text", ""],
      at: ["at", "int", 0],
      actorId: ["actor_id", "text", ""],
      action: ["action", "text", ""],
      targetType: ["target_type", "text", ""],
      targetId: ["target_id", "text", ""],
      data: ["data", "json", {}],
      prevHash: ["prev_hash", "text", ""],
      hash: ["hash", "text", ""],
    },
    noExtra: true,
    order: "seq",
  },
};

// Foreign keys require parents to be written first.
const WRITE_ORDER = ["users", "sessions", "packages", "payments", "ledger", "races", "sponsors", "audit"];

function toColumn(type, value, fallback) {
  if (type === "json") return JSON.stringify(value == null ? fallback : value);
  if (type === "bool") return value == null ? fallback : Boolean(value);
  if (type === "int") {
    const number = Math.round(Number(value));
    return Number.isFinite(number) ? number : fallback;
  }
  return value == null ? fallback : String(value);
}

function toRow(spec, record) {
  const row = {};
  const extra = {};
  for (const [field, [column, type, fallback]] of Object.entries(spec.columns)) row[column] = toColumn(type, record[field], fallback);
  for (const [field, value] of Object.entries(record)) {
    if (spec.columns[field] || field === spec.children) continue;
    if (value !== undefined) extra[field] = value;
  }
  if (!spec.noExtra) row.extra = JSON.stringify(extra);
  return row;
}

function fromRow(spec, row) {
  const record = spec.noExtra ? {} : { ...(row.extra || {}) };
  for (const [field, [column, type]] of Object.entries(spec.columns)) {
    const value = row[column];
    record[field] = type === "int" ? Number(value) : value;
  }
  return record;
}

function signature(record) {
  return JSON.stringify(record);
}

class JsonStore {
  constructor() {
    this.kind = "json";
    this.file = path.join(dataDir(), "accounts.json");
    this.imageDir = path.join(dataDir(), "sponsors");
  }

  async load() {
    try {
      return normalize(JSON.parse(readFileSync(this.file, "utf8")));
    } catch {
      return emptyState();
    }
  }

  async persist(state) {
    mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify(state));
    renameSync(temp, this.file);
  }

  async saveImage(id, buf) {
    mkdirSync(this.imageDir, { recursive: true });
    writeFileSync(path.join(this.imageDir, `${id}.png`), buf);
  }

  async readImage(id) {
    const file = path.join(this.imageDir, `${id}.png`);
    return existsSync(file) ? readFileSync(file) : null;
  }

  async close() {}
}

class PgStore {
  constructor(pool) {
    this.kind = "postgres";
    this.pool = pool;
    this.snapshots = {};
  }

  async migrate() {
    const sql = readFileSync(new URL("./db/schema.sql", import.meta.url), "utf8");
    await this.pool.query(sql);
  }

  async load() {
    const state = emptyState();
    for (const [name, spec] of Object.entries(TABLES)) {
      const order = spec.columns[spec.order || (spec.columns.createdAt ? "createdAt" : spec.key)][0];
      const { rows } = await this.pool.query(`SELECT * FROM ${spec.table} ORDER BY ${order}`);
      state[name] = rows.map((row) => fromRow(spec, row));
    }
    const { rows } = await this.pool.query("SELECT race_id, lane, name, finish_ms, place FROM race_participants ORDER BY race_id, lane");
    const byRace = new Map();
    for (const row of rows) {
      if (!byRace.has(row.race_id)) byRace.set(row.race_id, []);
      byRace.get(row.race_id).push({ name: row.name, lane: row.lane, finishMs: row.finish_ms, place: row.place });
    }
    for (const race of state.races) race.entrants = byRace.get(race.id) || [];
    this.remember(state);
    return state;
  }

  remember(state) {
    for (const name of Object.keys(TABLES)) {
      const spec = TABLES[name];
      this.snapshots[name] = new Map(state[name].map((record) => [record[spec.key], signature(record)]));
    }
  }

  async writeRecord(client, spec, record) {
    const row = toRow(spec, record);
    const columns = Object.keys(row);
    const values = columns.map((column) => row[column]);
    const jsonColumns = new Set(["extra", ...Object.values(spec.columns).filter(([, type]) => type === "json").map(([column]) => column)]);
    const params = columns.map((column, index) => `$${index + 1}${jsonColumns.has(column) ? "::jsonb" : ""}`);
    const keyColumn = spec.columns[spec.key][0];
    const updates = columns.filter((column) => column !== keyColumn).map((column) => `${column} = EXCLUDED.${column}`);
    const conflict = spec.appendOnly || !updates.length ? "DO NOTHING" : `DO UPDATE SET ${updates.join(", ")}`;
    await client.query(`INSERT INTO ${spec.table} (${columns.join(", ")}) VALUES (${params.join(", ")}) ON CONFLICT (${keyColumn}) ${conflict}`, values);
    if (spec.children === "entrants") {
      for (const entrant of record.entrants || []) {
        await client.query(
          `INSERT INTO race_participants (race_id, lane, name, finish_ms, place) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (race_id, lane) DO UPDATE SET finish_ms = EXCLUDED.finish_ms, place = EXCLUDED.place
           WHERE race_participants.finish_ms IS DISTINCT FROM EXCLUDED.finish_ms OR race_participants.place IS DISTINCT FROM EXCLUDED.place`,
          [record.id, Math.round(Number(entrant.lane) || 0), String(entrant.name || ""), Math.round(Number(entrant.finishMs) || 0), Math.round(Number(entrant.place) || 0)]
        );
      }
    }
  }

  async persist(state) {
    const pending = [];
    const removed = [];
    const next = {};
    for (const name of WRITE_ORDER) {
      const spec = TABLES[name];
      const before = this.snapshots[name] || new Map();
      const after = new Map();
      for (const record of state[name]) {
        const key = record[spec.key];
        const sig = signature(record);
        after.set(key, sig);
        if (before.get(key) !== sig) pending.push([spec, record]);
      }
      for (const key of before.keys()) if (!after.has(key)) removed.push([spec, key]);
      next[name] = after;
    }
    if (!pending.length && !removed.length) return;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const [spec, record] of pending) await this.writeRecord(client, spec, record);
      for (const [spec, key] of removed.reverse()) {
        await client.query(`DELETE FROM ${spec.table} WHERE ${spec.columns[spec.key][0]} = $1`, [key]);
      }
      await client.query("COMMIT");
      this.snapshots = next;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async saveImage(id, buf) {
    await this.pool.query(
      "INSERT INTO sponsor_images (id, png, updated_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET png = EXCLUDED.png, updated_at = EXCLUDED.updated_at",
      [id, buf, Date.now()]
    );
  }

  async readImage(id) {
    const { rows } = await this.pool.query("SELECT png FROM sponsor_images WHERE id = $1", [id]);
    return rows.length ? rows[0].png : null;
  }

  async close() {
    await this.pool.end();
  }
}

function sslOption() {
  const mode = String(process.env.DATABASE_SSL || "").trim().toLowerCase();
  if (mode === "require" || mode === "true") return { rejectUnauthorized: true };
  if (mode === "no-verify") return { rejectUnauthorized: false };
  return undefined;
}

export async function openStore() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_JSON_STORE !== "true") {
      throw new Error("DATABASE_URL is required in production. Set ALLOW_JSON_STORE=true only for a single-disk test server.");
    }
    return new JsonStore();
  }
  const { default: pg } = await import("pg");
  pg.types.setTypeParser(20, (value) => Number(value));
  const pool = new pg.Pool({ connectionString: url, ssl: sslOption(), max: Number(process.env.DATABASE_POOL || 5) });
  const store = new PgStore(pool);
  await store.migrate();
  return store;
}

export { TABLES, toRow, fromRow };
