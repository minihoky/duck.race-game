import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { clientKeys } from "../scripts/i18n-keys.js";
import { SERVER_MESSAGES_PT, mailText } from "../server/i18n.js";
import { PT } from "../src/i18n/pt.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

test("every interface string has a Portuguese translation", () => {
  const missing = [...clientKeys()].filter((key) => !(key in PT));
  assert.deepEqual(missing, []);
});

test("translations keep the same placeholders", () => {
  for (const [key, value] of Object.entries(PT)) assert.deepEqual(placeholders(value), placeholders(key), key);
});

test("every server error message has a Portuguese translation", () => {
  const missing = [];
  const dir = path.join(root, "server");
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".js"))) {
    const source = readFileSync(path.join(dir, name), "utf8");
    for (const match of source.matchAll(/\berror:\s*"((?:[^"\\]|\\.)*)"/g)) {
      const message = JSON.parse(`"${match[1]}"`);
      if (!(message in SERVER_MESSAGES_PT)) missing.push(`${name}: ${message}`);
    }
    for (const match of source.matchAll(/const [A-Z_]+_ERROR = "((?:[^"\\]|\\.)*)"/g)) {
      const message = JSON.parse(`"${match[1]}"`);
      if (!(message in SERVER_MESSAGES_PT)) missing.push(`${name}: ${message}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("emails exist in both languages", () => {
  for (const lang of ["pt", "en"]) {
    assert.ok(mailText(lang, "verifySubject").length > 5);
    assert.match(mailText(lang, "verifyText", "Ana", "https://x/verify"), /https:\/\/x\/verify/);
    assert.match(mailText(lang, "resetText", "Ana", "https://x/reset"), /https:\/\/x\/reset/);
  }
  assert.notEqual(mailText("pt", "resetSubject"), mailText("en", "resetSubject"));
});
