import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { forgotPassword, publishAccount } from "../lib/auth";
import { readPngFile } from "../lib/files";
import { formatWhen } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";

export default function Dashboard() {
  const [account, setAccount] = useState(null);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [pending, setPending] = useState(false);
  usePageTitle("Dashboard - Duck Race");

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

  async function onUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      const payload = await readPngFile(file);
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
      setNotice("If this account can be reset, a password link is on its way.");
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  if (authError) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-16 pt-24 text-center">
        <h1 className="text-3xl font-bold">Your dashboard</h1>
        <p className="mt-3 text-gray-600">Sign in to see credits, race history, and sponsor images.</p>
        <button
          type="button"
          className="mt-6 rounded-xl bg-sky-500 px-5 py-2 font-semibold text-white"
          onClick={() => window.dispatchEvent(new Event("duck-open-signin"))}
        >
          Sign in
        </button>
      </div>
    );
  }

  if (!account) return <p className="px-4 pb-16 pt-24 text-center text-gray-500">{error || "Loading your dashboard…"}</p>;

  const user = account.user;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-20">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Account</p>
      <h1 className="mt-1 text-3xl font-bold">{user.name}</h1>
      <p className="text-gray-500">{user.email}</p>
      <div className="mt-6 max-w-xs rounded-2xl bg-sky-50 p-5">
        <p className="text-sm text-sky-700">Credits</p>
        <p className="text-3xl font-bold text-sky-950">{user.credits}</p>
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-bold">Credit history</h2>
        <p className="mb-4 text-sm text-gray-600">Credits cannot be withdrawn, transferred to another account, or refunded for cash.</p>
        {account.ledger.length === 0 ? (
          <p className="rounded-2xl bg-gray-50 px-4 py-8 text-center text-gray-500">No credit activity yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Activity</th>
                  <th className="px-4 py-3 font-medium">Credits</th>
                  <th className="px-4 py-3 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {account.ledger.map((entry) => (
                  <tr key={entry.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 whitespace-nowrap">{formatWhen(entry.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{entry.label}</span>
                      {entry.note && <span className="block text-gray-500">{entry.note}</span>}
                    </td>
                    <td className={`px-4 py-3 font-semibold ${entry.credits < 0 ? "text-gray-800" : "text-emerald-700"}`}>
                      {entry.credits > 0 ? `+${entry.credits}` : entry.credits}
                    </td>
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
          <h2 className="text-xl font-bold">Sponsor images</h2>
          <label className="cursor-pointer rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold">
            Upload PNG
            <input className="hidden" type="file" accept="image/png,.png" onChange={onUpload} />
          </label>
        </div>
        <p className="mb-4 text-sm text-gray-600">PNG files show on the stadium board during an official race. Removing one hides it from future races. Saved replays keep the image.</p>
        {account.sponsors.length === 0 ? (
          <p className="rounded-2xl bg-gray-50 px-4 py-8 text-center text-gray-500">No sponsor images yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {account.sponsors.map((sponsor) => (
              <li key={sponsor.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3">
                <img src={`/api/sponsors/${sponsor.id}/image`} alt="" className="h-14 w-24 rounded-lg bg-[#07140c] object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{sponsor.name}</p>
                  <button type="button" className="text-sm text-gray-500" onClick={() => removeSponsor(sponsor.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-gray-100 p-5">
        <h2 className="text-xl font-bold">Password recovery</h2>
        <p className="mt-2 text-sm text-gray-600">Send a reset link to {user.email}.</p>
        <button type="button" className="mt-4 rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold" onClick={sendReset} disabled={pending}>
          {pending ? "Sending…" : "Email me a reset link"}
        </button>
        {notice && <p className="mt-3 text-sm text-gray-700">{notice}</p>}
        {previewUrl && (
          <a className="mt-2 block text-sm text-sky-600 underline" href={previewUrl}>
            Open the reset link
          </a>
        )}
      </section>
    </div>
  );
}
