import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import StadiumRace from "../components/StadiumRace";
import Scoreboard from "../components/Scoreboard";
import { api } from "../lib/api";
import { publishAccount } from "../lib/auth";
import { readPngFile } from "../lib/files";
import { usePageTitle } from "../lib/usePageTitle";

const DURATIONS = [
  [15, "15 seconds"],
  [20, "20 seconds"],
  [30, "30 seconds"],
  [45, "45 seconds"],
  [60, "60 seconds"],
  [90, "90 seconds"],
  [120, "2 minutes"],
];

function cacheKey(id) {
  return `duck-live-race:${id}`;
}

function readCache(id) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(cacheKey(id)) || "null");
    if (saved && saved.race && saved.race.id === id && saved.serverNow && saved.localNow) return saved;
  } catch {
    return null;
  }
  return null;
}

function writeCache(race) {
  const payload = { race, serverNow: race.serverNow, localNow: Date.now() };
  sessionStorage.setItem(cacheKey(race.id), JSON.stringify(payload));
  sessionStorage.setItem("duck-live-race", race.id);
  return payload;
}

function SignInNotice({ title, text }) {
  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-24 text-center">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-3 text-gray-600">{text}</p>
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

function RacePlayer({ id }) {
  const cached = readCache(id);
  const [race, setRace] = useState(cached?.race || null);
  const [sync, setSync] = useState(cached ? { serverNow: cached.serverNow, localNow: cached.localNow } : null);
  const [connected, setConnected] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [missing, setMissing] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [replayAt, setReplayAt] = useState(null);
  const [copied, setCopied] = useState(false);
  usePageTitle(race ? `${race.name} - Duck Race` : "Official Race - Duck Race");

  useEffect(() => {
    const next = readCache(id);
    setRace(next?.race || null);
    setSync(next ? { serverNow: next.serverNow, localNow: next.localNow } : null);
    setReplayAt(null);
    setMissing(false);
    setAuthError(false);
  }, [id]);

  useEffect(() => {
    let stop = false;
    async function pull() {
      try {
        const data = await api(`/api/races/${id}`);
        if (stop) return;
        const saved = writeCache(data.race);
        setRace(data.race);
        setSync({ serverNow: saved.serverNow, localNow: saved.localNow });
        setConnected(true);
        setMissing(false);
        setAuthError(false);
      } catch (error) {
        if (stop) return;
        setConnected(false);
        if (error.status === 401) setAuthError(true);
        if (error.status === 404) setMissing(true);
      }
    }
    pull();
    const timer = window.setInterval(pull, 2000);
    function offline() {
      setConnected(false);
    }
    function online() {
      pull();
    }
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      stop = true;
      window.clearInterval(timer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [id]);

  if (authError && !race) {
    return <SignInNotice title="Sign in to restore this race" text="The official result stays on the server. Sign in again on this browser to bring the ducks back to the clock." />;
  }
  if (missing) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-16 pt-24 text-center">
        <h1 className="text-3xl font-bold">Result not found</h1>
        <p className="mt-3 text-gray-600">That result ID is not on this account.</p>
        <Link to="/history" className="mt-6 inline-block font-semibold text-sky-600">
          Back to race history
        </Link>
      </div>
    );
  }
  if (!race || !sync) {
    return <p className="px-4 pb-16 pt-24 text-center text-gray-500">Restoring the official race…</p>;
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(race.id);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Official race</p>
          <h1 className="text-2xl font-bold">{race.name}</h1>
        </div>
        <button type="button" className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700" onClick={copyId}>
          {copied ? "Copied" : `Result ${race.id}`}
        </button>
      </div>
      <StadiumRace race={race} sync={sync} connected={connected} replayAt={replayAt} onReplay={() => setReplayAt(Date.now())} />
    </div>
  );
}

function RaceSetup() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [authError, setAuthError] = useState(false);
  const [name, setName] = useState("");
  const [names, setNames] = useState("Alex\nSam\nJordan\nRiley");
  const [durationSec, setDurationSec] = useState(30);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  usePageTitle("Official Race - Duck Race");

  async function load() {
    try {
      const data = await api("/api/account");
      setAccount(data);
      setAuthError(false);
    } catch (err) {
      if (err.status === 401) setAuthError(true);
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    function onAccount() {
      load();
    }
    window.addEventListener("duck-account", onAccount);
    return () => window.removeEventListener("duck-account", onAccount);
  }, []);

  if (loading) return <p className="px-4 pb-16 pt-24 text-center text-gray-500">Loading your account…</p>;
  if (authError) {
    return (
      <SignInNotice
        title="Sign in to start an official race"
        text="One credit is used when the race begins. The result is stored with an ID and can be replayed for free."
      />
    );
  }

  const sponsors = account?.sponsors || [];
  const chosen = sponsors.filter((sponsor) => selected.includes(sponsor.id));
  const list = names.split("\n").map((item) => item.trim()).filter(Boolean);

  function toggle(id) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 8) return current;
      return [...current, id];
    });
  }

  async function onUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      const payload = await readPngFile(file);
      const data = await api("/api/sponsors", { method: "POST", body: payload });
      setAccount((current) => ({ ...current, sponsors: [...(current.sponsors || []), data.sponsor] }));
      setSelected((current) => (current.length >= 8 ? current : [...current, data.sponsor.id]));
    } catch (err) {
      setError(err.message);
    }
  }

  async function onStart(event) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const data = await api("/api/races", {
        method: "POST",
        body: { name, names: list, durationSec, sponsorIds: selected },
      });
      publishAccount(data.user);
      writeCache(data.race);
      navigate(`/race/${data.race.id}`);
    } catch (err) {
      if (err.status === 409 && err.data?.race?.id) {
        writeCache(err.data.race);
        navigate(`/race/${err.data.race.id}`);
        return;
      }
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-12 pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form onSubmit={onStart} className="rounded-2xl border border-gray-100 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Official race</p>
        <h1 className="mt-1 text-3xl font-bold">Start a saved race</h1>
        <p className="mt-2 text-sm text-gray-600">
          The server draws the result when the race begins and stores it under a result ID. One credit is used then. Replays and refreshes use that same result.
        </p>
        <p className="mt-3 text-sm font-semibold text-gray-800">
          {account.user.credits} credit{account.user.credits === 1 ? "" : "s"} available
        </p>
        {account.activeRace && (
          <Link to={`/race/${account.activeRace.id}`} className="mt-4 block rounded-xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800">
            {account.activeRace.name} is still on the clock. Resume it.
          </Link>
        )}
        <label className="mt-5 mb-2 block text-sm font-semibold">Race name</label>
        <input
          className="w-full rounded-xl border border-gray-200 px-3 py-2"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Friday classroom"
          maxLength={60}
        />
        <label className="mt-4 mb-2 block text-sm font-semibold">Names, one per line</label>
        <textarea
          className="h-40 w-full rounded-xl border border-gray-200 px-3 py-2"
          value={names}
          onChange={(event) => setNames(event.target.value)}
          required
        />
        <label className="mt-4 mb-2 block text-sm font-semibold">Winner finish time</label>
        <select
          className="w-full rounded-xl border border-gray-200 px-3 py-2"
          value={durationSec}
          onChange={(event) => setDurationSec(Number(event.target.value))}
        >
          {DURATIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Sponsor board</p>
            <label className="cursor-pointer text-sm font-semibold text-sky-600">
              Upload PNG
              <input className="hidden" type="file" accept="image/png,.png" onChange={onUpload} />
            </label>
          </div>
          {sponsors.length === 0 ? (
            <p className="text-sm text-gray-500">PNG sponsor images appear on the stadium board during the race.</p>
          ) : (
            <ul className="space-y-2">
              {sponsors.map((sponsor) => (
                <li key={sponsor.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selected.includes(sponsor.id)} onChange={() => toggle(sponsor.id)} />
                    {sponsor.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}
        <button
          className="mt-5 w-full rounded-xl bg-sky-500 py-3 font-semibold text-white disabled:opacity-50"
          type="submit"
          disabled={pending || account.user.credits < 1 || list.length < 2}
        >
          {pending ? "Starting…" : "Start official race · 1 credit"}
        </button>
        {account.user.credits < 1 && (
          <p className="mt-3 text-sm text-gray-600">
            Buy a credit package on the <Link className="font-semibold text-sky-600" to="/credits">credits page</Link>. Credits cannot be withdrawn, transferred, or refunded for cash.
          </p>
        )}
      </form>
      <div>
        <Scoreboard title={name.trim() || "Official race"} elapsed={0} sponsors={chosen} />
        <p className="mt-3 text-sm text-gray-500">{list.length} ducks on the board. The winner finishes at the time you chose.</p>
      </div>
    </div>
  );
}

export default function OfficialRace() {
  const { id } = useParams();
  if (id) return <RacePlayer id={id} />;
  return <RaceSetup />;
}
