import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { forgotPassword, publishAccount } from "../lib/auth";
import { readPngFile } from "../lib/files";
import { formatMoney, formatWhen } from "../lib/format";
import { useT } from "../lib/i18n";
import { usePageTitle } from "../lib/usePageTitle";

export const LEDGER_LABELS = { topup: "Credit purchase", race: "Official race", adjust: "Balance adjustment" };
export const PAYMENT_STATUS = { paid: "Paid", pending: "Pending", failed: "Not completed" };

export default function Dashboard() {
  const { t } = useT();
  const [account, setAccount] = useState(null);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [pending, setPending] = useState(false);
  usePageTitle(t("My account"));

  async function load() {
    try {
      const data = await api("/api/account");
      setAccount(data);
      setAuthError(false);
      publishAccount(data.user);
    } catch (err) {
      if (err.status === 401) setAuthError(true);
      else setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!authError) return undefined;
    function onAccount(event) {
      if (!event.detail) return;
      window.removeEventListener("duck-account", onAccount);
      load();
    }
    window.addEventListener("duck-account", onAccount);
    return () => window.removeEventListener("duck-account", onAccount);
  }, [authError]);

  async function onUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      const payload = await readPngFile(file, t);
      await api("/api/sponsors", { method: "POST", body: payload });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeSponsor(id) {
    setError("");
    try {
      await api(`/api/sponsors/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendReset() {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const result = await forgotPassword(account.user.email);
      setPreviewUrl(result.previewUrl || "");
      setNotice(t("If this account can be reset, a password link is on its way."));
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  if (authError) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-16 pt-24 text-center">
        <h1 className="text-3xl font-bold">{t("My account")}</h1>
        <p className="mt-3 text-gray-600">{t("Sign in to see credits, purchases, race history, and sponsor images.")}</p>
        <button type="button" className="mt-6 rounded-xl bg-sky-500 px-5 py-2 font-semibold text-white" onClick={() => window.dispatchEvent(new Event("duck-open-signin"))}>
          {t("Sign in")}
        </button>
      </div>
    );
  }

  if (!account) return <p className="px-4 pb-16 pt-24 text-center text-gray-500">{error || t("Loading your account…")}</p>;

  const user = account.user;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-20">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">{t("Account")}</p>
      <h1 className="mt-1 text-3xl font-bold">{user.name}</h1>
      <p className="text-gray-500">{user.email}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-sky-50 p-5">
          <p className="text-sm text-sky-700">{t("Credits")}</p>
          <p className="text-3xl font-bold text-sky-950">{user.credits}</p>
          <Link to="/credits" className="mt-2 inline-block text-sm font-semibold text-sky-600">
            {t("Buy credits")}
          </Link>
        </div>
        <div className="rounded-2xl bg-gray-50 p-5">
          <p className="text-sm text-gray-500">{t("Account status")}</p>
          <p className="text-xl font-bold">{t(user.status === "restricted" ? "Restricted" : "Active")}</p>
          {user.statusNote && <p className="text-sm text-gray-500">{user.statusNote}</p>}
        </div>
        <div className="rounded-2xl bg-gray-50 p-5">
          <p className="text-sm text-gray-500">{t("Races")}</p>
          <Link to="/history" className="mt-1 inline-block font-semibold text-sky-600">
            {t("Race history and replays")}
          </Link>
          <Link to="/race" className="mt-1 block font-semibold text-sky-600">
            {t("New official race")}
          </Link>
        </div>
      </div>
      {account.activeRace && (
        <Link to={`/race/${account.activeRace.id}`} className="mt-4 block rounded-2xl bg-amber-50 px-5 py-3 font-semibold text-amber-800">
          ● {t("A race is running now: {name}. Open it", { name: account.activeRace.name })}
        </Link>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-bold">{t("Purchases")}</h2>
        {account.payments.length === 0 ? (
          <p className="rounded-2xl bg-gray-50 px-4 py-8 text-center text-gray-500">{t("No purchases yet.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("Date")}</th>
                  <th className="px-4 py-3 font-medium">{t("Package")}</th>
                  <th className="px-4 py-3 font-medium">{t("Amount")}</th>
                  <th className="px-4 py-3 font-medium">{t("Status")}</th>
                  <th className="px-4 py-3 font-medium">{t("Reference")}</th>
                </tr>
              </thead>
              <tbody>
                {account.payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-gray-100">
                    <td className="whitespace-nowrap px-4 py-3">{formatWhen(payment.createdAt)}</td>
                    <td className="px-4 py-3">
                      {payment.packageName} · {t("{n} credits", { n: payment.credits })}
                    </td>
                    <td className="px-4 py-3">{formatMoney(payment.amount, payment.currency)}</td>
                    <td className="px-4 py-3">
                      {payment.status === "pending" ? (
                        <Link className="font-semibold text-sky-600" to={`/checkout/${payment.id}`}>
                          {t("Pending")}
                        </Link>
                      ) : (
                        t(PAYMENT_STATUS[payment.status] || payment.status)
                      )}
                      {payment.demo && <span className="ml-1 text-xs text-gray-500">({t("test")})</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {payment.id}
                      {payment.gatewayRef && payment.gateway === "mercadopago" ? ` · MP ${payment.gatewayRef}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-bold">{t("Credit history")}</h2>
        <p className="mb-4 text-sm text-gray-600">{t("Credits cannot be withdrawn, transferred to another account, or refunded for cash.")}</p>
        {account.ledger.length === 0 ? (
          <p className="rounded-2xl bg-gray-50 px-4 py-8 text-center text-gray-500">{t("No credit activity yet.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("Date")}</th>
                  <th className="px-4 py-3 font-medium">{t("Activity")}</th>
                  <th className="px-4 py-3 font-medium">{t("Credits")}</th>
                  <th className="px-4 py-3 font-medium">{t("Balance")}</th>
                </tr>
              </thead>
              <tbody>
                {account.ledger.map((entry) => (
                  <tr key={entry.id} className="border-t border-gray-100">
                    <td className="whitespace-nowrap px-4 py-3">{formatWhen(entry.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{t(LEDGER_LABELS[entry.type] || "Credit activity")}</span>
                      {entry.note && <span className="block text-gray-500">{entry.note}</span>}
                      {entry.raceId && (
                        <Link className="text-xs text-sky-600" to={`/verify/${entry.raceId}`}>
                          {entry.raceId}
                        </Link>
                      )}
                    </td>
                    <td className={`px-4 py-3 font-semibold ${entry.credits < 0 ? "text-gray-800" : "text-emerald-700"}`}>{entry.credits > 0 ? `+${entry.credits}` : entry.credits}</td>
                    <td className="px-4 py-3">{entry.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">{t("Your sponsor image")}</h2>
          {account.sponsors.length === 0 && (
            <label className="cursor-pointer rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold">
              {t("Upload PNG")}
              <input className="hidden" type="file" accept="image/png,.png" onChange={onUpload} />
            </label>
          )}
        </div>
        <p className="mb-4 text-sm text-gray-600">
          {t("One PNG you can add to the stadium boards of your own races. Remove it to upload a different one. Platform sponsors managed by the administrator always appear too.")}
        </p>
        {account.sponsors.length === 0 ? (
          <p className="rounded-2xl bg-gray-50 px-4 py-8 text-center text-gray-500">{t("No sponsor images yet.")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {account.sponsors.map((sponsor) => (
              <li key={sponsor.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3">
                <img src={`/api/sponsors/${sponsor.id}/image?v=${sponsor.v}`} alt="" className="h-14 w-24 rounded-lg bg-[#07140c] object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{sponsor.name}</p>
                  <button type="button" className="text-sm text-gray-500" onClick={() => removeSponsor(sponsor.id)}>
                    {t("Remove")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-gray-100 p-5">
        <h2 className="text-xl font-bold">{t("Password recovery")}</h2>
        <p className="mt-2 text-sm text-gray-600">{t("Send a reset link to {email}.", { email: user.email })}</p>
        <button type="button" className="mt-4 rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold" onClick={sendReset} disabled={pending}>
          {pending ? t("Sending…") : t("Email me a reset link")}
        </button>
        {notice && <p className="mt-3 text-sm text-gray-700">{notice}</p>}
        {previewUrl && (
          <a className="mt-2 block text-sm text-sky-600 underline" href={previewUrl}>
            {t("Open the reset link")}
          </a>
        )}
      </section>
    </div>
  );
}
