import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cryptoAvailable, randomClientSeed } from "../lib/fairness";
import Fireworks from "./Fireworks";
import { useT } from "../lib/i18n";
import { ANIMALS } from "../race/art";
import { buildCommentary } from "../race/commentary";
import { createRace } from "../race/engine";
import { setSoundEnabled, sfx, soundEnabled, unlockAudio } from "../race/sound";

const SETTLE_MS = 1200;
const FINAL_VIEW_MS = 1500;
const CONFETTI = ["#ffd43b", "#ff6b6b", "#4dabf7", "#69db7c", "#f783ac", "#ffa94d", "#b197fc"];

// Gold for the winner, then a clearly different hue for every further place.
const RANK_COLORS = ["#fbbf24", "#22d3ee", "#fb923c", "#4ade80", "#a78bfa", "#f472b6", "#f87171", "#38bdf8", "#2dd4bf", "#c084fc"];
const rankColor = (place) => RANK_COLORS[(Math.max(1, place) - 1) % RANK_COLORS.length];

function lineupOf(race) {
  if (race.entrants && race.entrants.length) return race;
  return {
    ...race,
    entrants: race.names.map((name, lane) => ({ name, lane, finishMs: race.durationMs, place: lane + 1 })),
  };
}

function sponsorImage(sponsor) {
  const image = new Image();
  image.src = `/api/sponsors/${sponsor.id}/image${sponsor.v ? `?v=${sponsor.v}` : ""}`;
  return image;
}

function burst(list, x, y, { count = 24, speed = 0.35, colors = CONFETTI, gravity = 0.0006, life = 1400, shape = "confetti" } = {}) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.35 + Math.random());
    list.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - speed * 0.6,
      gravity,
      life,
      age: 0,
      size: 3 + Math.random() * 4,
      spin: Math.random() * Math.PI,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape,
    });
  }
  if (list.length > 900) list.splice(0, list.length - 900);
}

function drawParticles(g, list, dt) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.age += dt;
    if (p.age >= p.life) {
      list.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.spin += dt * 0.01;
    g.globalAlpha = Math.max(0, 1 - p.age / p.life);
    g.fillStyle = p.color;
    if (p.shape === "heart") {
      g.font = `${Math.round(p.size * 3.2)}px sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("❤", p.x, p.y);
    } else {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.spin);
      g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      g.restore();
    }
  }
  g.globalAlpha = 1;
}

export default function RaceStage({ race, clockOffset, connected, credits, starting, startError, onStart }) {
  const { t, lang } = useT();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const lastCheer = useRef(0);
  const [follow, setFollow] = useState("");
  const [replayAt, setReplayAt] = useState(null);
  const [phase, setPhase] = useState("live");
  const [dismissed, setDismissed] = useState(false);
  const [restored, setRestored] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [sound, setSound] = useState(soundEnabled);
  const [cheers, setCheers] = useState(0);
  const [clientSeed, setClientSeed] = useState(() => (cryptoAvailable() ? randomClientSeed() : ""));
  const leadIn = race.leadInMs || 0;
  const fair = race.fairness;
  const seedOk = !clientSeed || /^[A-Za-z0-9_-]{1,64}$/.test(clientSeed);

  const sponsorKey = [...(race.sponsors || []), ...(race.globalSponsors || [])].map((sponsor) => `${sponsor.id}:${sponsor.v || 0}`).join(",");
  const sponsorImages = useMemo(() => [...(race.sponsors || []), ...(race.globalSponsors || [])].map(sponsorImage), [race.id, sponsorKey]);

  const engineLabels = useMemo(
    () => ({
      finish: t("FINISH"),
      official: t("OFFICIAL RACE"),
      lineup: t("LINEUP"),
      live: t("LIVE"),
      result: t("RESULT"),
      finalStretch: t("FINAL STRETCH"),
      winner: t("WINNER"),
      go: t("GO!"),
    }),
    [lang]
  );

  const shown = useMemo(() => lineupOf(race), [race.id, race.status, race.motionSeed, race.entrants?.length, race.names.join("\n")]);
  const engine = useMemo(() => createRace(shown, sponsorImages, engineLabels), [shown, sponsorImages, engineLabels]);
  const events = useMemo(() => (race.status === "ready" ? [] : buildCommentary(engine.plan)), [engine, race.status]);

  const live = useRef({});
  live.current = { race, clockOffset, replayAt, follow, engine, leadIn, events };

  useEffect(() => {
    if (race.status !== "racing" || !race.startedAt) return undefined;
    const elapsed = Date.now() + clockOffset - race.startedAt;
    if (elapsed < 2000) return undefined;
    setRestored(true);
    const timer = window.setTimeout(() => setRestored(false), 5000);
    return () => window.clearTimeout(timer);
  }, [race.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const g = canvas.getContext("2d");
    let size = { w: 0, h: 0, ratio: 1 };

    function resize() {
      const rect = wrap.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      size = { w: rect.width, h: rect.height, ratio };
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    let frame = 0;
    let lastPhase = "";
    let lastFrame = performance.now();
    let prevT = null;
    let shownEvents = -1;

    function tick(now) {
      const dt = Math.min(64, now - lastFrame);
      lastFrame = now;
      const state = live.current;
      const { plan } = state.engine;
      let t;
      let status = state.race.status;
      if (state.replayAt != null) {
        t = Date.now() - state.replayAt - state.leadIn;
        status = "racing";
      } else if (status === "racing" && state.race.startedAt) {
        t = Date.now() + state.clockOffset - state.race.startedAt;
      } else if (status === "finished") {
        t = plan.endMs + FINAL_VIEW_MS;
      } else {
        t = -state.leadIn;
      }
      const followLane = state.follow === "" ? null : Number(state.follow);
      g.setTransform(size.ratio, 0, 0, size.ratio, 0, 0);
      state.engine.draw(g, size.w, size.h, t, { follow: followLane, status: state.race.status === "ready" ? "ready" : status });

      const continuous = prevT != null && t - prevT >= 0 && t - prevT < 500 && status === "racing";
      if (continuous && t < 0 && t > -3200 && Math.ceil(-t / 1000) !== Math.ceil(-prevT / 1000)) sfx.tick();
      if (continuous && prevT < 0 && t >= 0) sfx.go();

      let count = 0;
      while (count < state.events.length && state.events[count].at <= t) count += 1;
      if (count !== shownEvents) {
        if (continuous) {
          for (let i = Math.max(0, shownEvents); i < count; i += 1) {
            const event = state.events[i];
            if (event.kind === "lead") sfx.lead();
            else if (event.kind === "surge") sfx.surge();
            else if (event.kind === "winner") {
              sfx.finish();
              const spot = state.engine.positionOf(event.lane);
              burst(particles.current, spot ? spot.x + spot.w / 2 : size.w / 2, spot ? spot.y : size.h / 2, { count: 90, speed: 0.5 });
              for (let k = 0; k < 6; k += 1) burst(particles.current, (size.w * (k + 0.5)) / 6, -10, { count: 20, speed: 0.25, gravity: 0.0009, life: 2400 });
            }
          }
        }
        shownEvents = count;
        setEventCount(count);
      }
      prevT = t;

      drawParticles(g, particles.current, dt);

      let next = "live";
      if (state.race.status === "ready") next = "ready";
      else if (t >= plan.endMs + SETTLE_MS || (state.race.status === "finished" && state.replayAt == null)) next = "done";
      if (next !== lastPhase) {
        lastPhase = next;
        setPhase(next);
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (phase === "done") setDismissed(false);
  }, [phase]);

  function replay() {
    unlockAudio();
    particles.current.length = 0;
    setDismissed(true);
    setReplayAt(Date.now());
  }

  function fullscreen() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (wrap.requestFullscreen) wrap.requestFullscreen();
  }

  function onCanvasClick(event) {
    unlockAudio();
    if (phase === "ready") return;
    const rect = canvasRef.current.getBoundingClientRect();
    const lane = engine.hitTest(event.clientX - rect.left, event.clientY - rect.top);
    if (lane == null) return;
    setFollow((current) => (current === String(lane) ? "" : String(lane)));
    const spot = engine.positionOf(lane);
    if (spot) burst(particles.current, spot.x + spot.w / 2, spot.y, { count: 10, speed: 0.18, shape: "heart", colors: ["#ff6b8b", "#ffd43b"], life: 900 });
  }

  function cheer() {
    unlockAudio();
    const now = Date.now();
    if (now - lastCheer.current < 250) return;
    lastCheer.current = now;
    const wrap = wrapRef.current;
    const lane = follow !== "" ? Number(follow) : leaderLane();
    const spot = engine.positionOf(lane);
    const x = spot ? spot.x + spot.w / 2 : wrap.clientWidth / 2;
    const y = spot ? spot.y : wrap.clientHeight / 2;
    burst(particles.current, x, y, { count: 26, speed: 0.3, shape: "heart", colors: ["#ff6b8b", "#ff8fab", "#ffd43b"], life: 1300 });
    sfx.cheer();
    setCheers((value) => value + 1);
  }

  function leaderLane() {
    let best = null;
    for (const track of engine.plan.tracks) {
      const spot = engine.positionOf(track.lane);
      if (spot && (!best || spot.x > best.x)) best = { lane: track.lane, x: spot.x };
    }
    return best ? best.lane : engine.plan.winner.lane;
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    if (next) unlockAudio();
  }

  const winner = engine.plan.winner;
  const animal = ANIMALS[race.animal] || ANIMALS.rabbit;
  const results = race.entrants && race.entrants.length ? [...race.entrants].sort((a, b) => a.place - b.place) : [];
  const isLive = race.status === "racing" && replayAt == null && phase === "live";
  const nameOf = (lane) => race.names[lane] || "";
  const ticker = events.slice(Math.max(0, eventCount - 3), eventCount);

  function describe(event) {
    const name = nameOf(event.lane);
    switch (event.kind) {
      case "start":
        return t("And they're off!");
      case "lead":
        return t("{name} takes the lead!", { name });
      case "halfway":
        return t("Halfway there! {name} is in front.", { name });
      case "surge":
        return t("{name} picks up speed!", { name });
      case "final":
        return t("Final stretch!");
      case "photo":
        return t("It's going to be a photo finish!");
      case "winner":
        return t("{name} wins!", { name });
      case "comeback":
        return t("What a comeback by {name}!", { name });
      default:
        return "";
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-3 pb-10 pt-20 sm:px-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
            {t("Official race")} · {t(animal.label)} · {t(animal.habitat)}
          </p>
          <h1 className="truncate text-2xl font-bold">{race.name}</h1>
          <p className="text-xs text-gray-500">
            {t("Result ID {id}", { id: race.id })} · {t(race.names.length === 1 ? "{n} racer" : "{n} racers", { n: race.names.length })}
            {fair && (
              <>
                {" · "}
                <Link to={`/verify/${race.id}`} className="font-semibold text-sky-600">
                  {t("Verify")}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {replayAt != null && <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">{t("REPLAY · no credit used")}</span>}
          {isLive && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">● {t("LIVE")}</span>}
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">{t("Camera")}</span>
            <select className="max-w-[11rem] rounded-lg border border-gray-200 px-2 py-1" value={follow} onChange={(event) => setFollow(event.target.value)}>
              <option value="">{t("Follow the leaders")}</option>
              {race.names
                .map((name, lane) => ({ name, lane }))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((item) => (
                  <option key={item.lane} value={item.lane}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <button type="button" className="rounded-lg border border-gray-200 px-3 py-1 text-sm font-semibold" onClick={toggleSound} aria-pressed={sound}>
            {sound ? `🔊 ${t("Sound on")}` : `🔇 ${t("Sound off")}`}
          </button>
          <button type="button" className="rounded-lg border border-gray-200 px-3 py-1 text-sm font-semibold" onClick={fullscreen}>
            {t("Fullscreen")}
          </button>
        </div>
      </div>

      {isLive && !connected && (
        <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {t("Connection lost. The result is already saved on the server, and the race keeps following the official clock.")}
        </p>
      )}
      {restored && connected && <p className="mb-3 rounded-xl bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800">{t("Race restored to the official clock.")}</p>}

      <div ref={wrapRef} className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#0b1118] shadow-lg sm:aspect-video">
        <canvas ref={canvasRef} className="block h-full w-full cursor-pointer" onClick={onCanvasClick} />

        {phase !== "ready" && ticker.length > 0 && (
          <ul className="pointer-events-none absolute bottom-9 left-3 max-w-[70%] space-y-1 sm:bottom-11">
            {ticker.map((event, index) => (
              <li
                key={`${event.at}-${event.kind}-${event.lane ?? ""}`}
                className="w-fit rounded-lg bg-[#0a121c]/75 px-3 py-1 text-xs font-semibold text-white shadow sm:text-sm"
                style={{ opacity: 0.45 + (index + 1) / (ticker.length * 1.8) }}
              >
                🎙️ {describe(event)}
              </li>
            ))}
          </ul>
        )}

        {phase === "live" && race.status !== "ready" && (
          <button
            type="button"
            onClick={cheer}
            className="absolute bottom-9 right-3 rounded-full bg-pink-500/90 px-4 py-2 text-sm font-bold text-white shadow-lg active:scale-95 sm:bottom-11"
          >
            🎉 {t("Cheer")}
            {cheers > 0 ? ` ×${cheers}` : ""}
          </button>
        )}

        {phase === "ready" && (
          <div className="absolute inset-0 flex items-center justify-center overflow-auto bg-black/35 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-gray-900 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">{t("Lineup locked")}</p>
              <h2 className="mt-1 text-2xl font-bold">{t("{n} racers ready", { n: race.names.length })}</h2>
              <p className="mt-2 text-sm text-gray-600">
                {t("The result is decided by the server when you start. Starting uses 1 credit. Refreshing or replaying never draws a new result.")}
              </p>
              {fair && (
                <div className="mt-3 rounded-xl bg-gray-50 p-3 text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{t("Server seed hash (locked)")}</p>
                  <p className="break-all font-mono text-[11px] text-gray-700">{fair.seedHash}</p>
                  <label className="mt-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500" htmlFor="client-seed">
                    {t("Client seed")}
                  </label>
                  <input
                    id="client-seed"
                    className={`mt-1 w-full rounded-lg border px-2 py-1 font-mono text-xs ${seedOk ? "border-gray-200" : "border-red-400"}`}
                    value={clientSeed}
                    maxLength={64}
                    onChange={(event) => setClientSeed(event.target.value.trim())}
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    {t("Mixed into the draw at start, so nobody can know the result in advance.")}{" "}
                    <Link to={`/verify/${race.id}`} className="font-semibold text-sky-600" target="_blank">
                      {t("Public proof")}
                    </Link>
                  </p>
                </div>
              )}
              {credits != null && <p className="mt-3 text-sm font-semibold">{t("Balance: {n}", { n: credits })}</p>}
              {startError && (
                <div className="mt-3 text-sm text-red-600">
                  <p>{startError}</p>
                  <Link to="/credits" className="mt-1 inline-block font-semibold text-sky-600">
                    {t("Buy credits")}
                  </Link>
                </div>
              )}
              <button
                type="button"
                className="mt-4 w-full rounded-xl bg-sky-500 py-3 font-bold text-white disabled:opacity-50"
                onClick={() => {
                  unlockAudio();
                  onStart(clientSeed);
                }}
                disabled={starting || !seedOk}
              >
                {starting ? t("Starting…") : t("Start official race · 1 credit")}
              </button>
            </div>
          </div>
        )}

        {phase === "done" && !dismissed && results.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#041422]/75 p-4">
            <Fireworks />
            <div className="relative flex max-h-full w-full max-w-md flex-col rounded-2xl bg-white p-6 text-gray-900 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">{t("Official result")}</p>
              <h2 className="mt-1 text-3xl font-bold">🏆 {winner.name}</h2>
              <p className="mt-1 text-xs text-gray-500">
                {t("Result ID {id}", { id: race.id })} · {t("algorithm {name}", { name: race.algorithm })}
              </p>
              <ol className="mt-4 min-h-0 flex-1 space-y-1 overflow-auto text-sm">
                {results.map((entrant) => (
                  <li
                    key={entrant.lane}
                    className={`flex justify-between gap-3 rounded-lg px-2 py-1 ${entrant.place <= 3 ? "bg-amber-50 font-semibold" : ""} ${entrant.place === 1 ? "result-champ" : ""}`}
                  >
                    <span>
                      <span className="result-rank" style={{ color: rankColor(entrant.place) }}>
                        {entrant.place}.
                      </span>{" "}
                      {entrant.name}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" className="rounded-xl bg-sky-500 py-2 font-semibold text-white" onClick={replay}>
                  {t("Replay")}
                </button>
                <button type="button" className="rounded-xl border border-gray-200 py-2 font-semibold" onClick={() => setDismissed(true)}>
                  {t("View finish")}
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-gray-500">{t("Replaying shows the same saved result and does not use a credit.")}</p>
              {fair && (
                <Link to={`/verify/${race.id}`} className="mt-2 text-center text-sm font-semibold text-emerald-600">
                  ✓ {t("Verify this result publicly")}
                </Link>
              )}
            </div>
          </div>
        )}

        {phase === "done" && dismissed && (
          <button type="button" className="absolute bottom-10 right-3 rounded-xl bg-white/90 px-3 py-2 text-sm font-semibold text-gray-900 shadow" onClick={() => setDismissed(false)}>
            {t("Show result")}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500">{t("Tap a racer to follow it. Cheering and effects are only for fun and never change the result.")}</p>
    </div>
  );
}
