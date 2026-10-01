import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import RaceStage from "../components/RaceStage";
import { api } from "../lib/api";
import { me, publishAccount } from "../lib/auth";
import { usePageTitle } from "../lib/usePageTitle";
import { ANIMALS, PALETTE, bakeSprite } from "../race/art";

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

function offsetOf(saved) {
  return saved.serverNow - saved.localNow;
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
  const [clockOffset, setClockOffset] = useState(cached ? offsetOf(cached) : 0);
  const [connected, setConnected] = useState(true);
  const [missing, setMissing] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [credits, setCredits] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const status = useRef(cached?.race?.status || "");
  usePageTitle(race ? `${race.name} - Duck Race` : "Official Race - Duck Race");

  function accept(next) {
    const saved = writeCache(next);
    status.current = next.status;
    setRace(next);
    setClockOffset((current) => {
      const measured = offsetOf(saved);
      return Math.abs(measured - current) > 250 ? measured : current;
    });
  }

  useEffect(() => {
    const next = readCache(id);
    setRace(next?.race || null);
    if (next) setClockOffset(offsetOf(next));
    status.current = next?.race?.status || "";
    setMissing(false);
    setAuthError(false);
    setStartError("");
  }, [id]);

  useEffect(() => {
    me().then((user) => setCredits(user ? user.credits : null));
    function onAccount(event) {
      setCredits(event.detail ? event.detail.credits : null);
    }
    window.addEventListener("duck-account", onAccount);
    return () => window.removeEventListener("duck-account", onAccount);
  }, []);

  useEffect(() => {
    let stop = false;
    async function pull() {
      if (status.current === "finished") return;
      try {
        const data = await api(`/api/races/${id}`);
        if (stop) return;
        accept(data.race);
        setConnected(true);
        setMissing(false);
        setAuthError(false);
      } catch (error) {
        if (stop) return;
        if (error.status === 401) setAuthError(true);
        else if (error.status === 404) setMissing(true);
        else setConnected(false);
      }
    }
    pull();
    const timer = window.setInterval(pull, 2000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [id]);

  async function start() {
    setStarting(true);
    setStartError("");
    try {
      const data = await api(`/api/races/${id}/start`, { method: "POST", body: {} });
      accept(data.race);
      if (data.user) publishAccount(data.user);
    } catch (err) {
      setStartError(err.message);
    } finally {
      setStarting(false);
    }
  }

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

  return (
    <RaceStage
      key={race.id}
      race={race}
      clockOffset={clockOffset}
      connected={connected}
      credits={credits}
      starting={starting}
      startError={startError}
      onStart={start}
    />
  );
}

const PREVIEW_COLORS = { rabbit: "#f8f9fa", frog: "#7ec41f", turtle: "#3f9b2a" };

function AnimalPicker({ value, onChange }) {
  const previews = useMemo(
    () =>
      Object.keys(ANIMALS).map((animal, index) => ({
        animal,
        src: bakeSprite(animal, { color: PREVIEW_COLORS[animal] || PALETTE[index * 3], pattern: "none", accessory: "none" }).toDataURL(),
      })),
    []
  );
  return (
    <fieldset>
      <legend className="text-sm font-semibold">Animal and habitat</legend>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {previews.map((item) => (
          <button
            key={item.animal}
            type="button"
            onClick={() => onChange(item.animal)}
            className={`rounded-xl border px-2 py-2 text-center text-xs font-semibold ${value === item.animal ? "border-sky-500 bg-sky-50 text-sky-700" : "border-gray-200"}`}
          >
            <img src={item.src} alt="" className="mx-auto h-10 w-14 object-contain" />
            <span className="mt-1 block">{ANIMALS[item.animal].label}</span>
            <span className="block font-normal text-gray-500">{ANIMALS[item.animal].habitat}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function RaceSetup() {
  const navigate = useNavigate();
  const [user, setUser] = useState(undefined);
  const [name, setName] = useState("Official race");
  const [names, setNames] = useState("Alex\nSam\nJordan\nRiley");
  const [duration, setDuration] = useState("30");
  const [animal, setAnimal] = useState("rabbit");
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
          animal,
          sponsorIds: chosen,
        },
      });
      if (data.user) publishAccount(data.user);
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
        <AnimalPicker value={animal} onChange={setAnimal} />
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
