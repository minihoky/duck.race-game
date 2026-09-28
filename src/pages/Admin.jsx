import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatMoney, formatWhen } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";

export default function Admin() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [credits, setCredits] = useState("10");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  usePageTitle("Administrator - Duck Race");

  async function load() {
    try {
      const data = await api("/api/admin/overview");
      setOverview(data);
      setError("");
      setUserId((current) => current || data.users[0]?.id || "");
    } catch (err) {
      setError(err.message);
      setOverview(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function adjust(event) {
    event.preventDefault();
    setPending(true);
    setNotice("");
    setError("");
    try {
      await api("/api/admin/credits", {
        method: "POST",
        body: { userId, credits: Number(credits), note },
      });
      setNote("");
      setNotice("Balance updated. This stays inside Duck Race and is not a cash refund.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-20">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Administrator</p>
      <h1 className="mt-1 text-3xl font-bold">Dashboard</h1>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {!overview && !error && <p className="mt-8 text-gray-500">Loading…</p>}
      {overview && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            {[
              ["Accounts", overview.totals.users],
              ["Races", overview.totals.races],
              ["Credits sold", overview.totals.creditsSold],
              ["Credits on accounts", overview.totals.creditsOutstanding],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>

          <form onSubmit={adjust} className="mt-8 rounded-2xl border border-gray-100 p-5">
            <h2 className="text-xl font-bold">Adjust a balance</h2>
            <p className="mt-1 text-sm text-gray-600">Use this to correct an in-system balance. It does not withdraw, transfer, or refund cash.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <select className="rounded-xl border border-gray-200 px-3 py-2" value={userId} onChange={(event) => setUserId(event.target.value)}>
                {overview.users.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.credits} credits
                  </option>
                ))}
              </select>
              <input
                className="rounded-xl border border-gray-200 px-3 py-2"
                type="number"
                value={credits}
                onChange={(event) => setCredits(event.target.value)}
                required
              />
              <input
                className="rounded-xl border border-gray-200 px-3 py-2"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Reason"
                required
              />
            </div>
            <button className="mt-4 rounded-xl bg-sky-500 px-4 py-2 font-semibold text-white disabled:opacity-50" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Apply adjustment"}
            </button>
            {notice && <p className="mt-3 text-sm text-gray-700">{notice}</p>}
          </form>

          <section className="mt-8">
            <h2 className="mb-3 text-xl font-bold">Accounts</h2>
            <div className="overflow-x-auto rounded-2xl border border-gray-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Credits</th>
                    <th className="px-4 py-3 font-medium">Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.users.map((item) => (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="px-4 py-3">{item.name}</td>
                      <td className="px-4 py-3">{item.email}</td>
                      <td className="px-4 py-3">{item.role}</td>
                      <td className="px-4 py-3">{item.credits}</td>
                      <td className="px-4 py-3">{item.verified ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-xl font-bold">Recent races</h2>
            <ul className="space-y-3">
              {overview.races.map((race) => (
                <li key={race.id} className="rounded-2xl border border-gray-100 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{race.name}</p>
                    <Link className="font-semibold text-sky-600" to={`/race/${race.id}`}>
                      Open
                    </Link>
                  </div>
                  <p className="text-gray-500">{formatWhen(race.startedAt)} · {race.status} · winner {race.winner || "—"}</p>
                  <p className="mt-1 text-gray-700">{race.names.join(", ")}</p>
                </li>
              ))}
              {overview.races.length === 0 && <p className="text-gray-500">No races yet.</p>}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-xl font-bold">Payments</h2>
            <div className="overflow-x-auto rounded-2xl border border-gray-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Package</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.payments.map((payment) => (
                    <tr key={payment.id} className="border-t border-gray-100">
                      <td className="px-4 py-3">{formatWhen(payment.createdAt)}</td>
                      <td className="px-4 py-3">{payment.packageName} · {payment.credits} credits</td>
                      <td className="px-4 py-3">{formatMoney(payment.amount, payment.currency)}</td>
                      <td className="px-4 py-3">{payment.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
