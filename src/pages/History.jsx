import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatWhen } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";

export default function History() {
  const [races, setRaces] = useState(null);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  usePageTitle("Race History - Duck Race");

  useEffect(() => {
    let cancel = false;
    api("/api/races")
      .then((data) => {
        if (!cancel) setRaces(data.races);
      })
      .catch((err) => {
        if (cancel) return;
        if (err.status === 401) setAuthError(true);
        else setError(err.message);
        setRaces([]);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const needle = query.trim().toLowerCase();
  const visible = (races || []).filter((race) => {
    if (!needle) return true;
    const blob = `${race.name} ${race.names.join(" ")} ${race.winner} ${race.id}`.toLowerCase();
    return blob.includes(needle);
  });

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-20">
      <h1 className="text-3xl font-bold">Race history</h1>
      <p className="mt-2 text-gray-600">Dates, names, and official results. Open any result to replay it without using a credit.</p>
      {authError ? (
        <div className="mt-8 rounded-2xl bg-sky-50 px-6 py-10 text-center">
          <p className="text-sky-800">Sign in to see races saved on your account.</p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-sky-500 px-4 py-2 font-semibold text-white"
            onClick={() => window.dispatchEvent(new Event("duck-open-signin"))}
          >
            Sign in
          </button>
        </div>
      ) : (
        <>
          <input
            className="mt-6 w-full rounded-xl border border-gray-200 px-3 py-2"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by race name, duck, or result ID"
          />
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          {races == null ? (
            <p className="mt-8 text-gray-500">Loading history…</p>
          ) : visible.length === 0 ? (
            <p className="mt-8 rounded-2xl bg-sky-50 px-6 py-10 text-center text-sky-700">
              {races.length === 0 ? "No official races yet." : "No races match that search."}
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {visible.map((race) => (
                <li key={race.id} className="rounded-2xl border border-gray-100 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{race.name}</h2>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${race.status === "racing" ? "bg-amber-100 text-amber-800" : race.status === "ready" ? "bg-gray-100 text-gray-700" : "bg-emerald-100 text-emerald-800"}`}>
                          {race.status === "racing" ? "On the clock" : race.status === "ready" ? "Ready" : "Finished"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{formatWhen(race.startedAt || race.createdAt)}</p>
                      <p className="mt-2 text-sm text-gray-700">{race.names.join(", ")}</p>
                      <p className="mt-2 text-sm text-gray-600">
                        {race.status === "ready"
                          ? "Saved setup. One credit is used when this race starts in the game."
                          : "Open the game again without using another credit."}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">Result ID {race.id}</p>
                    </div>
                    <Link to={`/race/${race.id}`} className="rounded-xl bg-sky-500 px-4 py-2 text-center text-sm font-semibold text-white">
                      {race.status === "ready" ? "Open game" : "Play again"}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
