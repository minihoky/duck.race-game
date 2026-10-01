// Copies a JSON data file (server/data/accounts.json) and its sponsor images into PostgreSQL.
// Usage: DATABASE_URL=postgres://... node scripts/import-json.js [path/to/accounts.json]
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { dataDir, emptyState, openStore } from "../server/store.js";

if (existsSync(".env") && typeof process.loadEnvFile === "function") process.loadEnvFile(".env");

const file = path.resolve(process.argv[2] || path.join(dataDir(), "accounts.json"));
if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL first.");
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const source = JSON.parse(readFileSync(file, "utf8"));
const store = await openStore();
const current = await store.load();
if (current.users.length) {
  console.error("The database already has accounts. Import only runs into an empty database.");
  await store.close();
  process.exit(1);
}

const state = emptyState();
for (const key of Object.keys(state)) if (Array.isArray(source[key])) state[key] = source[key];
const users = new Set(state.users.map((user) => user.id));
for (const key of ["sessions", "ledger", "payments", "races"]) state[key] = state[key].filter((item) => users.has(item.userId));
for (const race of state.races) if (!Array.isArray(race.entrants)) race.entrants = [];

await store.persist(state);

let images = 0;
const imageDir = path.join(path.dirname(file), "sponsors");
for (const sponsor of state.sponsors) {
  const png = path.join(imageDir, `${sponsor.id}.png`);
  if (existsSync(png)) {
    await store.saveImage(sponsor.id, readFileSync(png));
    images += 1;
  }
}

console.log(
  `Imported ${state.users.length} users, ${state.races.length} races, ${state.payments.length} payments, ${state.ledger.length} credit entries, ${state.sponsors.length} sponsors (${images} images).`
);
await store.close();
