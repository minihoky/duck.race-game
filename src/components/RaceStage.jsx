import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cryptoAvailable, randomClientSeed } from "../lib/fairness";
import { ANIMALS } from "../race/art";
import { createRace } from "../race/engine";

const SETTLE_MS = 1200;
const FINAL_VIEW_MS = 1500;

function lineupOf(race) {
  if (race.entrants && race.entrants.length) return race;
  return {
    ...race,
    entrants: race.names.map((name, lane) => ({ name, lane, finishMs: race.durationMs, place: lane + 1 })),
  };
}

export default function RaceStage({ race, clockOffset, connected, credits, starting, startError, onStart }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [follow, setFollow] = useState("");
  const [replayAt, setReplayAt] = useState(null);
  const [phase, setPhase] = useState("live");
  const [dismissed, setDismissed] = useState(false);
  const [restored, setRestored] = useState(false);
  const [clientSeed, setClientSeed] = useState(() => (cryptoAvailable() ? randomClientSeed() : ""));
  const leadIn = race.leadInMs || 0;
  const fair = race.fairness;
  const seedOk = !clientSeed || /^[A-Za-z0-9_-]{1,64}$/.test(clientSeed);

  const sponsorImages = useMemo(
    () =>
      (race.sponsors || []).map((sponsor) => {
        const image = new Image();
        image.src = `/api/sponsors/${sponsor.id}/image`;
        return image;
      }),
    [race.id, (race.sponsors || []).map((sponsor) => sponsor.id).join(",")]
  );

  const shown = useMemo(() => lineupOf(race), [race.id, race.status, race.motionSeed, race.entrants?.length, race.names.join("\n")]);
  const engine = useMemo(() => createRace(shown, sponsorImages), [shown, sponsorImages]);

  const live = useRef({});
  live.current = { race, clockOffset, replayAt, follow, engine, leadIn };

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
    function tick() {
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
    setDismissed(true);
    setReplayAt(Date.now());
  }

  function fullscreen() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (wrap.requestFullscreen) wrap.requestFullscreen();
  }

  const winner = engine.plan.winner;
  const animal = ANIMALS[race.animal] || ANIMALS.rabbit;
  const results = race.entrants && race.entrants.length ? [...race.entrants].sort((a, b) => a.place - b.place) : [];
  const isLive = race.status === "racing" && replayAt == null && phase === "live";

  return (
    <div className="mx-auto max-w-6xl px-3 pb-10 pt-20 sm:px-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
            Official race · {animal.label} · {animal.habitat}
          </p>
          <h1 className="truncate text-2xl font-bold">{race.name}</h1>
          <p className="text-xs text-gray-500">
            Result ID {race.id} · {race.names.length} racers
            {fair && (
              <>
                {" · "}
                <Link to={`/verify/${race.id}`} className="font-semibold text-sky-600">
                  Verify
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {replayAt != null && <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">REPLAY · no credit used</span>}
          {isLive && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">● LIVE</span>}
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Camera</span>
            <select className="rounded-lg border border-gray-200 px-2 py-1" value={follow} onChange={(event) => setFollow(event.target.value)}>
              <option value="">Follow the leaders</option>
              {[...race.names.map((name, lane) => ({ name, lane }))]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((item) => (
                  <option key={item.lane} value={item.lane}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <button type="button" className="rounded-lg border border-gray-200 px-3 py-1 text-sm font-semibold" onClick={fullscreen}>
            Fullscreen
          </button>
        </div>
      </div>

      {isLive && !connected && (
        <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Connection lost. The result is already saved on the server, and the race keeps following the official clock.
        </p>
      )}
      {restored && connected && <p className="mb-3 rounded-xl bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800">Race restored to the official clock.</p>}

      <div ref={wrapRef} className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#0b1118] shadow-lg sm:aspect-video">
        <canvas ref={canvasRef} className="block h-full w-full" />

        {phase === "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-gray-900 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Lineup locked</p>
              <h2 className="mt-1 text-2xl font-bold">{race.names.length} racers ready</h2>
              <p className="mt-2 text-sm text-gray-600">
                The result is decided by the server when you start. Starting uses 1 credit. Refreshing or replaying never draws a new result.
              </p>
              {fair && (
                <div className="mt-3 rounded-xl bg-gray-50 p-3 text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Server seed hash (locked)</p>
                  <p className="break-all font-mono text-[11px] text-gray-700">{fair.seedHash}</p>
                  <label className="mt-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500" htmlFor="client-seed">
                    Client seed
                  </label>
                  <input
                    id="client-seed"
                    className={`mt-1 w-full rounded-lg border px-2 py-1 font-mono text-xs ${seedOk ? "border-gray-200" : "border-red-400"}`}
                    value={clientSeed}
                    maxLength={64}
                    onChange={(event) => setClientSeed(event.target.value.trim())}
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    Mixed into the draw at start, so nobody can know the result in advance.{" "}
                    <Link to={`/verify/${race.id}`} className="font-semibold text-sky-600" target="_blank">
                      Public proof
                    </Link>
                  </p>
                </div>
              )}
              {credits != null && <p className="mt-3 text-sm font-semibold">Balance: {credits} credit{credits === 1 ? "" : "s"}</p>}
              {startError && (
                <div className="mt-3 text-sm text-red-600">
                  <p>{startError}</p>
                  <Link to="/credits" className="mt-1 inline-block font-semibold text-sky-600">
                    Buy credits
                  </Link>
                </div>
              )}
              <button
                type="button"
                className="mt-4 w-full rounded-xl bg-sky-500 py-3 font-bold text-white disabled:opacity-50"
                onClick={() => onStart(clientSeed)}
                disabled={starting || !seedOk}
              >
                {starting ? "Starting…" : "Start official race · 1 credit"}
              </button>
            </div>
          </div>
        )}

        {phase === "done" && !dismissed && results.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#041422]/75 p-4">
            <div className="flex max-h-full w-full max-w-md flex-col rounded-2xl bg-white p-6 text-gray-900 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Official result</p>
              <h2 className="mt-1 text-3xl font-bold">🏆 {winner.name}</h2>
              <p className="mt-1 text-xs text-gray-500">
                Result ID {race.id} · algorithm {race.algorithm}
              </p>
              <ol className="mt-4 min-h-0 flex-1 space-y-1 overflow-auto text-sm">
                {results.map((entrant) => (
                  <li key={entrant.lane} className={`flex justify-between gap-3 rounded-lg px-2 py-1 ${entrant.place <= 3 ? "bg-amber-50 font-semibold" : ""}`}>
                    <span>
                      {entrant.place}. {entrant.name}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" className="rounded-xl bg-sky-500 py-2 font-semibold text-white" onClick={replay}>
                  Replay
                </button>
                <button type="button" className="rounded-xl border border-gray-200 py-2 font-semibold" onClick={() => setDismissed(true)}>
                  View finish
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-gray-500">Replaying shows the same saved result and does not use a credit.</p>
              {fair && (
                <Link to={`/verify/${race.id}`} className="mt-2 text-center text-sm font-semibold text-emerald-600">
                  ✓ Verify this result publicly
                </Link>
              )}
            </div>
          </div>
        )}

        {phase === "done" && dismissed && (
          <button
            type="button"
            className="absolute bottom-10 right-3 rounded-xl bg-white/90 px-3 py-2 text-sm font-semibold text-gray-900 shadow"
            onClick={() => setDismissed(false)}
          >
            Show result
          </button>
        )}
      </div>
    </div>
  );
}
