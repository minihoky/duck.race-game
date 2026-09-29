import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StadiumRace from "../components/StadiumRace";
import { api } from "../lib/api";
import { usePageTitle } from "../lib/usePageTitle";

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
  usePageTitle("Official Race - Duck Race");
  return (
    <div className="relative h-[calc(100vh-16px)] p-1 md:p-3">
      <iframe title="Official race" src="/game/index.html" className="game-bezel h-full w-full" />
    </div>
  );
}

export default function OfficialRace() {
  const { id } = useParams();
  if (id) return <RacePlayer id={id} />;
  return <RaceSetup />;
}
