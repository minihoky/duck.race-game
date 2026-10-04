import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import RaceStage from "../components/RaceStage";
import { api } from "../lib/api";
import { me, publishAccount } from "../lib/auth";
import { useT } from "../lib/i18n";
import { usePageTitle } from "../lib/usePageTitle";
import { ANIMALS, PALETTE, bakeSprite, skinsFor } from "../race/art";

const MIN_DURATION = 10;
const MAX_DURATION = 120;
const MAX_NAMES = 200;

// A numeric keypad that types the race length in seconds; the digital clock shows the typed number as is.
function DurationPad({ value, onChange }) {
  const { t } = useT();
  const seconds = Number(value) || 0;
  const invalid = seconds < MIN_DURATION || seconds > MAX_DURATION;

  function press(digit) {
    const next = Math.min(MAX_DURATION, Number(`${seconds || ""}${digit}`));
    onChange(String(next));
  }

  function back() {
    onChange(String(Math.floor(seconds / 10)));
  }

  function onKeyDown(event) {
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      press(event.key);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      back();
    } else if (event.key === "Delete" || event.key === "Escape") {
      event.preventDefault();
      onChange("0");
    }
  }

  const key = "h-full min-h-[3.5rem] rounded-xl bg-gray-100 text-2xl font-bold transition hover:brightness-125 active:scale-95";
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{t("Race length")}</legend>
      <div className="mt-2 grid gap-4 sm:grid-cols-2" onKeyDown={onKeyDown}>
        <div
          className="flex min-h-[10rem] flex-col items-center justify-center rounded-2xl bg-[#05121f] px-4 py-6 shadow-inner ring-1 ring-sky-400/30"
          role="timer"
          aria-live="polite"
          aria-label={t("{n} seconds", { n: seconds })}
        >
          <span
            className={`font-mono text-8xl font-bold tabular-nums tracking-widest ${invalid ? "text-red-400" : "text-emerald-300"}`}
            style={{ textShadow: "0 0 18px currentColor" }}
          >
            {seconds}
          </span>
          <span className="mt-2 text-sm uppercase tracking-[0.2em] text-sky-200/70">{t("seconds")}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button key={digit} type="button" className={key} onClick={() => press(digit)}>
              {digit}
            </button>
          ))}
          <button type="button" className={`${key} text-sm text-red-500`} onClick={() => onChange("0")} aria-label={t("Clear")}>
            C
          </button>
          <button type="button" className={key} onClick={() => press(0)}>
            0
          </button>
          <button type="button" className={key} onClick={back} aria-label={t("Delete last digit")}>
            ⌫
          </button>
        </div>
      </div>
    </fieldset>
  );
}

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
  try {
    sessionStorage.setItem(cacheKey(race.id), JSON.stringify(payload));
    sessionStorage.setItem("duck-live-race", race.id);
  } catch {
    /* storage full or unavailable */
  }
  return payload;
}

function offsetOf(saved) {
  return saved.serverNow - saved.localNow;
}

function SignInNotice({ title, text }) {
  const { t } = useT();
  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-24 text-center">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-3 text-gray-600">{text}</p>
      <button type="button" className="mt-6 rounded-xl bg-sky-500 px-5 py-2 font-semibold text-white" onClick={() => window.dispatchEvent(new Event("duck-open-signin"))}>
        {t("Sign in")}
      </button>
    </div>
  );
}

function RacePlayer({ id }) {
  const { t } = useT();
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
  usePageTitle(race ? race.name : t("Official race"));

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

  async function start(clientSeed) {
    setStarting(true);
    setStartError("");
    try {
      const data = await api(`/api/races/${id}/start`, { method: "POST", body: { clientSeed } });
      accept(data.race);
      if (data.user) publishAccount(data.user);
    } catch (err) {
      setStartError(err.message);
    } finally {
      setStarting(false);
    }
  }

  if (authError && !race) {
    return <SignInNotice title={t("Sign in to restore this race")} text={t("The official result stays on the server. Sign in again to bring the race back to the official clock.")} />;
  }
  if (missing) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-16 pt-24 text-center">
        <h1 className="text-3xl font-bold">{t("Result not found")}</h1>
        <p className="mt-3 text-gray-600">{t("That result ID is not on this account.")}</p>
        <Link to="/history" className="mt-6 inline-block font-semibold text-sky-600">
          {t("Back to race history")}
        </Link>
      </div>
    );
  }
  if (!race) return <p className="px-4 pb-16 pt-24 text-center text-gray-500">{t("Restoring the official race…")}</p>;

  return <RaceStage key={race.id} race={race} clockOffset={clockOffset} connected={connected} credits={credits} starting={starting} startError={startError} onStart={start} />;
}

const PREVIEW_COLORS = { rabbit: "#f8f9fa", frog: "#7ec41f", fish: "#ffa94d", turtle: "#3f9b2a", snail: "#c4602a" };

function AnimalPicker({ value, onChange }) {
  const { t } = useT();
  const previews = useMemo(
    () =>
      Object.keys(ANIMALS).map((animal, index) => ({
        animal,
        src: bakeSprite(animal, { color: PREVIEW_COLORS[animal] || PALETTE[index * 3], pattern: "none", accessory: "none" }).toDataURL(),
      })),
    []
  );
  const skins = useMemo(() => {
    const look = skinsFor({ id: `preview-${value}` });
    return Array.from({ length: 8 }, (_, lane) => bakeSprite(value, look(lane)).toDataURL());
  }, [value]);
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{t("Animal and habitat")}</legend>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {previews.map((item) => (
          <button
            key={item.animal}
            type="button"
            onClick={() => onChange(item.animal)}
            className={`rounded-xl border px-2 py-2 text-center text-xs font-semibold ${value === item.animal ? "border-sky-500 bg-sky-50 text-sky-700" : "border-gray-200"}`}
            aria-pressed={value === item.animal}
          >
            <img src={item.src} alt="" className="mx-auto h-10 w-14 object-contain" />
            <span className="mt-1 block">{t(ANIMALS[item.animal].label)}</span>
            <span className="block font-normal text-gray-500">{t(ANIMALS[item.animal].habitat)}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-gray-50 p-3">
        <p className="text-xs text-gray-500">{t("Every participant gets a different skin: color, pattern and accessory. Skins never change the odds.")}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {skins.map((src, index) => (
            <img key={index} src={src} alt="" className="h-9 w-12 object-contain" />
          ))}
        </div>
      </div>
    </fieldset>
  );
}

function RaceSetup() {
  const { t } = useT();
  const navigate = useNavigate();
  const [user, setUser] = useState(undefined);
  const [name, setName] = useState("");
  const [names, setNames] = useState("Ana\nBruno\nCarla\nDiego");
  const [duration, setDuration] = useState("30");
  const [animal, setAnimal] = useState("rabbit");
  const [sponsors, setSponsors] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const saveAfterSignIn = useRef(false);
  usePageTitle(t("Official race"));

  const list = names
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const tooMany = list.length > MAX_NAMES;
  const durationBad = Number(duration) < MIN_DURATION || Number(duration) > MAX_DURATION;

  async function save() {
    setPending(true);
    setError("");
    try {
      const data = await api("/api/races", {
        method: "POST",
        body: { name: name.trim() || t("Official race"), names: names.split("\n"), durationSec: Number(duration), animal, sponsorIds: chosen },
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

  function shuffleNames() {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    setNames(copy.join("\n"));
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-20">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">{t("Official race")}</p>
      <h1 className="mt-1 text-3xl font-bold">{t("Set up a race")}</h1>
      <p className="mt-3 text-gray-600">{t("Saving this setup does not use a credit. One credit is used only when you start the race. Replaying a finished race does not use another credit.")}</p>
      {user && <p className="mt-3 font-semibold">{t("Balance: {n}", { n: user.credits })}</p>}
      {user && user.status === "restricted" && <p className="mt-3 text-sm text-red-600">{t("This account is restricted. Contact support.")}</p>}
      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <label className="block text-sm font-semibold">
          {t("Race name")}
          <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 font-normal" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("Official race")} maxLength={60} />
        </label>
        <label className="block text-sm font-semibold">
          <span className="flex items-center justify-between">
            <span>{t("Participants, one per line")}</span>
            <span className={`font-normal ${tooMany ? "text-red-600" : "text-gray-500"}`}>
              {list.length}/{MAX_NAMES}
            </span>
          </span>
          <textarea className="mt-1 h-44 w-full rounded-xl border border-gray-200 px-3 py-2 font-normal" value={names} onChange={(event) => setNames(event.target.value)} required />
        </label>
        <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" className="rounded-lg bg-gray-100 px-3 py-1 font-semibold" onClick={shuffleNames}>
            {t("Shuffle lanes")}
          </button>
          <button type="button" className="rounded-lg bg-gray-100 px-3 py-1 font-semibold" onClick={() => setNames([...new Set(list)].join("\n"))}>
            {t("Remove duplicates")}
          </button>
          <button
            type="button"
            className="rounded-lg bg-gray-100 px-3 py-1 font-semibold"
            onClick={() => setNames(Array.from({ length: Math.min(MAX_NAMES, Math.max(2, list.length || 10)) }, (_, index) => `#${index + 1}`).join("\n"))}
          >
            {t("Use numbers")}
          </button>
        </div>
        <AnimalPicker value={animal} onChange={setAnimal} />
        <DurationPad value={duration} onChange={setDuration} />
        {durationBad && <p className="text-sm text-red-600">{t("Set a length between {min} and {max} seconds.", { min: MIN_DURATION, max: MAX_DURATION })}</p>}
        {sponsors.length > 0 && (
          <fieldset>
            <legend className="text-sm font-semibold">{t("Your sponsor image")}</legend>
            <p className="text-xs text-gray-500">{t("Platform sponsors always appear on the boards. You can add one of your own.")}</p>
            <div className="mt-2 space-y-2">
              {sponsors.map((sponsor) => (
                <label key={sponsor.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={chosen.includes(sponsor.id)}
                    onChange={(event) => {
                      setChosen(event.target.checked ? [sponsor.id] : []);
                    }}
                  />
                  {sponsor.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="rounded-xl bg-sky-500 px-5 py-2 font-semibold text-white disabled:opacity-50" disabled={pending || tooMany || list.length < 2 || durationBad}>
          {pending ? t("Saving…") : t("Save setup")}
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
