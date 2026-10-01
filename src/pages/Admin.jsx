import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { publishAccount } from "../lib/auth";
import { readPngFile } from "../lib/files";
import { formatExact, formatMoney, formatWhen } from "../lib/format";
import { useT } from "../lib/i18n";
import { usePageTitle } from "../lib/usePageTitle";
import { LEDGER_LABELS, PAYMENT_STATUS } from "./Dashboard";

const TABS = [
  ["overview", "Overview"],
  ["users", "Users"],
  ["ledger", "Credit history"],
  ["payments", "Payments"],
  ["races", "Races"],
  ["audit", "Audit log"],
  ["sponsors", "Sponsors"],
  ["packages", "Packages"],
];

const USER_STATUS = { active: "Active", restricted: "Restricted", blocked: "Blocked" };
const RACE_STATUS = { ready: "Ready", running: "Running", finished: "Finished" };

export const AUDIT_LABELS = {
  "user.registered": "Account created",
  "user.verified": "Email verified",
  "user.password_reset": "Password reset",
  "user.status": "Account status changed",
  "user.dev_admin": "Made administrator (development)",
  "payment.failed": "Payment not completed",
  "payment.amount_mismatch": "Payment amount mismatch",
  "credits.purchased": "Credits purchased",
  "credits.adjusted": "Credits adjusted",
  "race.created": "Race created",
  "race.started": "Race started",
  "race.finished": "Race finished",
  "sponsor.created": "Sponsor added",
  "sponsor.updated": "Sponsor updated",
  "package.created": "Package created",
  "package.updated": "Package updated",
};

const input = "rounded-xl border border-gray-200 px-3 py-2 text-sm";
const button = "rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const soft = "rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold disabled:opacity-50";

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== "" && value != null) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : "";
}

export default function Admin() {
  const { t } = useT();
  const [gate, setGate] = useState("loading");
  const [canSignUp, setCanSignUp] = useState(false);
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get("tab") || "overview");
  const [focusUser, setFocusUser] = useState("");
  const [focusRace, setFocusRace] = useState("");
  usePageTitle(t("Administrator"));

  async function load() {
    try {
      const account = await api("/api/account");
      setMe(account.user);
      if (account.user?.role !== "admin") {
        setCanSignUp(Boolean(account.devAdminAvailable));
        setGate("denied");
        return;
      }
      setError("");
      setGate("ready");
    } catch (err) {
      if (err.status === 401) {
        setGate("signin");
        return;
      }
      setError(err.message);
      setGate("denied");
    }
  }

  useEffect(() => {
    load();
    function onAccount() {
      load();
    }
    window.addEventListener("duck-signin-closed", onAccount);
    return () => window.removeEventListener("duck-signin-closed", onAccount);
  }, []);

  async function signUpAdmin() {
    setError("");
    setPending(true);
    try {
      const result = await api("/api/account/dev-admin", { method: "POST", body: {} });
      publishAccount(result.user);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  function go(next) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  function openUser(id) {
    setFocusUser(id);
    go("users");
  }

  function openRace(id) {
    setFocusRace(id);
    go("races");
  }

  if (gate === "loading") return <p className="px-4 pb-16 pt-24 text-center text-gray-500">{t("Loading…")}</p>;

  if (gate === "signin") {
    return (
      <div className="mx-auto max-w-lg px-4 pb-16 pt-24 text-center">
        <h1 className="text-3xl font-bold">{t("Administrator")}</h1>
        <p className="mt-3 text-gray-600">{t("Sign in with an administrator account.")}</p>
        <button type="button" className={`${button} mt-6`} onClick={() => window.dispatchEvent(new Event("duck-open-signin"))}>
          {t("Sign in")}
        </button>
      </div>
    );
  }

  if (gate === "denied") {
    return (
      <div className="mx-auto max-w-lg px-4 pb-16 pt-24 text-center">
        <h1 className="text-3xl font-bold">{t("Administrator")}</h1>
        <p className="mt-3 text-gray-600">{t("This account is not an administrator. Administrators are set with ADMIN_EMAILS on the server.")}</p>
        {canSignUp && (
          <button type="button" className={`${button} mt-6`} onClick={signUpAdmin} disabled={pending}>
            {t("Make this account an administrator (development only)")}
          </button>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-20">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">{t("Administrator")}</p>
      <h1 className="mt-1 text-3xl font-bold">{t("Control panel")}</h1>
      <nav className="mt-6 flex flex-wrap gap-2 border-b border-gray-100 pb-3" aria-label={t("Administrator")}>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => go(id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === id ? "bg-sky-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            {t(label)}
          </button>
        ))}
      </nav>
      <div className="mt-6">
        {tab === "overview" && <Overview openRace={openRace} />}
        {tab === "users" && <Users meId={me?.id} focus={focusUser} setFocus={setFocusUser} openRace={openRace} />}
        {tab === "ledger" && <Ledger openUser={openUser} />}
        {tab === "payments" && <Payments openUser={openUser} />}
        {tab === "races" && <Races focus={focusRace} setFocus={setFocusRace} openUser={openUser} />}
        {tab === "audit" && <Audit openUser={openUser} openRace={openRace} />}
        {tab === "sponsors" && <Sponsors />}
        {tab === "packages" && <Packages />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function useList(path, params) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const key = path + query(params);
  const reload = useCallback(async () => {
    try {
      setData(await api(key));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [key]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload };
}

function Pager({ data, page, setPage }) {
  const { t } = useT();
  if (!data || data.pages <= 1) return data ? <p className="mt-3 text-xs text-gray-500">{t("{n} results", { n: data.total })}</p> : null;
  return (
    <div className="mt-4 flex items-center gap-3 text-sm">
      <button type="button" className={soft} disabled={page <= 1} onClick={() => setPage(page - 1)}>
        {t("Previous")}
      </button>
      <span className="text-gray-600">{t("Page {page} of {pages} · {n} results", { page: data.page, pages: data.pages, n: data.total })}</span>
      <button type="button" className={soft} disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
        {t("Next")}
      </button>
    </div>
  );
}

function Search({ value, onChange, placeholder, children }) {
  const { t } = useT();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input className={`${input} min-w-64 flex-1`} type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder || t("Search")} />
      {children}
    </div>
  );
}

function Select({ value, onChange, options, all }) {
  const { t } = useT();
  return (
    <select className={input} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{t(all || "All")}</option>
      {Object.entries(options).map(([id, label]) => (
        <option key={id} value={id}>
          {t(label)}
        </option>
      ))}
    </select>
  );
}

function Table({ head, children, empty }) {
  const { t } = useT();
  const rows = Array.isArray(children) ? children.filter(Boolean) : children;
  if (Array.isArray(rows) && rows.length === 0) return <p className="rounded-2xl bg-gray-50 px-4 py-8 text-center text-gray-500">{t(empty || "Nothing here yet.")}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            {head.map((label) => (
              <th key={label} className="whitespace-nowrap px-4 py-3 font-medium">
                {t(label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

function Cell({ children, className = "" }) {
  return <td className={`border-t border-gray-100 px-4 py-3 align-top ${className}`}>{children}</td>;
}

function Badge({ tone = "gray", children }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
    sky: "bg-sky-50 text-sky-700",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function statusTone(status) {
  return { active: "green", paid: "green", finished: "green", restricted: "amber", pending: "amber", running: "sky", ready: "gray", blocked: "red", failed: "red" }[status] || "gray";
}

function ChainStatus({ chain }) {
  const { t } = useT();
  if (!chain) return null;
  return chain.ok ? (
    <Badge tone="green">{t("Audit chain intact · {n} entries", { n: chain.length })}</Badge>
  ) : (
    <Badge tone="red">{t("Audit chain broken at entry {n}", { n: chain.brokenAt })}</Badge>
  );
}

function Delta({ value }) {
  return <span className={`font-semibold ${value < 0 ? "text-gray-800" : "text-emerald-700"}`}>{value > 0 ? `+${value}` : value}</span>;
}

// ---------------------------------------------------------------------------

function Overview({ openRace }) {
  const { t } = useT();
  const { data, error } = useList("/api/admin/overview", {});
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-gray-500">{t("Loading…")}</p>;
  const totals = data.totals;
  const revenue = Object.entries(totals.revenue);
  const cards = [
    [t("Accounts"), totals.users, t("{blocked} blocked · {restricted} restricted", totals)],
    [t("Official races"), totals.races, t("{n} finished", { n: totals.finished })],
    [t("Credits sold"), totals.creditsSold, t("{n} used · {left} on balances", { n: totals.creditsUsed, left: totals.creditsOutstanding })],
    [t("Revenue"), revenue.length ? revenue.map(([currency, amount]) => formatMoney(amount, currency)).join(" · ") : formatMoney(0), t("{n} pending payments", { n: totals.paymentsPending })],
  ];
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl bg-gray-50 p-5">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-gray-500">{hint}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <ChainStatus chain={data.audit} />
        <Badge tone="sky">{t("Storage: {kind}", { kind: data.store === "postgres" ? "PostgreSQL" : t("JSON file") })}</Badge>
        <Badge tone={data.gateway === "mercadopago" ? "green" : "amber"}>
          {t("Payments: {mode}", { mode: data.gateway === "mercadopago" ? "Mercado Pago" : data.gateway === "demo" ? t("test mode") : t("not configured") })}
        </Badge>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-bold">{t("Recent races")}</h2>
          <Table head={["Race", "Status", "Winner"]} empty="No races yet.">
            {data.recentRaces.map((race) => (
              <tr key={race.id}>
                <Cell>
                  <button type="button" className="text-left font-semibold text-sky-600" onClick={() => openRace(race.id)}>
                    {race.name}
                  </button>
                  <span className="block text-xs text-gray-500">{formatWhen(race.startedAt || race.createdAt)}</span>
                </Cell>
                <Cell>
                  <Badge tone={statusTone(race.status)}>{t(RACE_STATUS[race.status] || race.status)}</Badge>
                </Cell>
                <Cell>{race.winner || "—"}</Cell>
              </tr>
            ))}
          </Table>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-bold">{t("Recent payments")}</h2>
          <Table head={["Date", "Package", "Amount", "Status"]} empty="No payments yet.">
            {data.recentPayments.map((payment) => (
              <tr key={payment.id}>
                <Cell className="whitespace-nowrap">{formatWhen(payment.createdAt)}</Cell>
                <Cell>{payment.packageName}</Cell>
                <Cell>{formatMoney(payment.amount, payment.currency)}</Cell>
                <Cell>
                  <Badge tone={statusTone(payment.status)}>{t(PAYMENT_STATUS[payment.status] || payment.status)}</Badge>
                  {payment.demo && <span className="ml-1 text-xs text-gray-500">({t("test")})</span>}
                </Cell>
              </tr>
            ))}
          </Table>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Users({ meId, focus, setFocus, openRace }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, reload } = useList("/api/admin/users", { q, status, page });

  if (focus) return <UserDetail id={focus} meId={meId} close={() => { setFocus(""); reload(); }} openRace={openRace} />;

  return (
    <div>
      <Search value={q} onChange={(value) => { setQ(value); setPage(1); }} placeholder={t("Search by name, email or ID")}>
        <Select value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={USER_STATUS} all="All statuses" />
      </Search>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {data && (
        <Table head={["Account", "Status", "Credits", "Created", ""]} empty="No accounts match.">
          {data.items.map((user) => (
            <tr key={user.id}>
              <Cell>
                <span className="font-semibold">{user.name}</span>
                {user.role === "admin" && <Badge tone="sky">{t("admin")}</Badge>}
                <span className="block text-gray-500">{user.email}</span>
                {!user.verified && <span className="text-xs text-amber-700">{t("Email not verified")}</span>}
              </Cell>
              <Cell>
                <Badge tone={statusTone(user.status)}>{t(USER_STATUS[user.status] || user.status)}</Badge>
                {user.statusNote && <span className="block text-xs text-gray-500">{user.statusNote}</span>}
              </Cell>
              <Cell className="font-semibold">{user.credits}</Cell>
              <Cell className="whitespace-nowrap">{formatWhen(user.createdAt)}</Cell>
              <Cell>
                <button type="button" className={soft} onClick={() => setFocus(user.id)}>
                  {t("Manage")}
                </button>
              </Cell>
            </tr>
          ))}
        </Table>
      )}
      <Pager data={data} page={page} setPage={setPage} />
    </div>
  );
}

function UserDetail({ id, meId, close, openRace }) {
  const { t } = useT();
  const { data, error, reload } = useList(`/api/admin/users/${id}`, {});
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [credits, setCredits] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");

  useEffect(() => {
    if (!data) return;
    setStatus(data.user.status);
    setNote(data.user.statusNote);
  }, [data]);

  async function run(action, done) {
    setPending(true);
    setProblem("");
    setMessage("");
    try {
      await action();
      setMessage(done);
      await reload();
    } catch (err) {
      setProblem(err.message);
    } finally {
      setPending(false);
    }
  }

  function saveStatus(event) {
    event.preventDefault();
    run(() => api(`/api/admin/users/${id}/status`, { method: "POST", body: { status, note } }), t("Account status saved."));
  }

  function adjust(event) {
    event.preventDefault();
    run(async () => {
      await api("/api/admin/credits", { method: "POST", body: { userId: id, credits: Number(credits), note: creditNote } });
      setCredits("");
      setCreditNote("");
    }, t("Balance updated."));
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-gray-500">{t("Loading…")}</p>;
  const user = data.user;
  const self = user.id === meId;

  return (
    <div>
      <button type="button" className="mb-4 text-sm font-semibold text-sky-600" onClick={close}>
        ← {t("All accounts")}
      </button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{user.name}</h2>
          <p className="text-gray-500">
            {user.email} · <span className="font-mono text-xs">{user.id}</span>
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {t("Created {when}", { when: formatWhen(user.createdAt) })} · {user.verified ? t("Email verified") : t("Email not verified")}
          </p>
        </div>
        <div className="rounded-2xl bg-sky-50 px-5 py-3 text-right">
          <p className="text-sm text-sky-700">{t("Credits")}</p>
          <p className="text-3xl font-bold text-sky-950">{user.credits}</p>
        </div>
      </div>
      {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}
      {problem && <p className="mt-4 text-sm text-red-600">{problem}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <form onSubmit={saveStatus} className="rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold">{t("Account status")}</h3>
          <p className="mt-1 text-xs text-gray-500">{t("Restricted accounts can sign in and view history but cannot buy credits, create, or start races. Blocked accounts cannot sign in.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(USER_STATUS).map(([value, label]) => (
              <label key={value} className={`cursor-pointer rounded-xl border px-3 py-1.5 text-sm ${status === value ? "border-sky-500 bg-sky-50" : "border-gray-200"}`}>
                <input type="radio" className="sr-only" name="status" value={value} checked={status === value} onChange={() => setStatus(value)} disabled={self} />
                {t(label)}
              </label>
            ))}
          </div>
          <input className={`${input} mt-3 w-full`} value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} placeholder={t("Reason (shown to the user)")} disabled={self || status === "active"} />
          <button type="submit" className={`${button} mt-3`} disabled={pending || self}>
            {t("Save status")}
          </button>
          {self && <p className="mt-2 text-xs text-gray-500">{t("You cannot change the status of your own account.")}</p>}
        </form>

        <form onSubmit={adjust} className="rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold">{t("Adjust credits")}</h3>
          <p className="mt-1 text-xs text-gray-500">{t("Use a negative number to remove credits. Every adjustment is recorded with your account and note.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input className={`${input} w-28`} type="number" step="1" min="-1000" max="1000" value={credits} onChange={(event) => setCredits(event.target.value)} placeholder="+10" required />
            <input className={`${input} min-w-48 flex-1`} value={creditNote} maxLength={120} onChange={(event) => setCreditNote(event.target.value)} placeholder={t("Note (required)")} required />
          </div>
          <button type="submit" className={`${button} mt-3`} disabled={pending}>
            {t("Apply")}
          </button>
        </form>
      </div>

      <section className="mt-8">
        <h3 className="mb-3 text-lg font-bold">{t("Credit history")}</h3>
        <LedgerTable items={data.ledger} />
      </section>
      <section className="mt-8">
        <h3 className="mb-3 text-lg font-bold">{t("Purchases")}</h3>
        <PaymentTable items={data.payments} />
      </section>
      <section className="mt-8">
        <h3 className="mb-3 text-lg font-bold">{t("Races")}</h3>
        <Table head={["Race", "Status", "Winner", "Date"]} empty="No races yet.">
          {data.races.map((race) => (
            <tr key={race.id}>
              <Cell>
                <button type="button" className="text-left font-semibold text-sky-600" onClick={() => openRace(race.id)}>
                  {race.name}
                </button>
              </Cell>
              <Cell>
                <Badge tone={statusTone(race.status)}>{t(RACE_STATUS[race.status] || race.status)}</Badge>
              </Cell>
              <Cell>{race.winner || "—"}</Cell>
              <Cell className="whitespace-nowrap">{formatWhen(race.startedAt || race.createdAt)}</Cell>
            </tr>
          ))}
        </Table>
      </section>
      <section className="mt-8">
        <h3 className="mb-3 text-lg font-bold">{t("Audit log")}</h3>
        <AuditTable items={data.audit} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function LedgerTable({ items, openUser }) {
  const { t } = useT();
  return (
    <Table head={["Date", openUser ? "Account" : "", "Activity", "Credits", "Balance"].filter(Boolean)} empty="No credit activity yet.">
      {items.map((entry) => (
        <tr key={entry.id}>
          <Cell className="whitespace-nowrap">{formatWhen(entry.createdAt)}</Cell>
          {openUser && (
            <Cell>
              <button type="button" className="text-left text-sky-600" onClick={() => openUser(entry.userId)}>
                {entry.email || entry.userId}
              </button>
            </Cell>
          )}
          <Cell>
            <span className="font-medium">{t(LEDGER_LABELS[entry.type] || "Credit activity")}</span>
            {entry.note && <span className="block text-gray-500">{entry.note}</span>}
            {entry.raceId && <span className="block font-mono text-xs text-gray-500">{entry.raceId}</span>}
            {entry.paymentId && <span className="block font-mono text-xs text-gray-500">{entry.paymentId}</span>}
          </Cell>
          <Cell>
            <Delta value={entry.credits} />
          </Cell>
          <Cell>{entry.balance}</Cell>
        </tr>
      ))}
    </Table>
  );
}

function PaymentTable({ items, openUser }) {
  const { t } = useT();
  return (
    <Table head={["Date", openUser ? "Account" : "", "Package", "Amount", "Status", "Reference"].filter(Boolean)} empty="No payments yet.">
      {items.map((payment) => (
        <tr key={payment.id}>
          <Cell className="whitespace-nowrap">
            {formatWhen(payment.createdAt)}
            {payment.paidAt && <span className="block text-xs text-gray-500">{t("Paid {when}", { when: formatWhen(payment.paidAt) })}</span>}
          </Cell>
          {openUser && (
            <Cell>
              <button type="button" className="text-left text-sky-600" onClick={() => openUser(payment.userId)}>
                {payment.email || payment.userId}
              </button>
            </Cell>
          )}
          <Cell>
            {payment.packageName}
            <span className="block text-xs text-gray-500">{t("{n} credits", { n: payment.credits })}</span>
          </Cell>
          <Cell>{formatMoney(payment.amount, payment.currency)}</Cell>
          <Cell>
            <Badge tone={statusTone(payment.status)}>{t(PAYMENT_STATUS[payment.status] || payment.status)}</Badge>
            {payment.demo && <span className="ml-1 text-xs text-gray-500">({t("test")})</span>}
            {payment.gatewayStatus && <span className="block text-xs text-gray-500">{payment.gatewayStatus}</span>}
          </Cell>
          <Cell className="font-mono text-xs text-gray-500">
            {payment.id}
            {payment.gatewayRef && payment.gateway === "mercadopago" && <span className="block">MP {payment.gatewayRef}</span>}
          </Cell>
        </tr>
      ))}
    </Table>
  );
}

function AuditTable({ items, openUser, openRace }) {
  const { t } = useT();
  return (
    <Table head={["When", "Event", "By", "Target", "Hash"]} empty="No audit entries yet.">
      {items.map((entry) => (
        <tr key={entry.id}>
          <Cell className="whitespace-nowrap">
            <span className="font-mono text-xs text-gray-400">#{entry.seq}</span>
            <span className="block">{formatExact(entry.at)}</span>
          </Cell>
          <Cell>
            <span className="font-medium">{t(AUDIT_LABELS[entry.action] || entry.action)}</span>
            <AuditData data={entry.data} />
          </Cell>
          <Cell className="text-xs">
            {entry.actorId ? (
              openUser ? (
                <button type="button" className="text-left text-sky-600" onClick={() => openUser(entry.actorId)}>
                  {entry.actorEmail || entry.actorId}
                </button>
              ) : (
                entry.actorEmail || entry.actorId
              )
            ) : (
              t("system")
            )}
          </Cell>
          <Cell className="text-xs">
            {entry.targetType === "race" && openRace ? (
              <button type="button" className="font-mono text-sky-600" onClick={() => openRace(entry.targetId)}>
                {entry.targetId}
              </button>
            ) : entry.targetType === "user" && openUser ? (
              <button type="button" className="font-mono text-sky-600" onClick={() => openUser(entry.targetId)}>
                {entry.targetId}
              </button>
            ) : (
              <span className="font-mono">{entry.targetId}</span>
            )}
            <span className="block text-gray-400">{entry.targetType}</span>
          </Cell>
          <Cell className="font-mono text-xs text-gray-400" title={entry.hash}>
            {entry.hash.slice(0, 12)}…
          </Cell>
        </tr>
      ))}
    </Table>
  );
}

function AuditData({ data }) {
  const entries = Object.entries(data || {}).filter(([, value]) => value !== "" && value != null);
  if (entries.length === 0) return null;
  return (
    <dl className="mt-1 space-y-0.5 text-xs text-gray-500">
      {entries.slice(0, 8).map(([key, value]) => (
        <div key={key} className="flex gap-1">
          <dt className="shrink-0">{key}:</dt>
          <dd className="break-all font-mono">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------

function Ledger({ openUser }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = useList("/api/admin/ledger", { q, type, page });
  return (
    <div>
      <Search value={q} onChange={(value) => { setQ(value); setPage(1); }} placeholder={t("Search by email, note, race or payment")}>
        <Select value={type} onChange={(value) => { setType(value); setPage(1); }} options={LEDGER_LABELS} all="All activity" />
      </Search>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {data && <LedgerTable items={data.items} openUser={openUser} />}
      <Pager data={data} page={page} setPage={setPage} />
    </div>
  );
}

function Payments({ openUser }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = useList("/api/admin/payments", { q, status, page });
  return (
    <div>
      <Search value={q} onChange={(value) => { setQ(value); setPage(1); }} placeholder={t("Search by email, payment or Mercado Pago reference")}>
        <Select value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={PAYMENT_STATUS} all="All statuses" />
      </Search>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {data && <PaymentTable items={data.items} openUser={openUser} />}
      <Pager data={data} page={page} setPage={setPage} />
    </div>
  );
}

function Races({ focus, setFocus, openUser }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = useList("/api/admin/races", { q, status, page });

  if (focus) return <RaceDetail id={focus} close={() => setFocus("")} openUser={openUser} />;

  return (
    <div>
      <Search value={q} onChange={(value) => { setQ(value); setPage(1); }} placeholder={t("Search by race, ID, email or participant")}>
        <Select value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={RACE_STATUS} all="All statuses" />
      </Search>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {data && (
        <Table head={["Race", "Organizer", "Participants", "Status", "Winner", ""]} empty="No races match.">
          {data.items.map((race) => (
            <tr key={race.id}>
              <Cell>
                <span className="font-semibold">{race.name}</span>
                <span className="block font-mono text-xs text-gray-500">{race.id}</span>
                <span className="block text-xs text-gray-500">{formatWhen(race.startedAt || race.createdAt)}</span>
              </Cell>
              <Cell>
                <button type="button" className="text-left text-sky-600" onClick={() => openUser(race.ownerId)}>
                  {race.email || race.ownerId}
                </button>
              </Cell>
              <Cell>{race.participants}</Cell>
              <Cell>
                <Badge tone={statusTone(race.status)}>{t(RACE_STATUS[race.status] || race.status)}</Badge>
              </Cell>
              <Cell>{race.winner || "—"}</Cell>
              <Cell>
                <button type="button" className={soft} onClick={() => setFocus(race.id)}>
                  {t("Audit")}
                </button>
              </Cell>
            </tr>
          ))}
        </Table>
      )}
      <Pager data={data} page={page} setPage={setPage} />
    </div>
  );
}

function RaceDetail({ id, close, openUser }) {
  const { t } = useT();
  const { data, error } = useList(`/api/admin/races/${id}`, {});
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-gray-500">{t("Loading…")}</p>;
  const race = data.race;
  const fair = race.fairness || {};
  const facts = [
    ["Race ID", race.id],
    ["Algorithm", race.algorithm],
    ["Animal", race.animal],
    ["Created", race.createdAt ? formatExact(race.createdAt) : "—"],
    ["Started", race.startedAt ? formatExact(race.startedAt) : "—"],
    ["Finished", race.finishedAt ? formatExact(race.finishedAt) : "—"],
    ["Credit used", race.creditUsed ? t("Yes") : t("No")],
    ["Names hash", fair.namesHash || "—"],
    ["Parameters hash", fair.paramsHash || "—"],
    ["Seed hash", fair.seedHash || "—"],
    ["Server seed", fair.serverSeed || t("Revealed after the race finishes")],
    ["Client seed", fair.clientSeed || "—"],
    ["Result hash", race.resultHash || "—"],
  ];
  return (
    <div>
      <button type="button" className="mb-4 text-sm font-semibold text-sky-600" onClick={close}>
        ← {t("All races")}
      </button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{race.name}</h2>
          {race.owner && (
            <button type="button" className="text-sm text-sky-600" onClick={() => openUser(race.owner.id)}>
              {race.owner.name} · {race.owner.email}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(race.status)}>{t(RACE_STATUS[race.status] || race.status)}</Badge>
          <ChainStatus chain={data.chain} />
          <Link className={soft} to={`/verify/${race.id}`}>
            {t("Public verification")}
          </Link>
        </div>
      </div>

      <dl className="mt-6 grid gap-x-6 gap-y-2 rounded-2xl border border-gray-100 p-5 text-sm sm:grid-cols-[180px_minmax(0,1fr)]">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-gray-500">{t(label)}</dt>
            <dd className="break-all font-mono text-xs leading-5">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="mb-3 text-lg font-bold">{t("Result")}</h3>
          {race.entrants.length === 0 ? (
            <p className="rounded-2xl bg-gray-50 px-4 py-8 text-center text-gray-500">{t("The result appears after the race starts.")}</p>
          ) : (
            <Table head={["Place", "Name", "Lane", "Time"]}>
              {[...race.entrants]
                .sort((a, b) => a.place - b.place)
                .map((entrant) => (
                  <tr key={entrant.lane}>
                    <Cell className="font-semibold">{entrant.place}</Cell>
                    <Cell>{entrant.name}</Cell>
                    <Cell>{entrant.lane + 1}</Cell>
                    <Cell>{(entrant.finishMs / 1000).toFixed(2)}s</Cell>
                  </tr>
                ))}
            </Table>
          )}
        </section>
        <section>
          <h3 className="mb-3 text-lg font-bold">{t("Credit movement")}</h3>
          <LedgerTable items={race.ledger} />
          <h3 className="mb-3 mt-6 text-lg font-bold">{t("Audit log")}</h3>
          <AuditTable items={race.audit || []} openUser={openUser} />
        </section>
      </div>
    </div>
  );
}

function Audit({ openUser, openRace }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = useList("/api/admin/audit", { q, action, page });
  const groups = { "user.": "Accounts", "credits.": "Credits", "payment.": "Payments", "race.": "Races", "sponsor.": "Sponsors", "package.": "Packages" };
  return (
    <div>
      <p className="mb-4 text-sm text-gray-600">
        {t("Every important action is appended to a hash-chained log. Each entry includes the hash of the previous one, so editing or removing an old entry breaks the chain. With PostgreSQL the table also rejects updates and deletes.")}
      </p>
      <Search value={q} onChange={(value) => { setQ(value); setPage(1); }} placeholder={t("Search by target ID, event or email")}>
        <Select value={action} onChange={(value) => { setAction(value); setPage(1); }} options={groups} all="All events" />
        {data && <ChainStatus chain={data.chain} />}
      </Search>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {data && <AuditTable items={data.items} openUser={openUser} openRace={openRace} />}
      <Pager data={data} page={page} setPage={setPage} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Sponsors() {
  const { t } = useT();
  const { data, error, reload } = useList("/api/admin/sponsors", {});
  const [problem, setProblem] = useState("");
  const [pending, setPending] = useState("");

  async function run(key, action) {
    setPending(key);
    setProblem("");
    try {
      await action();
      await reload();
    } catch (err) {
      setProblem(err.message);
    } finally {
      setPending("");
    }
  }

  function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    run("new", async () => {
      const payload = await readPngFile(file, t);
      await api("/api/admin/sponsors", { method: "POST", body: payload });
    });
  }

  function replace(id, event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    run(id, async () => {
      const payload = await readPngFile(file, t);
      await api(`/api/admin/sponsors/${id}`, { method: "PATCH", body: { png: payload.png } });
    });
  }

  function patch(id, body) {
    run(id, () => api(`/api/admin/sponsors/${id}`, { method: "PATCH", body }));
  }

  const list = data?.sponsors || [];
  const global = list.filter((item) => item.scope === "global");
  const users = list.filter((item) => item.scope !== "global");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-600">{t("Platform sponsors appear on the stadium boards of every official race, together with the organizer's own images. Use the order to choose which appear first.")}</p>
        <label className={`${button} cursor-pointer`}>
          {pending === "new" ? t("Uploading…") : t("Add platform sponsor (PNG)")}
          <input className="hidden" type="file" accept="image/png,.png" onChange={upload} />
        </label>
      </div>
      {(error || problem) && <p className="mb-3 text-sm text-red-600">{error || problem}</p>}
      {!data ? (
        <p className="text-gray-500">{t("Loading…")}</p>
      ) : global.length === 0 ? (
        <p className="rounded-2xl bg-gray-50 px-4 py-8 text-center text-gray-500">{t("No platform sponsors yet.")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {global.map((sponsor, index) => (
            <SponsorCard
              key={`${sponsor.id}-${sponsor.v}`}
              sponsor={sponsor}
              busy={pending === sponsor.id}
              first={index === 0}
              last={index === global.length - 1}
              onMove={(direction) => {
                const other = global[index + direction];
                run(sponsor.id, async () => {
                  await api(`/api/admin/sponsors/${sponsor.id}`, { method: "PATCH", body: { sort: other.sort } });
                  await api(`/api/admin/sponsors/${other.id}`, { method: "PATCH", body: { sort: sponsor.sort } });
                });
              }}
              onPatch={(body) => patch(sponsor.id, body)}
              onReplace={(event) => replace(sponsor.id, event)}
            />
          ))}
        </ul>
      )}

      <h2 className="mb-3 mt-10 text-lg font-bold">{t("Organizer sponsor images")}</h2>
      <Table head={["Image", "Name", "Account", "Added"]} empty="No organizer images.">
        {users.map((sponsor) => (
          <tr key={sponsor.id}>
            <Cell>
              <img src={`/api/sponsors/${sponsor.id}/image?v=${sponsor.v}`} alt="" className="h-10 w-20 rounded bg-[#07140c] object-contain" />
            </Cell>
            <Cell>{sponsor.name}</Cell>
            <Cell>{sponsor.email || sponsor.userId}</Cell>
            <Cell className="whitespace-nowrap">{formatWhen(sponsor.createdAt)}</Cell>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function SponsorCard({ sponsor, busy, first, last, onMove, onPatch, onReplace }) {
  const { t } = useT();
  const [name, setName] = useState(sponsor.name);
  return (
    <li className={`flex gap-3 rounded-2xl border p-3 ${sponsor.active ? "border-gray-100" : "border-dashed border-gray-200 opacity-60"}`}>
      <img src={`/api/sponsors/${sponsor.id}/image?v=${sponsor.v}`} alt="" className="h-20 w-32 shrink-0 rounded-lg bg-[#07140c] object-contain" />
      <div className="min-w-0 flex-1">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() && name !== sponsor.name) onPatch({ name });
          }}
        >
          <input className={`${input} min-w-0 flex-1`} value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
          <button type="submit" className={soft} disabled={busy || !name.trim() || name === sponsor.name}>
            {t("Rename")}
          </button>
        </form>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={soft} disabled={busy} onClick={() => onPatch({ active: !sponsor.active })}>
            {sponsor.active ? t("Hide") : t("Show")}
          </button>
          <label className={`${soft} cursor-pointer`}>
            {t("Replace image")}
            <input className="hidden" type="file" accept="image/png,.png" onChange={onReplace} disabled={busy} />
          </label>
          <button type="button" className={soft} disabled={busy || first} onClick={() => onMove(-1)} aria-label={t("Move up")}>
            ↑
          </button>
          <button type="button" className={soft} disabled={busy || last} onClick={() => onMove(1)} aria-label={t("Move down")}>
            ↓
          </button>
        </div>
        {!sponsor.active && <p className="mt-1 text-xs text-gray-500">{t("Hidden from races")}</p>}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------

function toCents(text) {
  const value = Number(String(text).replace(",", "."));
  return Number.isFinite(value) ? Math.round(value * 100) : NaN;
}

function Packages() {
  const { t } = useT();
  const { data, error, reload } = useList("/api/admin/packages", {});
  const [problem, setProblem] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({ name: "", credits: "", price: "" });

  async function save(path, method, body) {
    setProblem("");
    setMessage("");
    try {
      await api(path, { method, body });
      await reload();
      setMessage(t("Package saved."));
      return true;
    } catch (err) {
      setProblem(err.message);
      return false;
    }
  }

  async function create(event) {
    event.preventDefault();
    const ok = await save("/api/admin/packages", "POST", { name: draft.name, credits: Number(draft.credits), amount: toCents(draft.price) });
    if (ok) setDraft({ name: "", credits: "", price: "" });
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-gray-600">
        {t("Packages shown on the Credits page. Price changes apply to new checkouts only; payments already opened keep their original price. Prices are in {currency}.", { currency: data?.currency || "BRL" })}
      </p>
      {(error || problem) && <p className="mb-3 text-sm text-red-600">{error || problem}</p>}
      {message && <p className="mb-3 text-sm text-emerald-700">{message}</p>}
      {!data ? (
        <p className="text-gray-500">{t("Loading…")}</p>
      ) : (
        <Table head={["Name", "Credits", "Price", "Order", "Visible", ""]}>
          {data.packages.map((pack) => (
            <PackageRow key={`${pack.id}-${pack.name}-${pack.amount}-${pack.credits}-${pack.sort}-${pack.active}`} pack={pack} onSave={(body) => save(`/api/admin/packages/${pack.id}`, "PATCH", body)} />
          ))}
        </Table>
      )}
      <form onSubmit={create} className="mt-6 rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold">{t("New package")}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className={`${input} min-w-48 flex-1`} value={draft.name} maxLength={40} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={t("Name")} required />
          <input className={`${input} w-28`} type="number" min="1" max="10000" step="1" value={draft.credits} onChange={(event) => setDraft({ ...draft, credits: event.target.value })} placeholder={t("Credits")} required />
          <input className={`${input} w-32`} inputMode="decimal" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder={t("Price (e.g. 19.90)")} required />
          <button type="submit" className={button}>
            {t("Create")}
          </button>
        </div>
      </form>
    </div>
  );
}

function PackageRow({ pack, onSave }) {
  const { t } = useT();
  const [name, setName] = useState(pack.name);
  const [credits, setCredits] = useState(String(pack.credits));
  const [price, setPrice] = useState((pack.amount / 100).toFixed(2));
  const [sort, setSort] = useState(String(pack.sort));
  const dirty = name !== pack.name || Number(credits) !== pack.credits || toCents(price) !== pack.amount || Number(sort) !== pack.sort;
  return (
    <tr className={pack.active ? "" : "opacity-60"}>
      <Cell>
        <input className={`${input} w-full min-w-36`} value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
        <span className="mt-1 block font-mono text-xs text-gray-400">{pack.id}</span>
      </Cell>
      <Cell>
        <input className={`${input} w-24`} type="number" min="1" max="10000" step="1" value={credits} onChange={(event) => setCredits(event.target.value)} />
      </Cell>
      <Cell>
        <input className={`${input} w-28`} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
        <span className="mt-1 block text-xs text-gray-500">{Number.isFinite(toCents(price)) ? formatMoney(toCents(price), pack.currency) : "—"}</span>
      </Cell>
      <Cell>
        <input className={`${input} w-20`} type="number" step="1" value={sort} onChange={(event) => setSort(event.target.value)} />
      </Cell>
      <Cell>
        <button type="button" className={soft} onClick={() => onSave({ active: !pack.active })}>
          {pack.active ? t("Yes") : t("No")}
        </button>
      </Cell>
      <Cell>
        <button type="button" className={button} disabled={!dirty} onClick={() => onSave({ name, credits: Number(credits), amount: toCents(price), sort: Number(sort) })}>
          {t("Save")}
        </button>
      </Cell>
    </tr>
  );
}
