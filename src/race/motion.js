const STEP_MS = 40;
const COAST_MS = 650;

export function mulberry32(seed) {
  let value = seed >>> 0;
  return function next() {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text) {
  let hash = 0x811c9dc5;
  const value = String(text);
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function smooth(knots, gap, t) {
  const x = Math.max(0, t / gap);
  const i = Math.min(knots.length - 2, Math.floor(x));
  const f = x - i;
  const eased = f * f * (3 - 2 * f);
  return knots[i] + (knots[i + 1] - knots[i]) * eased;
}

function buildTrack(entrant, base) {
  const rand = mulberry32((base ^ Math.imul(entrant.lane + 1, 0x9e3779b1)) >>> 0);
  const finish = Math.max(1, entrant.finishMs);
  const gap = 900 + rand() * 700;
  const knots = [];
  for (let k = 0; k * gap <= finish + gap * 2; k += 1) knots.push(rand() * 2 - 1);
  const swing = 0.22 + rand() * 0.26;
  const reaction = 180 + rand() * 520;
  const bumps = [];
  const surges = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < surges; i += 1) {
    bumps.push({ at: finish * (0.1 + rand() * 0.82), width: 420 + rand() * 760, gain: 0.45 + rand() * 0.95 });
  }
  if (rand() < 0.4) bumps.push({ at: finish * (0.15 + rand() * 0.7), width: 380 + rand() * 500, gain: -(0.3 + rand() * 0.3) });

  function speed(t) {
    let value = 1 + swing * smooth(knots, gap, t);
    for (const bump of bumps) {
      const d = (t - bump.at) / bump.width;
      value += bump.gain * Math.exp(-d * d);
    }
    const launch = 1 - Math.exp(-t / reaction);
    return Math.max(0.16, value) * launch;
  }

  const steps = Math.max(2, Math.ceil(finish / STEP_MS));
  const dt = finish / steps;
  const cum = new Float64Array(steps + 1);
  let previous = speed(0);
  for (let i = 1; i <= steps; i += 1) {
    const current = speed(i * dt);
    cum[i] = cum[i - 1] + ((previous + current) / 2) * dt;
    previous = current;
  }
  const total = cum[steps] || 1;
  return {
    ...entrant,
    finishMs: finish,
    dt,
    cum,
    total,
    endSpeed: previous / total,
    phase: rand() * Math.PI * 2,
    surgeAt: bumps.filter((bump) => bump.gain > 0),
  };
}

export function buildPlan(race) {
  const seedText = race.motionSeed || race.id || "race";
  const base = race.motionSeed ? parseInt(seedText.slice(0, 8), 16) >>> 0 : hashString(seedText);
  const tracks = [...race.entrants].sort((a, b) => a.lane - b.lane).map((entrant) => buildTrack(entrant, base));
  const winner = tracks.find((track) => track.place === 1) || tracks[0];
  const endMs = tracks.reduce((max, track) => Math.max(max, track.finishMs), 0);
  return { tracks, winner, endMs, durationMs: race.durationMs || winner.finishMs };
}

export function progressAt(track, t) {
  if (t <= 0) return 0;
  if (t >= track.finishMs) {
    const over = t - track.finishMs;
    return 1 + track.endSpeed * COAST_MS * (1 - Math.exp(-over / COAST_MS));
  }
  const x = t / track.dt;
  const i = Math.floor(x);
  const f = x - i;
  const a = track.cum[i];
  const b = track.cum[Math.min(track.cum.length - 1, i + 1)];
  return (a + (b - a) * f) / track.total;
}

export function speedAt(track, t) {
  if (t <= 0) return 0;
  const before = progressAt(track, t - STEP_MS);
  const after = progressAt(track, t + STEP_MS);
  return (after - before) / (2 * STEP_MS);
}

export function standings(plan, t) {
  return plan.tracks
    .map((track) => ({ track, progress: progressAt(track, t), done: t >= track.finishMs }))
    .sort((a, b) => {
      if (a.done && b.done) return a.track.place - b.track.place;
      if (a.done !== b.done) return a.done ? -1 : 1;
      return b.progress - a.progress || a.track.lane - b.track.lane;
    });
}
