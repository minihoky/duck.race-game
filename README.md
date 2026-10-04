# ZooRacing

Prize draws shown as a live animal race (rabbit, frog, fish, turtle, snail). The server decides every result before the start with a published commitment, and anyone can verify it afterwards.

Portuguese (pt-BR) is the default language, with an English toggle. Deployment guide in Portuguese: [docs/IMPLANTACAO.md](docs/IMPLANTACAO.md).

## Features

- **Accounts:** email sign-up with verification, password reset, sessions in an HttpOnly cookie. Administrators can set an account to `active`, `restricted` (can view history but cannot buy credits, create or start races) or `blocked` (cannot sign in; open sessions are dropped).
- **Credits:** packages priced in BRL, paid through Mercado Pago Checkout Pro (PIX, card, boleto). Credits are added only after Mercado Pago confirms the payment, and the server re-checks the amount, currency and reference. Setting up a race is free; starting it uses one credit; replays are free.
- **Official races:** up to 200 names, 10 to 120 seconds, five animals and habitats, a unique skin per participant, sponsor boards (the organizer's own PNGs plus platform sponsors), tap-to-follow camera, live commentary, cheering, sound effects and confetti. The animation only plays back the result the server has already fixed.
- **Provable fairness (`race-v4`):**
  - At creation, the server publishes three SHA-256 hashes: the secret seed, the list of names, and the race parameters (animal, duration, lead-in, creation time, the names hash and the seed hash).
  - At start, the organizer's browser adds a client seed. The order is a Fisher–Yates shuffle driven by HMAC-SHA256 (the key is the server seed; the message is `race-v4:order:<paramsHash>:<clientSeed>:<counter>`), with rejection sampling.
  - After the finish, the seed is revealed. `/verify/:id` recomputes everything in the browser and also prints a standalone Node script.
- **Audit log:** every important action (accounts, credits, payments, races, sponsors, packages) is appended to a SHA-256 hash chain. With PostgreSQL, triggers make the audit log and the credit ledger append-only and lock race parameters and results once written.
- **Administrator panel (`/admin`):**
  - overview and totals
  - users, with search, status changes and credit adjustments
  - credit history, payments, and races with a per-race audit view
  - the audit log, with a chain check
  - platform sponsors: upload, replace, hide, reorder
  - credit packages: create, edit, hide
  - every list has search and pagination
- **My account:** balance, purchase history (with the Mercado Pago reference), credit history, sponsor images, password reset.

## Stack

- React 19, React Router 7, Tailwind 4, Vite 6
- Node ≥ 20.12 using only `node:http`; dependencies are `pg` and `nodemailer`
- PostgreSQL in production; a JSON file (`server/data/accounts.json`) as the local development fallback

```text
server/
  index.js        standalone server: API, plus dist/ with SPA fallback, gzip and security headers
  plugin.js       mounts the same API inside `vite dev` / `vite preview`
  http.js         auth routes, cookies, rate limits, translated errors
  platform.js     races, fairness, credits, payments, sponsors, admin API
  accounts.js     in-memory state with a serialized write queue, persisted through store.js
  store.js        PostgreSQL store (diff-based upserts in one transaction) or JSON file store
  audit.js        hash-chained audit log
  mercadopago.js  Checkout Pro preferences, webhook signature, payment checks
  i18n.js         Portuguese server messages and emails
  db/schema.sql   tables, indexes and integrity triggers (applied automatically at startup)
src/
  pages/          Home, OfficialRace, History, Verify, Credits, Checkout, Dashboard, Admin, legal pages
  race/           canvas engine, motion plan, sprites, commentary, sound
  lib/fairness.js browser-side verification
  i18n/pt.js      Portuguese dictionary (keys are the English strings)
scripts/
  import-json.js  copies a JSON data file into an empty PostgreSQL database
test/             node:test suites
```

## Local development

```bash
npm install
cp .env.example .env     # optional for development
npm run dev              # http://localhost:5173
```

Without `DATABASE_URL`, the data lives in `server/data/`. Without SMTP, the verification and reset links are shown on screen. Without `PAYMENT_GATEWAY`, checkout runs in test mode and charges nothing. If `ADMIN_EMAILS` is empty, the admin page offers a development-only button to make your account an administrator.

Production-like run:

```bash
npm run build
DATABASE_URL=postgres://... npm start          # http://localhost:3000
```

## Tests

```bash
npm test
```

The suites cover:

- fairness: server and browser produce the same order; tampering is detected; the draw is uniform
- credit charging and payment idempotency
- Mercado Pago webhook signatures and amount checks
- the audit chain
- translation coverage, for both interface and server messages
- an end-to-end HTTP flow on a real server: sign-up, verification, purchase, race creation, start, finish, verification, and the admin actions

To run the same flow plus the database trigger tests against PostgreSQL, point `TEST_DATABASE_URL` at an empty, disposable database:

```bash
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/race_test node --test --test-concurrency=1 "test/*.test.js"
```

## Configuration

Every variable is documented in [.env.example](.env.example). The important ones for production:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `DATABASE_SSL` | PostgreSQL. Required in production unless `ALLOW_JSON_STORE=true`. |
| `PUBLIC_APP_URL` | Public https origin, used for email links and Mercado Pago return and webhook URLs. |
| `TRUST_PROXY` | `true` behind Render or Netlify, so client IPs and https detection are correct. |
| `ADMIN_EMAILS` | Comma-separated administrator emails. |
| `PAYMENT_GATEWAY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | Payments. |
| `SMTP_*`, `MAIL_FROM` | Outgoing email. |
| `SITE_NAME`, `VITE_SITE_NAME`, `VITE_SUPPORT_EMAIL` | Branding. `VITE_*` values are baked in at build time. |

## Deployment

- **Render only (simplest):** `render.yaml` is a Blueprint that creates the web service and a PostgreSQL database. The Node server serves both the API and the built frontend.
- **Netlify (frontend) + Render (API):** `netlify.toml` proxies `/api/*` to Render, so the session cookie stays first-party. On Render, set `SERVE_STATIC=false` and set `PUBLIC_APP_URL` to the Netlify domain.

Moving existing JSON data into PostgreSQL: `DATABASE_URL=... npm run db:import` (this only runs into an empty database).

## Limits worth knowing

- The fairness proof shows that the result follows from values committed before the start. It is not an external certification.
- Someone with direct database access (not the admin panel, which never shows unrevealed seeds) who also organizes races could read a seed before the start and choose a client seed. Keep database credentials restricted to the operator.
- The server keeps the working state in memory and writes changes through one queue, so run **one instance**. Scale vertically, not horizontally.
- Refunds are handled manually in Mercado Pago. An administrator can then remove the credits with a negative adjustment, which is recorded in the audit log.
