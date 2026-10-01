import { standings } from "./motion";

const STEP_MS = 200;
const MAX_LEAD_CALLS = 14;

// Commentary is derived only from the saved race plan, so a replay always tells the same story.
export function buildCommentary(plan) {
  const events = [];
  const count = plan.tracks.length;
  if (!count) return events;
  const end = plan.winner.finishMs;
  events.push({ at: 0, kind: "start" });

  let leader = null;
  let candidate = null;
  let held = 0;
  let leadCalls = 0;
  let halfway = false;
  let stretch = false;
  const midRank = new Map();

  for (let t = STEP_MS; t < end; t += STEP_MS) {
    const rows = standings(plan, t);
    const first = rows[0];
    if (!halfway && first.progress >= 0.5) {
      halfway = true;
      events.push({ at: t, kind: "halfway", lane: first.track.lane });
      rows.forEach((row, index) => midRank.set(row.track.lane, index));
    }
    if (!stretch && first.progress >= 0.86) {
      stretch = true;
      events.push({ at: t, kind: "final", lane: first.track.lane });
    }
    if (t < 1500) {
      leader = first.track.lane;
      continue;
    }
    if (first.track.lane !== leader) {
      if (candidate === first.track.lane) held += 1;
      else {
        candidate = first.track.lane;
        held = 1;
      }
      if (held >= 3 && leadCalls < MAX_LEAD_CALLS) {
        leader = candidate;
        leadCalls += 1;
        events.push({ at: t, kind: "lead", lane: leader });
      }
    } else {
      candidate = null;
      held = 0;
    }
  }

  for (const track of plan.tracks) {
    for (const bump of track.surgeAt || []) {
      if (bump.gain < 0.9 || bump.at >= end) continue;
      const rows = standings(plan, bump.at);
      const rank = rows.findIndex((row) => row.track.lane === track.lane);
      if (rank > 0 && rank < Math.min(8, count)) events.push({ at: bump.at, kind: "surge", lane: track.lane });
    }
  }

  const ordered = [...plan.tracks].sort((a, b) => a.place - b.place);
  const second = ordered[1];
  if (second && second.finishMs - plan.winner.finishMs < 160) events.push({ at: plan.winner.finishMs - 400, kind: "photo" });
  events.push({ at: plan.winner.finishMs, kind: "winner", lane: plan.winner.lane });

  if (midRank.size && count >= 6) {
    for (const track of ordered.slice(0, 3)) {
      const rank = midRank.get(track.lane);
      if (rank != null && rank >= Math.ceil(count / 2)) events.push({ at: track.finishMs + 150, kind: "comeback", lane: track.lane });
    }
  }

  return events.sort((a, b) => a.at - b.at);
}
