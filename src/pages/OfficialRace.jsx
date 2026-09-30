import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { me, publishAccount } from "../lib/auth";
import { usePageTitle } from "../lib/usePageTitle";

const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];

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

function clock(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function rememberSetup(race) {
  sessionStorage.setItem(
    "duck-official-setup",
    JSON.stringify({
      id: race.id,
      name: race.name,
      names: race.names,
      durationSec: Math.round((race.durationMs || 0) / 1000),
    })
  );
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
  const [missing, setMissing] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState("");
  const frame = useRef(null);
  const paid = useRef(false);
  usePageTitle(race ? `${race.name} - Duck Race` : "Official Race - Duck Race");

  useEffect(() => {
    const next = readCache(id);
    setRace(next?.race || null);
    setMissing(false);
    setAuthError(false);
    setError("");
    paid.current = false;
  }, [id]);

  useEffect(() => {
    let stop = false;
    async function pull() {
      try {
        const data = await api(`/api/races/${id}`);
        if (stop) return;
        writeCache(data.race);
        setRace(data.race);
        setMissing(false);
        setAuthError(false);
      } catch (error) {
        if (stop) return;
        if (error.status === 401) setAuthError(true);
        if (error.status === 404) setMissing(true);
      }
    }
    pull();
    const timer = window.setInterval(pull, 2000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [id]);

  useEffect(() => {
    function onMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.type !== "duck-official-started" || event.data.id !== id) return;
      if (paid.current) return;
      paid.current = true;
      const current = readCache(id);
      if (current && current.race && current.race.status !== "ready") return;
      api(`/api/races/${id}/start`, { method: "POST", body: {} })
        .then((data) => {
          writeCache(data.race);
          setRace(data.race);
          if (data.user) publishAccount(data.user);
        })
        .catch((err) => {
          paid.current = false;
          setError(err.message);
          const game = frame.current && frame.current.contentWindow;
          if (game) game.postMessage({ type: "duck-official-stop", id }, window.location.origin);
        });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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
  if (!race) {
    return <p className="px-4 pb-16 pt-24 text-center text-gray-500">Restoring the official race…</p>;
  }

  rememberSetup(race);
  const seconds = Math.round((race.durationMs || 0) / 1000);
  const src = `/game/index.html?countdown=${clock(seconds)}&official=${encodeURIComponent(race.id)}`;

  return (
    <div>
      {error && (
        <div className="fixed left-1/2 top-20 z-40 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl bg-white px-4 py-3 text-sm text-red-700 shadow-lg">
          <p>{error}</p>
          <Link to="/credits" className="mt-2 inline-block font-semibold text-sky-600">
            Buy credits
          </Link>
        </div>
      )}
      <div id="game" className="game-stage">
        <div className="game-bezel">
          <iframe ref={frame} title={race.name} src={src} className="game-screen" />
        </div>
      </div>
    </div>
  );
}

function RaceSetup() {
  const navigate = useNavigate();
  const [user, setUser] = useState(undefined);
  const [name, setName] = useState("Official race");
  const [names, setNames] = useState("Alex\nSam\nJordan\nRiley");
  const [duration, setDuration] = useState("30");
  const [sponsors, setSponsors] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const saveAfterSignIn = useRef(false);
  usePageTitle("Official Race - Duck Race");

  async function save() {
    setPending(true);
    setError("");
    try {
      const data = await api("/api/races", {
        method: "POST",
        body: {
          name,
          names: names.split("\n"),
          durationSec: Number(duration),
          sponsorIds: chosen,
        },
      });
      if (data.user) publishAccount(data.user);
      rememberSetup(data.race);
      navigate(`/race/${data.race.id}`);
    } catch (err) {
      setError(err.message);
      setPending(false);
    }
  }

  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    me().then(setUser);
    function onAccount(event) {
      const next = event.detail || null;
      setUser(next);
      if (next && saveAfterSignIn.current) {
        saveAfterSignIn.current = false;
        saveRef.current();
      }
    }
    window.addEventListener("duck-account", onAccount);
    return () => window.removeEventListener("duck-account", onAccount);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let cancel = false;
    api("/api/account")
      .then((data) => {
        if (!cancel) setSponsors(data.sponsors || []);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [user]);

  function onSubmit(event) {
    event.preventDefault();
    if (!user) {
      saveAfterSignIn.current = true;
      window.dispatchEvent(new Event("duck-open-signin"));
      return;
    }
    save();
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-20">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Official race</p>
      <h1 className="mt-1 text-3xl font-bold">Set up a race</h1>
      <p className="mt-3 text-gray-600">
        Saving this setup does not use a credit. One credit is used only when you start the race. Replaying a finished race does not use another credit.
      </p>
      {user && (
        <p className="mt-3 font-semibold">
          Balance: {user.credits} credit{user.credits === 1 ? "" : "s"}
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold">
          Race name
          <input
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 font-normal"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Official race"
            maxLength={60}
          />
        </label>
        <label className="block text-sm font-semibold">
          Names, one per line
          <textarea
            className="mt-1 h-40 w-full rounded-xl border border-gray-200 px-3 py-2 font-normal"
            value={names}
            onChange={(event) => setNames(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-semibold">
          Race length
          <select
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 font-normal"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          >
            {DURATIONS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds} seconds
              </option>
            ))}
          </select>
        </label>
        {sponsors.length > 0 && (
          <fieldset>
            <legend className="text-sm font-semibold">Sponsor images</legend>
            <div className="mt-2 space-y-2">
              {sponsors.map((sponsor) => (
                <label key={sponsor.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={chosen.includes(sponsor.id)}
                    onChange={(event) => {
                      setChosen((current) =>
                        event.target.checked ? [...current, sponsor.id].slice(0, 8) : current.filter((id) => id !== sponsor.id)
                      );
                    }}
                  />
                  {sponsor.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="rounded-xl bg-sky-500 px-5 py-2 font-semibold text-white disabled:opacity-50" disabled={pending}>
          {pending ? "Saving…" : "Save setup"}
        </button>
      </form>
    </div>
  );
}

export default function OfficialRace() {
  const { id } = useParams();
  if (id) return <RacePlayer id={id} />;
  return <RaceSetup />;
}
