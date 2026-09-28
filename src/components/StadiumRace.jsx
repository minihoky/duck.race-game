import { useEffect, useRef, useState } from "react";
import Scoreboard from "./Scoreboard";

const COLORS = ["#ffd23a", "#7dd3fc", "#f9a8d4", "#86efac", "#fdba74", "#c4b5fd", "#fca5a5", "#67e8f9"];

function pace(elapsed, finishMs, lane) {
  const t = Math.min(1, Math.max(0, elapsed / finishMs));
  const curve = 1.15 + (lane % 5) * 0.28;
  return Math.pow(t, curve);
}

function standingRows(entrants, elapsed) {
  return entrants
    .map((entrant) => ({
      ...entrant,
      progress: pace(elapsed, entrant.finishMs, entrant.lane),
      done: elapsed >= entrant.finishMs,
    }))
    .sort((a, b) => {
      if (a.done && b.done) return a.place - b.place;
      if (a.done !== b.done) return a.done ? -1 : 1;
      return b.progress - a.progress || a.place - b.place;
    });
}

function Duck({ color }) {
  return (
    <svg viewBox="0 0 64 40" className="h-8 w-12 shrink-0 drop-shadow" aria-hidden="true">
      <ellipse cx="24" cy="24" rx="16" ry="10" fill={color} stroke="#1c2836" strokeWidth="2" />
      <circle cx="40" cy="16" r="8" fill={color} stroke="#1c2836" strokeWidth="2" />
      <path d="M46 15h12l-4 3 4 3H46" fill="#f08a14" stroke="#1c2836" strokeWidth="2" />
      <circle cx="43" cy="14" r="1.5" fill="#161616" />
    </svg>
  );
}

export default function StadiumRace({ race, sync, connected, replayAt, onReplay }) {
  const [now, setNow] = useState(() => Date.now());
  const [restored, setRestored] = useState(false);
  const seen = useRef(null);
  if (!seen.current || seen.current.id !== race.id) {
    const opening = sync ? sync.serverNow + (Date.now() - sync.localNow) - race.startedAt : 0;
    seen.current = { id: race.id, elapsed: opening };
  }
  const end = race.entrants.reduce((max, entrant) => Math.max(max, entrant.finishMs), 0);
  const winner = race.entrants.find((entrant) => entrant.place === 1) || race.entrants[0];

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      setNow(Date.now());
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!seen.current || seen.current.id !== race.id || seen.current.elapsed < 2000 || race.status !== "racing" || replayAt != null) return undefined;
    setRestored(true);
    const timer = window.setTimeout(() => setRestored(false), 5000);
    return () => window.clearTimeout(timer);
  }, [race.id, race.status, replayAt]);

  let elapsed = end;
  if (replayAt != null) elapsed = now - replayAt;
  else if (race.status === "racing" && sync) elapsed = sync.serverNow + (now - sync.localNow) - race.startedAt;
  elapsed = Math.max(0, elapsed);
  const shown = Math.min(elapsed, end);
  const playing = replayAt != null && elapsed < end;
  const showResults = !playing && (race.status === "finished" || elapsed >= end);
  const winnerDone = shown >= winner.finishMs;
  const rows = standingRows(race.entrants, shown);
  const lanes = [...race.entrants].sort((a, b) => a.lane - b.lane);
  const live = race.status === "racing" && replayAt == null && elapsed < end;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-3">
        <Scoreboard
          title={race.name}
          elapsed={shown}
          sponsors={race.sponsors}
          headline={winnerDone ? `WINNER  ${winner.name}` : race.name}
        />
        {live && !connected && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Connection lost. This race is saved on the server and will resume on the official clock when the connection returns.
          </p>
        )}
        {restored && connected && (
          <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800">Race restored to the official clock.</p>
        )}
        <div className="relative overflow-hidden rounded-2xl bg-[#083454] shadow-inner">
          <div
            className="race-drift pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent, transparent 16px, rgba(255,255,255,0.16) 16px, rgba(255,255,255,0.16) 18px)",
            }}
          />
          <div className="absolute bottom-0 right-[7%] top-0 w-1 bg-white/90" />
          <div className="relative">
            {lanes.map((entrant) => {
              const progress = pace(shown, entrant.finishMs, entrant.lane);
              const done = shown >= entrant.finishMs;
              return (
                <div key={entrant.lane} className={`relative border-b border-white/10 ${lanes.length > 16 ? "h-9" : "h-12"}`}>
                  <div className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1" style={{ left: `calc(${progress} * (100% - 7.5rem))` }}>
                    <Duck color={COLORS[entrant.lane % COLORS.length]} />
                    <span className="max-w-[7rem] truncate rounded-full bg-black/35 px-2 py-0.5 text-xs font-semibold text-white">
                      {done ? `${entrant.place}. ` : ""}
                      {entrant.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {showResults && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#041422]/80 p-4">
              <div className="max-h-full w-full max-w-md overflow-auto rounded-2xl bg-white p-6 text-gray-900">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Official result</p>
                <h2 className="mt-1 text-3xl font-bold">{winner.name}</h2>
                <p className="mt-1 text-sm text-gray-500">Result ID {race.id}</p>
                <ol className="mt-4 space-y-1 text-sm">
                  {[...race.entrants]
                    .sort((a, b) => a.place - b.place)
                    .map((entrant) => (
                      <li key={entrant.lane} className="flex justify-between gap-3">
                        <span>
                          {entrant.place}. {entrant.name}
                        </span>
                      </li>
                    ))}
                </ol>
                <p className="mt-4 text-sm text-gray-600">Replaying this saved result does not use another credit.</p>
                <button type="button" className="mt-4 w-full rounded-xl bg-sky-500 py-2 font-semibold text-white" onClick={onReplay}>
                  Replay result
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <aside className="rounded-2xl bg-[#102033] p-4 text-white">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#d6b25e]">Standings</h2>
        <ol className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.lane} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm">
              <span className="w-6 font-bold text-[#7dffa1]">{row.done ? row.place : "–"}</span>
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              <span className="text-xs text-white/60">{row.done ? "In" : ""}</span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
