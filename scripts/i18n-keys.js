import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Strings that reach t() through a variable (tables of labels, nav items, animal names).
export const INDIRECT_KEYS = [
  "Home", "Official race", "Race history", "Verify a result", "Credits", "My account", "Administrator",
  "Rabbit", "Frog", "Fish", "Turtle", "Snail", "Meadow", "Marsh", "Stream", "Beach", "Garden",
  "Credit purchase", "Balance adjustment", "Credit activity", "Paid", "Pending", "Not completed",
  "Overview", "Users", "Credit history", "Payments", "Races", "Audit log", "Sponsors", "Packages",
  "Active", "Restricted", "Blocked", "Ready", "Running", "Finished",
  "Account created", "Email verified", "Password reset", "Account status changed", "Credits purchased", "Credits adjusted",
  "Made administrator (development)", "Payment not completed", "Payment amount mismatch",
  "Race finished, seed revealed", "{n} racer", "{n} racers", "{n} credit",
  "Race created", "Race started", "Race finished", "Sponsor added", "Sponsor updated", "Package created", "Package updated",
  "All", "All statuses", "All activity", "All events", "Accounts",
  "Nothing here yet.", "No races yet.", "No payments yet.", "No accounts match.", "No races match.", "No credit activity yet.",
  "No audit entries yet.", "No organizer images.",
  "Race", "Status", "Winner", "Date", "Package", "Amount", "Account", "Created", "Activity", "Balance", "Reference",
  "When", "Event", "By", "Target", "Hash", "Organizer", "Participants", "Place", "Name", "Lane", "Time", "Image", "Added",
  "Price", "Order", "Visible",
  "Race ID", "Algorithm", "Animal", "Started", "Finished", "Credit used", "Names hash", "Parameters hash", "Seed hash",
  "Server seed", "Client seed", "Result hash",
  "Provably fair", "Five animals", "Made to watch live", "Up to 200 names", "Replays and history", "Simple credits",
  "Before each race the server commits to a hidden seed and publishes its hash together with the list of names and race parameters. After the race, anyone can check the result.",
  "Rabbits, frogs, fish, turtles and snails, each with its own scenery. Every participant gets a unique color and accessory.",
  "Tap a racer to follow it, cheer along, and follow the live commentary. The result was decided on the server before the start; the animation only shows it.",
  "Paste a list, remove duplicates, shuffle, or number entries. Each name gets its own lane.",
  "Every finished race stays in your history with its full result, an exact replay, and a public verification page to share.",
  "Setting up is free. One credit is used only when an official race starts. Pay with PIX, card or boleto through Mercado Pago.",
  "Create an account", "Sign up with your email and confirm the link we send.", "Buy credits", "Choose a package. One credit equals one official race.",
  "Set up the race", "Add the names, choose the animal and the duration.", "Start and share", "Run the race live and share the verification link with participants.",
];

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) walk(file, out);
    else if (/\.(jsx?|mjs)$/.test(name)) out.push(file);
  }
  return out;
}

export function literalKeys(dir = path.join(root, "src")) {
  const keys = new Set();
  for (const file of walk(dir, [])) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(JSON.parse(`"${match[1]}"`));
  }
  return keys;
}

export function clientKeys() {
  const keys = literalKeys();
  for (const key of INDIRECT_KEYS) keys.add(key);
  return keys;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { PT } = await import("../src/i18n/pt.js").catch(() => ({ PT: {} }));
  const missing = [...clientKeys()].filter((key) => !(key in PT));
  console.log(missing.join("\n"));
  console.error(`${missing.length} missing`);
}
