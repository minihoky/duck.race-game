import { formatClock } from "../lib/format";
import { FROG_FRAMES, FROG_LANDING, FROG_TAKEOFF, NO_PAD, SPRITE_H, SPRITE_W, bakeFrame, bakeScaleFor, frameStore, skinsFor } from "./art";
import { buildPlan, hashString, mulberry32, progressAt, speedAt, standings } from "./motion";

const HABITATS = {
  rabbit: {
    sky: ["#4aa8ee", "#dff3ff"],
    far: "#8cc46a",
    mid: "#3f9a3c",
    surface: ["#8fd653", "#52ad3a"],
    mark: "rgba(24,92,32,0.5)",
    lane: "rgba(255,255,255,0.14)",
    decor: "tree",
    meadow: true,
  },
  frog: {
    sky: ["#7fd6c2", "#f6fbdc"],
    far: "#6b8f3d",
    mid: "#2f7a4c",
    surface: ["#39a58b", "#12534a"],
    mark: "rgba(222,255,238,0.42)",
    lane: "rgba(255,255,255,0.08)",
    decor: "reed",
    marsh: true,
  },
  fish: {
    sky: ["#6db4f2", "#f2f9ff"],
    far: "#7486a1",
    mid: "#1f6f52",
    surface: ["#3cc4de", "#0a5a85"],
    mark: "rgba(255,255,255,0.6)",
    lane: "rgba(255,255,255,0.1)",
    decor: "pine",
    stream: true,
  },
  turtle: {
    sky: ["#2c8ee0", "#ffe8b8"],
    far: "#2b9fd9",
    mid: "#238048",
    surface: ["#f8e6b4", "#e2b96f"],
    mark: "rgba(160,108,48,0.4)",
    lane: "rgba(120,80,30,0.1)",
    decor: "palm",
    beach: true,
  },
  snail: {
    sky: ["#8fd3f4", "#f6fbe8"],
    far: "#7fb35a",
    mid: "#e0443a",
    surface: ["#80cb7a", "#3d9255"],
    mark: "rgba(16,90,46,0.45)",
    lane: "rgba(255,255,255,0.12)",
    decor: "mushroom",
    garden: true,
  },
};

const MEDALS = ["#ffd43b", "#ced4da", "#e8a15a"];
const HOPS_PER_STRIDE = 0.7 / Math.PI;
const SPLASHES = [
  { mark: FROG_LANDING, span: 0.3, kind: "land", foot: 0.66 },
  { mark: FROG_TAKEOFF, span: 0.2, kind: "push", foot: 0.2 },
];

function drawSplash(g, cx, cy, size, age, seed, kind) {
  const rand = mulberry32(seed >>> 0);
  const fade = 1 - age;
  g.save();
  g.lineWidth = Math.max(1, size * 0.06);
  for (const lag of kind === "land" ? [0, 0.3] : [0]) {
    const a = (age - lag) / (1 - lag);
    if (a <= 0) continue;
    const rx = size * (0.3 + a * 1.0);
    g.strokeStyle = `rgba(225,247,255,${(1 - a) * 0.55})`;
    g.beginPath();
    g.ellipse(cx, cy, rx, rx * 0.27, 0, 0, Math.PI * 2);
    g.stroke();
  }
  if (age < 0.5 && kind === "land") {
    const rise = Math.sin((age / 0.5) * Math.PI) * size * 0.6;
    g.fillStyle = `rgba(232,249,255,${0.7 * fade})`;
    g.strokeStyle = `rgba(70,150,195,${0.5 * fade})`;
    g.lineWidth = Math.max(1, size * 0.035);
    const spikes = 5;
    for (let i = 0; i < spikes; i += 1) {
      const side = (i - (spikes - 1) / 2) / ((spikes - 1) / 2);
      const base = cx + side * size * (0.3 + age * 0.55);
      const height = rise * (0.6 + rand() * 0.5) * (1 - Math.abs(side) * 0.3);
      const lean = side * size * 0.38;
      const half = size * 0.1;
      g.beginPath();
      g.moveTo(base - half, cy);
      g.quadraticCurveTo(base + lean * 0.3 - half * 0.4, cy - height * 0.6, base + lean, cy - height);
      g.quadraticCurveTo(base + lean * 0.5 + half * 0.4, cy - height * 0.5, base + half, cy);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }
  const drops = kind === "land" ? 4 : 0;
  g.fillStyle = `rgba(232,249,255,${0.85 * fade})`;
  g.strokeStyle = `rgba(70,150,195,${0.6 * fade})`;
  g.lineWidth = Math.max(0.8, size * 0.035);
  for (let i = 0; i < drops; i += 1) {
    const angle = -Math.PI / 2 + (rand() - 0.5) * 2.0;
    const speed = size * (1.2 + rand() * 1.0);
    const px = cx + Math.cos(angle) * speed * age;
    const py = cy + Math.sin(angle) * speed * age * 1.3 + speed * 1.5 * age * age;
    if (py > cy + size * 0.05 || age < 0.06) continue;
    const r = size * (0.05 + rand() * 0.06) * Math.min(1, age * 5) * (1 - age * 0.4);
    g.beginPath();
    g.ellipse(px, py, r, r * 1.25, angle + Math.PI / 2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.restore();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function fitText(g, text, max) {
  if (g.measureText(text).width <= max) return text;
  let value = text;
  while (value.length > 1 && g.measureText(`${value}…`).width > max) value = value.slice(0, -1);
  return `${value}…`;
}

const DEFAULT_LABELS = {
  finish: "FINISH",
  official: "OFFICIAL RACE",
  lineup: "LINEUP",
  live: "LIVE",
  result: "RESULT",
  finalStretch: "FINAL STRETCH",
  winner: "WINNER",
  go: "GO!",
};

export function createRace(race, sponsorImages = [], labelSet = {}) {
  const labels = { ...DEFAULT_LABELS, ...labelSet };
  const plan = buildPlan(race);
  let lastPositions = [];
  const look = skinsFor(race);
  const animal = HABITATS[race.animal] ? race.animal : "rabbit";
  const habitat = HABITATS[animal];
  const count = plan.tracks.length;

  // Sprite frames are baked lazily (see art.js): creating the engine only picks each skin, so
  // building it for a huge field is instant and never stalls the countdown or the finish.
  const spriteScale = bakeScaleFor(count);
  // With a crowd the tiny sprites share every other animation frame, which halves the memory.
  const frameStride = count > 120 ? 2 : 1;
  const sprites = plan.tracks.map((track) => {
    const skin = look(track.lane);
    return { skin, store: frameStore(animal, skin, spriteScale) };
  });

  // At most a few milliseconds of baking per drawn frame; whatever is missing is baked next frame.
  const BAKE_BUDGET_MS = 7;
  let bakeDeadline = 0;
  let bakedThisFrame = 0;

  function bakeNow(store, index) {
    const image = bakeFrame(store.animal, store.skin, index, store.scale);
    store.frames[index] = image;
    return image;
  }

  function sharedIndex(wanted, total) {
    let index = Math.max(0, Math.min(total - 1, wanted || 0));
    if (frameStride > 1 && index > 0) index = Math.min(total - 1, 1 + Math.floor((index - 1) / frameStride) * frameStride);
    return index;
  }

  // The frame to draw for `wanted`, or null while nothing of this sprite is ready yet.
  function frameOf(sprite, wanted) {
    const { store } = sprite;
    const index = sharedIndex(wanted, store.total);
    const known = store.frames[index];
    if (known) return known;
    if (bakedThisFrame === 0 || performance.now() < bakeDeadline) {
      bakedThisFrame += 1;
      return bakeNow(store, index);
    }
    return store.frames[0] || null;
  }

  // Bakes every frame of one sprite regardless of the budget (used once, to measure the body).
  function fullFrames(sprite) {
    const { store } = sprite;
    for (let index = 0; index < store.total; index += 1) {
      if (!store.frames[index]) bakeNow(store, index);
    }
    return store.frames;
  }

  // Bakes frames in the background: every resting pose first, then the running frames.
  const warmOrder = [0];
  for (let index = 1; index < (sprites[0] ? sprites[0].store.total : 1); index += frameStride) warmOrder.push(index);
  let warmPass = 0;
  let warmLane = 0;

  // Spends up to `ms` milliseconds baking; returns true once every sprite is fully baked.
  function prewarm(ms = 5) {
    const end = performance.now() + ms;
    while (warmPass < warmOrder.length) {
      while (warmLane < sprites.length) {
        const { store } = sprites[warmLane];
        const index = warmOrder[warmPass];
        if (!store.frames[index]) bakeNow(store, index);
        warmLane += 1;
        if (performance.now() >= end) return false;
      }
      warmLane = 0;
      warmPass += 1;
    }
    return true;
  }

  function layout(w, h) {
    const compact = w < 640;
    const skyH = h * (compact ? 0.2 : 0.23);
    const boardH = clamp(h * 0.12, 40, 96);
    const fieldTop = skyH + boardH + 8;
    const fieldBottom = h - (compact ? 30 : 38);
    const fieldH = fieldBottom - fieldTop;
    const spriteH = clamp((fieldH / count) * 1.6, compact ? 34 : 48, Math.min(compact ? 76 : 100, fieldH * 0.26));
    const trackLen = w * clamp(plan.durationMs / 7000, 2.2, 9);
    const startX = Math.max(w * 0.14, (spriteH * SPRITE_W) / SPRITE_H + 10);
    return { compact, skyH, boardH, fieldTop, fieldBottom, fieldH, spriteH, trackLen, startX, finishX: startX + trackLen };
  }

  function laneY(L, lane) {
    return L.fieldTop + L.spriteH * 0.55 + ((lane + 0.5) / count) * (L.fieldH - L.spriteH * 0.75);
  }

  function cameraX(L, w, rows, t, follow) {
    let focus;
    const followed = follow != null ? rows.find((row) => row.track.lane === follow) : null;
    if (followed) focus = followed.progress;
    else {
      const lead = rows.slice(0, Math.min(3, rows.length));
      focus = lead.reduce((sum, row) => sum + row.progress, 0) / lead.length;
      focus = Math.max(focus, rows[0].progress - 0.05);
    }
    const x = L.startX + Math.min(focus, 1.03) * L.trackLen - w * 0.62;
    return clamp(x, 0, L.finishX + w * 0.24 - w);
  }

  function drawCloud(g, x, y, size, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = "#ffffff";
    g.shadowColor = "rgba(60,130,200,0.25)";
    g.shadowBlur = size * 0.25;
    g.shadowOffsetY = size * 0.08;
    g.beginPath();
    g.arc(x, y, size * 0.5, 0, Math.PI * 2);
    g.arc(x + size * 0.55, y - size * 0.22, size * 0.62, 0, Math.PI * 2);
    g.arc(x + size * 1.15, y, size * 0.5, 0, Math.PI * 2);
    g.arc(x + size * 1.6, y + size * 0.08, size * 0.36, 0, Math.PI * 2);
    g.arc(x - size * 0.35, y + size * 0.1, size * 0.34, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function ridge(g, w, base, amp, wave, offset, seed, color) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, base + 6);
    for (let x = 0; x <= w + 12; x += 12) {
      const wx = x + offset;
      const y = base - amp * (0.55 + 0.3 * Math.sin(wx / wave + seed) + 0.15 * Math.sin(wx / (wave * 0.37) + seed * 2.1));
      g.lineTo(x, y);
    }
    g.lineTo(w + 12, base + 6);
    g.closePath();
    g.fill();
  }

  function drawMeadowBackdrop(g, w, L, cam, t) {
    const top = L.skyH;
    const sky = g.createLinearGradient(0, 0, 0, top + 4);
    sky.addColorStop(0, "#3f9fec");
    sky.addColorStop(0.6, "#9bd5fb");
    sky.addColorStop(1, "#e2f4ff");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, top + 6);

    const sun = g.createRadialGradient(w * 0.84, top * 0.3, 0, w * 0.84, top * 0.3, top * 0.75);
    sun.addColorStop(0, "rgba(255,248,214,0.9)");
    sun.addColorStop(0.35, "rgba(255,244,200,0.35)");
    sun.addColorStop(1, "rgba(255,244,200,0)");
    g.fillStyle = sun;
    g.fillRect(0, 0, w, top + 6);

    const tile = 290;
    const drift = cam * 0.06 + (Math.max(0, t) / 1000) * 5;
    const firstCloud = Math.floor(drift / tile) - 1;
    for (let i = firstCloud; i < firstCloud + Math.ceil(w / tile) + 3; i += 1) {
      const rand = mulberry32(hashString(`cloud:${i}`));
      const size = top * (0.13 + rand() * 0.1);
      drawCloud(g, i * tile - drift + rand() * tile * 0.5, top * (0.14 + rand() * 0.34), size, 0.75 + rand() * 0.2);
    }

    ridge(g, w, top + 4, top * 0.62, 190, cam * 0.07, 0.6, "rgba(104,150,214,0.85)");
    ridge(g, w, top + 4, top * 0.46, 140, cam * 0.1 + 80, 2.4, "rgba(122,170,224,0.9)");
    ridge(g, w, top + 4, top * 0.34, 240, cam * 0.18 + 40, 4.1, "#9fdc72");
    ridge(g, w, top + 4, top * 0.24, 170, cam * 0.3 + 120, 1.3, "#6dc151");

    // Grass that sits behind the fence.
    const back = g.createLinearGradient(0, top, 0, top + L.boardH + 10);
    back.addColorStop(0, "#58b447");
    back.addColorStop(1, "#3a8f33");
    g.fillStyle = back;
    g.fillRect(0, top + 3, w, L.boardH + 8);
  }

  function drawMarshBackdrop(g, w, L, cam, t) {
    const top = L.skyH;
    const sky = g.createLinearGradient(0, 0, 0, top + 4);
    sky.addColorStop(0, "#5cc7b4");
    sky.addColorStop(0.55, "#bfeacb");
    sky.addColorStop(1, "#fbf6d2");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, top + 6);

    const sun = g.createRadialGradient(w * 0.2, top * 0.62, 0, w * 0.2, top * 0.62, top * 0.9);
    sun.addColorStop(0, "rgba(255,236,170,0.95)");
    sun.addColorStop(0.3, "rgba(255,225,160,0.4)");
    sun.addColorStop(1, "rgba(255,225,160,0)");
    g.fillStyle = sun;
    g.fillRect(0, 0, w, top + 6);

    const tile = 340;
    const drift = cam * 0.05 + (Math.max(0, t) / 1000) * 4;
    const firstWisp = Math.floor(drift / tile) - 1;
    for (let i = firstWisp; i < firstWisp + Math.ceil(w / tile) + 3; i += 1) {
      const rand = mulberry32(hashString(`wisp:${i}`));
      drawCloud(g, i * tile - drift + rand() * tile * 0.4, top * (0.12 + rand() * 0.28), top * (0.09 + rand() * 0.06), 0.45);
    }

    ridge(g, w, top + 4, top * 0.55, 220, cam * 0.06, 0.9, "rgba(110,180,170,0.75)");
    ridge(g, w, top + 4, top * 0.42, 150, cam * 0.12 + 60, 2.8, "rgba(78,150,128,0.9)");
    ridge(g, w, top + 4, top * 0.3, 110, cam * 0.22 + 30, 4.4, "#3d8a62");

    const mist = g.createLinearGradient(0, top * 0.45, 0, top + 4);
    mist.addColorStop(0, "rgba(255,255,255,0)");
    mist.addColorStop(0.7, "rgba(235,252,240,0.5)");
    mist.addColorStop(1, "rgba(235,252,240,0.15)");
    g.fillStyle = mist;
    g.fillRect(0, top * 0.45, w, top * 0.6);

    // Reed bank behind the fence.
    const back = g.createLinearGradient(0, top, 0, top + L.boardH + 10);
    back.addColorStop(0, "#2f7a52");
    back.addColorStop(1, "#174d3a");
    g.fillStyle = back;
    g.fillRect(0, top + 3, w, L.boardH + 8);
  }

  function drawLilyPad(g, x, y, size, rand) {
    const tilt = (rand() - 0.5) * 0.5;
    const notch = rand() * Math.PI * 2;
    g.save();
    g.translate(x, y);
    g.rotate(tilt);
    g.fillStyle = "rgba(4,50,44,0.3)";
    g.beginPath();
    g.ellipse(2, 3, size, size * 0.34, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = rand() < 0.5 ? "#62c26e" : "#4aaa62";
    g.beginPath();
    g.moveTo(0, 0);
    g.ellipse(0, 0, size, size * 0.32, 0, notch + 0.35, notch + Math.PI * 2 - 0.35);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(210,255,200,0.55)";
    g.lineWidth = 1.1;
    g.beginPath();
    g.ellipse(0, -size * 0.04, size * 0.8, size * 0.22, 0, Math.PI * 1.1, Math.PI * 1.8);
    g.stroke();
    if (rand() < 0.28) {
      const px = size * 0.18;
      for (let p = -2; p <= 2; p += 1) {
        g.fillStyle = p === 0 ? "#ffc3dd" : "#ff93c0";
        g.beginPath();
        g.ellipse(p * px * 0.7, -size * 0.2 - Math.abs(p) * -1, px * 0.55, size * 0.3 - Math.abs(p) * 1.4, p * 0.35, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "#ffe27a";
      g.beginPath();
      g.arc(0, -size * 0.12, size * 0.07, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function peaks(g, w, base, height, cell, offset, key, color, snow) {
    const first = Math.floor(offset / cell) - 1;
    for (let i = first; i < first + Math.ceil(w / cell) + 3; i += 1) {
      const rand = mulberry32(hashString(`${key}:${i}`));
      const x0 = i * cell - offset - cell * 0.3;
      const apexX = x0 + cell * (0.35 + rand() * 0.3);
      const h = height * (0.55 + rand() * 0.45);
      const span = cell * 1.25;
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(x0, base + 4);
      g.lineTo(apexX - span * 0.12, base - h * 0.55);
      g.lineTo(apexX, base - h);
      g.lineTo(apexX + span * 0.14, base - h * 0.6);
      g.lineTo(x0 + span, base + 4);
      g.closePath();
      g.fill();
      if (snow) {
        const cap = h * 0.34;
        g.fillStyle = snow;
        g.beginPath();
        g.moveTo(apexX, base - h);
        g.lineTo(apexX + span * 0.075, base - h + cap * 0.9);
        g.lineTo(apexX + span * 0.03, base - h + cap * 0.7);
        g.lineTo(apexX - span * 0.01, base - h + cap * 1.1);
        g.lineTo(apexX - span * 0.05, base - h + cap * 0.75);
        g.lineTo(apexX - span * 0.085, base - h + cap * 0.95);
        g.closePath();
        g.fill();
      }
    }
  }

  function drawStreamBackdrop(g, w, L, cam, t) {
    const top = L.skyH;
    const sky = g.createLinearGradient(0, 0, 0, top + 4);
    sky.addColorStop(0, "#4b9fee");
    sky.addColorStop(0.6, "#a9d6fa");
    sky.addColorStop(1, "#eef8ff");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, top + 6);

    const tile = 300;
    const drift = cam * 0.05 + (Math.max(0, t) / 1000) * 6;
    const firstCloud = Math.floor(drift / tile) - 1;
    for (let i = firstCloud; i < firstCloud + Math.ceil(w / tile) + 3; i += 1) {
      const rand = mulberry32(hashString(`scloud:${i}`));
      drawCloud(g, i * tile - drift + rand() * tile * 0.4, top * (0.1 + rand() * 0.3), top * (0.1 + rand() * 0.07), 0.8);
    }

    peaks(g, w, top + 4, top * 0.95, 240, cam * 0.06, "alp1", "#8aa6d6", "rgba(255,255,255,0.95)");
    peaks(g, w, top + 4, top * 0.7, 190, cam * 0.1 + 90, "alp2", "#6c8fc4", "rgba(238,246,255,0.9)");
    ridge(g, w, top + 4, top * 0.36, 120, cam * 0.2 + 50, 3.2, "#2f7d62");
    ridge(g, w, top + 4, top * 0.26, 90, cam * 0.32 + 20, 1.7, "#216a52");

    const mist = g.createLinearGradient(0, top * 0.5, 0, top + 4);
    mist.addColorStop(0, "rgba(255,255,255,0)");
    mist.addColorStop(1, "rgba(235,248,255,0.45)");
    g.fillStyle = mist;
    g.fillRect(0, top * 0.5, w, top * 0.55);

    // Forest bank behind the fence.
    const back = g.createLinearGradient(0, top, 0, top + L.boardH + 10);
    back.addColorStop(0, "#2a7358");
    back.addColorStop(1, "#14463a");
    g.fillStyle = back;
    g.fillRect(0, top + 3, w, L.boardH + 8);
  }

  function drawSailboat(g, x, y, size) {
    g.save();
    g.fillStyle = "rgba(255,255,255,0.95)";
    g.beginPath();
    g.moveTo(x, y - size);
    g.lineTo(x + size * 0.55, y - size * 0.1);
    g.lineTo(x, y - size * 0.1);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,226,170,0.95)";
    g.beginPath();
    g.moveTo(x - size * 0.08, y - size * 0.85);
    g.lineTo(x - size * 0.5, y - size * 0.1);
    g.lineTo(x - size * 0.08, y - size * 0.1);
    g.closePath();
    g.fill();
    g.fillStyle = "#e0584a";
    g.beginPath();
    g.moveTo(x - size * 0.6, y - size * 0.04);
    g.lineTo(x + size * 0.65, y - size * 0.04);
    g.lineTo(x + size * 0.45, y + size * 0.14);
    g.lineTo(x - size * 0.4, y + size * 0.14);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawBeachBackdrop(g, w, L, cam, t) {
    const top = L.skyH;
    const horizon = top * 0.66;
    const sky = g.createLinearGradient(0, 0, 0, horizon + 2);
    sky.addColorStop(0, "#2a8be0");
    sky.addColorStop(0.55, "#86d3f1");
    sky.addColorStop(1, "#ffe8b8");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, top + 6);

    const sunX = w * 0.78;
    const sunY = horizon - top * 0.08;
    const glow = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, top * 0.95);
    glow.addColorStop(0, "rgba(255,244,196,0.95)");
    glow.addColorStop(0.25, "rgba(255,232,170,0.45)");
    glow.addColorStop(1, "rgba(255,232,170,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, w, horizon + 2);
    g.fillStyle = "#fff8da";
    g.beginPath();
    g.arc(sunX, sunY, top * 0.085, 0, Math.PI * 2);
    g.fill();

    const tile = 320;
    const drift = cam * 0.05 + (Math.max(0, t) / 1000) * 6;
    const firstCloud = Math.floor(drift / tile) - 1;
    for (let i = firstCloud; i < firstCloud + Math.ceil(w / tile) + 3; i += 1) {
      const rand = mulberry32(hashString(`bcloud:${i}`));
      drawCloud(g, i * tile - drift + rand() * tile * 0.4, top * (0.08 + rand() * 0.24), top * (0.09 + rand() * 0.06), 0.8);
    }

    // Sea.
    const sea = g.createLinearGradient(0, horizon, 0, top + 4);
    sea.addColorStop(0, "#47d2dc");
    sea.addColorStop(1, "#1788b8");
    g.fillStyle = sea;
    g.fillRect(0, horizon, w, top + 6 - horizon);
    ridge(g, w, horizon + 1, top * 0.1, 260, cam * 0.04, 1.1, "rgba(60,140,150,0.75)");

    // Sun glitter on the water.
    for (let k = 0; k < 7; k += 1) {
      const gy = horizon + 3 + k * ((top - horizon) / 8);
      const gw = (28 + k * 20) * (0.7 + 0.3 * Math.sin(Math.max(0, t) / 500 + k));
      g.fillStyle = `rgba(255,244,200,${0.7 - k * 0.07})`;
      g.fillRect(sunX - gw / 2, gy, gw, 2);
    }

    // Slow sailboats and wave dashes.
    const boatTile = 760;
    const boatShift = cam * 0.03 + (Math.max(0, t) / 1000) * 5;
    const firstBoat = Math.floor(boatShift / boatTile) - 1;
    for (let i = firstBoat; i < firstBoat + Math.ceil(w / boatTile) + 2; i += 1) {
      const rand = mulberry32(hashString(`boat:${i}`));
      if (rand() < 0.35) continue;
      drawSailboat(g, i * boatTile - boatShift + rand() * boatTile * 0.6, horizon + (top - horizon) * (0.28 + rand() * 0.2), top * 0.13);
    }
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 1.3;
    const dash = 90;
    const dashShift = cam * 0.08;
    const firstDash = Math.floor(dashShift / dash) - 1;
    for (let i = firstDash; i < firstDash + Math.ceil(w / dash) + 3; i += 1) {
      const rand = mulberry32(hashString(`swell:${i}`));
      const sy = horizon + 5 + rand() * (top - horizon - 8);
      const sx = i * dash - dashShift + rand() * dash;
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + 8, sy - 2, sx + 16 + rand() * 12, sy);
      g.stroke();
    }

    // Dune bank behind the fence.
    const back = g.createLinearGradient(0, top, 0, top + L.boardH + 10);
    back.addColorStop(0, "#f2d79a");
    back.addColorStop(1, "#cfa45d");
    g.fillStyle = back;
    g.fillRect(0, top + 3, w, L.boardH + 8);
  }

  function drawShell(g, x, y, r, rand) {
    g.save();
    g.translate(x, y);
    g.rotate((rand() - 0.5) * 1.2);
    g.fillStyle = "rgba(120,80,30,0.22)";
    g.beginPath();
    g.ellipse(2, 3, r, r * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = rand() < 0.5 ? "#ffd0c0" : "#fff0d4";
    g.beginPath();
    g.moveTo(0, r * 0.4);
    g.arc(0, r * 0.4, r, Math.PI * 1.12, Math.PI * 1.88);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(190,110,90,0.55)";
    g.lineWidth = 0.9;
    for (let k = -2; k <= 2; k += 1) {
      g.beginPath();
      g.moveTo(0, r * 0.4);
      g.lineTo(Math.sin(k * 0.34) * r, r * 0.4 - Math.cos(k * 0.34) * r);
      g.stroke();
    }
    g.restore();
  }

  function drawStarfish(g, x, y, r, rand) {
    g.save();
    g.translate(x, y);
    g.rotate(rand() * Math.PI);
    g.fillStyle = "rgba(120,80,30,0.2)";
    g.beginPath();
    g.ellipse(2, 3, r, r * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = rand() < 0.5 ? "#ff8e5c" : "#ff6f7d";
    g.beginPath();
    for (let k = 0; k < 10; k += 1) {
      const radius = k % 2 === 0 ? r : r * 0.42;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      g.lineTo(Math.cos(a) * radius, Math.sin(a) * radius * 0.8);
    }
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,240,210,0.7)";
    for (let k = 0; k < 5; k += 1) {
      const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
      g.beginPath();
      g.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.36, r * 0.07, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  const BLOOMS = ["#ff6b8b", "#ffb347", "#b388ff", "#ff5252", "#ffd84a", "#ff8fd0"];

  function drawDaisy(g, x, y, r, petal) {
    g.fillStyle = petal;
    for (let k = 0; k < 8; k += 1) {
      const a = (k * Math.PI) / 4;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.42, r * 0.2, a, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#ffcf2e";
    g.beginPath();
    g.arc(x, y, r * 0.32, 0, Math.PI * 2);
    g.fill();
  }

  function drawTulip(g, x, y, r, color) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x - r * 0.7, y - r * 0.2);
    g.quadraticCurveTo(x - r * 0.8, y + r * 0.9, x, y + r * 0.95);
    g.quadraticCurveTo(x + r * 0.8, y + r * 0.9, x + r * 0.7, y - r * 0.2);
    g.lineTo(x + r * 0.35, y - r * 0.6);
    g.lineTo(x, y - r * 0.2);
    g.lineTo(x - r * 0.35, y - r * 0.6);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.28)";
    g.beginPath();
    g.ellipse(x - r * 0.25, y + r * 0.3, r * 0.14, r * 0.38, 0.2, 0, Math.PI * 2);
    g.fill();
  }

  function drawBloom(g, x, base, size, rand) {
    g.fillStyle = "rgba(10,70,30,0.22)";
    g.beginPath();
    g.ellipse(x, base, size * 0.34, size * 0.05, 0, 0, Math.PI * 2);
    g.fill();
    g.lineCap = "round";
    const stems = 3 + Math.floor(rand() * 2);
    for (let j = 0; j < stems; j += 1) {
      const sx = x + (j - (stems - 1) / 2) * size * 0.18;
      const top = base - size * (0.35 + rand() * 0.3);
      const lean = (rand() - 0.5) * size * 0.1;
      g.strokeStyle = "#2f8f3f";
      g.lineWidth = Math.max(1.6, size * 0.03);
      g.beginPath();
      g.moveTo(sx, base);
      g.quadraticCurveTo(sx + lean * 0.3, (base + top) / 2, sx + lean, top);
      g.stroke();
      g.fillStyle = "#3da84e";
      g.beginPath();
      g.ellipse(sx + (j % 2 ? 5 : -5), base - size * 0.1, size * 0.1, size * 0.035, j % 2 ? -0.6 : 0.6, 0, Math.PI * 2);
      g.fill();
      const color = BLOOMS[Math.floor(rand() * BLOOMS.length)];
      if (rand() < 0.5) drawDaisy(g, sx + lean, top, size * 0.11, rand() < 0.5 ? "#ffffff" : color);
      else drawTulip(g, sx + lean, top, size * 0.1, color);
    }
    g.lineCap = "butt";
  }

  function hedge(g, w, base, h, cell, offset, key, color, light, blooms) {
    g.fillStyle = color;
    g.fillRect(0, base - h * 0.4, w, h * 0.4 + 8);
    const first = Math.floor(offset / cell) - 1;
    for (let i = first; i < first + Math.ceil(w / cell) + 3; i += 1) {
      const rand = mulberry32(hashString(`${key}:${i}`));
      const cx = i * cell - offset + cell / 2;
      const r = h * (0.46 + rand() * 0.12);
      const cy = base - h + r;
      g.fillStyle = color;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = light;
      g.beginPath();
      g.arc(cx - r * 0.25, cy - r * 0.3, r * 0.55, 0, Math.PI * 2);
      g.fill();
      if (blooms) {
        for (let k = 0; k < 3; k += 1) {
          g.fillStyle = BLOOMS[Math.floor(rand() * BLOOMS.length)];
          g.beginPath();
          g.arc(cx + (rand() - 0.5) * r * 1.3, cy + (rand() - 0.2) * r * 0.9, 2.2, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }

  function drawGardenBackdrop(g, w, L, cam, t) {
    const top = L.skyH;
    const sky = g.createLinearGradient(0, 0, 0, top + 4);
    sky.addColorStop(0, "#68c0f0");
    sky.addColorStop(0.6, "#b9e4f7");
    sky.addColorStop(1, "#f6fbe8");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, top + 6);

    const sun = g.createRadialGradient(w * 0.16, top * 0.3, 0, w * 0.16, top * 0.3, top * 0.7);
    sun.addColorStop(0, "rgba(255,250,214,0.95)");
    sun.addColorStop(1, "rgba(255,250,214,0)");
    g.fillStyle = sun;
    g.fillRect(0, 0, w, top + 6);

    const tile = 300;
    const drift = cam * 0.05 + (Math.max(0, t) / 1000) * 5;
    const firstCloud = Math.floor(drift / tile) - 1;
    for (let i = firstCloud; i < firstCloud + Math.ceil(w / tile) + 3; i += 1) {
      const rand = mulberry32(hashString(`gcloud:${i}`));
      drawCloud(g, i * tile - drift + rand() * tile * 0.4, top * (0.1 + rand() * 0.3), top * (0.1 + rand() * 0.06), 0.85);
    }

    ridge(g, w, top + 4, top * 0.4, 230, cam * 0.07, 0.5, "rgba(128,196,150,0.8)");
    hedge(g, w, top + 4, top * 0.62, top * 0.5, cam * 0.14, "hedgeFar", "#6bb65c", "#86cb70", false);
    hedge(g, w, top + 4, top * 0.46, top * 0.4, cam * 0.26 + 40, "hedgeNear", "#3f9a45", "#58b45a", true);

    const back = g.createLinearGradient(0, top, 0, top + L.boardH + 10);
    back.addColorStop(0, "#368c40");
    back.addColorStop(1, "#236b35");
    g.fillStyle = back;
    g.fillRect(0, top + 3, w, L.boardH + 8);
  }

  function drawButterfly(g, x, y, s, flap, color) {
    g.save();
    g.translate(x, y);
    g.fillStyle = color;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.ellipse(side * s * 0.55 * flap, -s * 0.2, s * 0.55 * flap, s * 0.5, side * 0.4, 0, Math.PI * 2);
      g.ellipse(side * s * 0.4 * flap, s * 0.35, s * 0.34 * flap, s * 0.3, side * -0.3, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#3a2a3a";
    g.fillRect(-s * 0.06, -s * 0.5, s * 0.12, s * 1.0);
    g.restore();
  }

  function drawLadybug(g, x, y, r) {
    g.fillStyle = "rgba(0,50,20,0.25)";
    g.beginPath();
    g.ellipse(x + 1, y + 2, r, r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e5322d";
    g.beginPath();
    g.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1c1c1c";
    g.beginPath();
    g.arc(x + r * 0.85, y, r * 0.42, 0, Math.PI * 2);
    g.fill();
    g.fillRect(x - r * 0.05, y - r * 0.8, r * 0.1, r * 1.6);
    for (const [ox, oy] of [[-0.45, -0.3], [-0.4, 0.35], [0.25, -0.3], [0.25, 0.3]]) {
      g.beginPath();
      g.arc(x + ox * r, y + oy * r, r * 0.16, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawClover(g, x, y, r) {
    g.fillStyle = "rgba(10,70,36,0.2)";
    g.beginPath();
    g.ellipse(x + 1, y + 2, r * 1.5, r * 0.8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2f8f4a";
    for (const [ox, oy] of [[-0.6, -0.1], [0.6, -0.1], [0, -0.7], [0, 0.55]]) {
      g.beginPath();
      g.arc(x + ox * r, y + oy * r * 0.8, r * 0.58, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "rgba(190,255,200,0.4)";
    g.beginPath();
    g.arc(x - r * 0.3, y - r * 0.3, r * 0.2, 0, Math.PI * 2);
    g.fill();
  }

  function drawSky(g, w, L, cam, t) {
    if (habitat.meadow || habitat.marsh || habitat.stream || habitat.beach || habitat.garden) {
      if (habitat.marsh) drawMarshBackdrop(g, w, L, cam, t);
      else if (habitat.stream) drawStreamBackdrop(g, w, L, cam, t);
      else if (habitat.beach) drawBeachBackdrop(g, w, L, cam, t);
      else if (habitat.garden) drawGardenBackdrop(g, w, L, cam, t);
      else drawMeadowBackdrop(g, w, L, cam, t);
      const tile = habitat.marsh ? 110 : habitat.stream ? 90 : habitat.beach ? 150 : habitat.garden ? 120 : 130;
      const offset = cam * 0.45;
      const first = Math.floor(offset / tile) - 1;
      for (let i = first; i < first + Math.ceil(w / tile) + 3; i += 1) {
        const rand = mulberry32(hashString(`decor:${i}`));
        const x = i * tile - offset + rand() * tile * 0.6;
        drawDecor(g, habitat.decor, x, L.skyH + 3, L.skyH * (0.3 + rand() * 0.24), rand);
      }
      return;
    }
    const sky = g.createLinearGradient(0, 0, 0, L.skyH);
    sky.addColorStop(0, habitat.sky[0]);
    sky.addColorStop(1, habitat.sky[1]);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, L.skyH + L.boardH + 10);

    g.fillStyle = habitat.far;
    g.beginPath();
    g.moveTo(0, L.skyH + 4);
    for (let x = 0; x <= w + 20; x += 20) {
      const wx = x + cam * 0.15;
      const y = L.skyH * 0.68 - Math.sin(wx / 210) * L.skyH * 0.12 - Math.sin(wx / 87 + 1.3) * L.skyH * 0.05;
      g.lineTo(x, y);
    }
    g.lineTo(w, L.skyH + 4);
    g.closePath();
    g.fill();

    const tile = 140;
    const offset = cam * 0.45;
    const first = Math.floor(offset / tile) - 1;
    for (let i = first; i < first + Math.ceil(w / tile) + 3; i += 1) {
      const rand = mulberry32(hashString(`decor:${i}`));
      const x = i * tile - offset + rand() * tile * 0.6;
      const size = L.skyH * (0.28 + rand() * 0.22);
      const base = L.skyH + 2;
      drawDecor(g, habitat.decor, x, base, size, rand);
    }
  }

  function drawDecor(g, kind, x, base, size, rand) {
    g.save();
    if (kind === "tree") {
      const tones = [["#2f8a3b", "#4fb54d"], ["#3a9a40", "#63c455"], ["#277a46", "#47aa62"]];
      const [deep, light] = tones[Math.floor(rand() * tones.length)];
      g.fillStyle = "rgba(10,60,20,0.22)";
      g.beginPath();
      g.ellipse(x + size * 0.06, base, size * 0.34, size * 0.06, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#7a5230";
      roundRect(g, x - size * 0.05, base - size * 0.5, size * 0.1, size * 0.5, size * 0.03);
      g.fill();
      g.fillStyle = deep;
      g.beginPath();
      g.arc(x, base - size * 0.7, size * 0.34, 0, Math.PI * 2);
      g.arc(x - size * 0.22, base - size * 0.52, size * 0.24, 0, Math.PI * 2);
      g.arc(x + size * 0.24, base - size * 0.54, size * 0.26, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = light;
      g.beginPath();
      g.arc(x - size * 0.06, base - size * 0.76, size * 0.24, 0, Math.PI * 2);
      g.arc(x - size * 0.24, base - size * 0.58, size * 0.14, 0, Math.PI * 2);
      g.arc(x + size * 0.1, base - size * 0.6, size * 0.12, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.18)";
      g.beginPath();
      g.arc(x - size * 0.12, base - size * 0.84, size * 0.1, 0, Math.PI * 2);
      g.fill();
    } else if (kind === "reed") {
      g.fillStyle = "rgba(6,46,36,0.25)";
      g.beginPath();
      g.ellipse(x, base, size * 0.34, size * 0.05, 0, 0, Math.PI * 2);
      g.fill();
      g.lineCap = "round";
      // Flat leaf blades first, then the cattail stems in front of them.
      for (let j = 0; j < 4; j += 1) {
        const lx = x + (j - 1.5) * size * 0.1;
        const tip = base - size * (0.5 + rand() * 0.35);
        g.strokeStyle = j % 2 ? "#2f8f5c" : "#3da56a";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(lx, base);
        g.quadraticCurveTo(lx + (j - 1.5) * size * 0.1, (base + tip) / 2, lx + (j - 1.5) * size * 0.2, tip);
        g.stroke();
      }
      for (let j = 0; j < 3; j += 1) {
        const rx = x + (j - 1) * size * 0.11;
        const top = base - size * (0.78 + rand() * 0.3);
        const lean = (rand() - 0.5) * size * 0.1;
        g.strokeStyle = "#1f7048";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(rx, base);
        g.quadraticCurveTo(rx + lean * 0.4, (base + top) / 2, rx + lean, top);
        g.stroke();
        g.fillStyle = "#7a4a2a";
        roundRect(g, rx + lean - 3, top - size * 0.02, 6, size * 0.2, 3);
        g.fill();
        g.fillStyle = "rgba(255,210,160,0.35)";
        roundRect(g, rx + lean - 2, top, 1.8, size * 0.15, 1);
        g.fill();
        g.strokeStyle = "#a98858";
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(rx + lean, top - size * 0.02);
        g.lineTo(rx + lean, top - size * 0.1);
        g.stroke();
      }
    } else if (kind === "pine") {
      const deep = rand() < 0.5 ? "#1b5f48" : "#17543f";
      const light = rand() < 0.5 ? "#2f9266" : "#2a8760";
      g.fillStyle = "rgba(4,40,34,0.25)";
      g.beginPath();
      g.ellipse(x + size * 0.04, base, size * 0.3, size * 0.05, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#6b4a30";
      g.fillRect(x - size * 0.035, base - size * 0.16, size * 0.07, size * 0.16);
      const tiers = 4;
      for (let j = 0; j < tiers; j += 1) {
        const w2 = size * (0.36 - j * 0.07);
        const y = base - size * (0.12 + j * 0.22);
        const apex = y - size * 0.34;
        g.fillStyle = deep;
        g.beginPath();
        g.moveTo(x - w2, y);
        g.lineTo(x, apex);
        g.lineTo(x + w2, y);
        g.closePath();
        g.fill();
        g.fillStyle = light;
        g.beginPath();
        g.moveTo(x - w2, y);
        g.lineTo(x, apex);
        g.lineTo(x - w2 * 0.05, y - size * 0.02);
        g.closePath();
        g.fill();
      }
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.beginPath();
      g.moveTo(x, base - size * (0.12 + (tiers - 1) * 0.22) - size * 0.34);
      g.lineTo(x + size * 0.05, base - size * (0.12 + (tiers - 1) * 0.22) - size * 0.2);
      g.lineTo(x - size * 0.05, base - size * (0.12 + (tiers - 1) * 0.22) - size * 0.2);
      g.closePath();
      g.fill();
    } else if (kind === "palm") {
      const dir = rand() < 0.5 ? -1 : 1;
      const cx = x - dir * size * 0.05;
      const cy = base - size * 0.5;
      const topX = x + dir * size * 0.16;
      const topY = base - size * 0.95;
      g.fillStyle = "rgba(120,80,30,0.25)";
      g.beginPath();
      g.ellipse(x + dir * size * 0.08, base, size * 0.3, size * 0.045, 0, 0, Math.PI * 2);
      g.fill();
      g.lineCap = "round";
      g.strokeStyle = "#8c5c36";
      g.lineWidth = Math.max(3, size * 0.075);
      g.beginPath();
      g.moveTo(x, base);
      g.quadraticCurveTo(cx, cy, topX, topY);
      g.stroke();
      g.strokeStyle = "rgba(70,36,14,0.4)";
      g.lineWidth = 1.3;
      for (let k = 1; k <= 7; k += 1) {
        const u = k / 8;
        const bx = (1 - u) * (1 - u) * x + 2 * (1 - u) * u * cx + u * u * topX;
        const by = (1 - u) * (1 - u) * base + 2 * (1 - u) * u * cy + u * u * topY;
        const half = Math.max(1.6, size * 0.036);
        g.beginPath();
        g.moveTo(bx - half, by + 1);
        g.lineTo(bx + half, by - 1);
        g.stroke();
      }
      const fronds = 8;
      for (let j = 0; j < fronds; j += 1) {
        const a = Math.PI * (1.06 + (j / (fronds - 1)) * 0.88);
        const len = size * (0.4 + (j % 2) * 0.06);
        const ex = topX + Math.cos(a) * len;
        const ey = topY + Math.sin(a) * len * 0.45 + len * 0.28;
        const mx = topX + Math.cos(a) * len * 0.55;
        const my = topY + Math.sin(a) * len * 0.75 - len * 0.1;
        const spread = len * 0.12;
        g.fillStyle = j % 2 ? "#2f9a5a" : "#238048";
        g.beginPath();
        g.moveTo(topX, topY);
        g.quadraticCurveTo(mx, my - spread, ex, ey);
        g.quadraticCurveTo(mx, my + spread, topX, topY);
        g.fill();
      }
      g.fillStyle = "#5a3418";
      for (const [ox, oy] of [[-0.03, 0.03], [0.03, 0.035], [0, 0.07]]) {
        g.beginPath();
        g.arc(topX + ox * size, topY + oy * size, size * 0.032, 0, Math.PI * 2);
        g.fill();
      }
      g.lineCap = "butt";
    } else if (kind === "mushroom") {
      if (habitat.garden && rand() < 0.55) {
        drawBloom(g, x, base, size, rand);
        g.restore();
        return;
      }
      g.fillStyle = "#3f7a2e";
      g.beginPath();
      g.ellipse(x + size * 0.1, base, size * 0.5, size * 0.16, 0, Math.PI, 0);
      g.fill();
      const caps = rand() < 0.5 ? [[0, 0.75], [size * 0.3, 0.5]] : [[0, 0.6]];
      for (const [dx, scale] of caps) {
        const s = size * scale;
        const mx = x + dx;
        g.fillStyle = "#f6ecd8";
        roundRect(g, mx - s * 0.1, base - s * 0.62, s * 0.2, s * 0.62, s * 0.08);
        g.fill();
        g.fillStyle = habitat.mid;
        g.beginPath();
        g.ellipse(mx, base - s * 0.6, s * 0.38, s * 0.3, 0, Math.PI, 0);
        g.closePath();
        g.fill();
        g.fillStyle = "#fff";
        for (const [sx, sy, r] of [[-0.18, -0.7, 0.06], [0.08, -0.8, 0.07], [0.22, -0.66, 0.05]]) {
          g.beginPath();
          g.arc(mx + s * sx, base + s * sy, s * r, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.restore();
  }

  function drawBoards(g, w, L, cam, t) {
    const y = L.skyH + 2;
    const spacing = clamp(w * 0.3, 220, 360);
    const boardW = spacing - 10;
    const H = L.boardH;
    const skew = H * 0.38;
    const first = Math.floor(cam / spacing) - 1;
    const cycle = Math.floor(Math.max(0, t) / 4000);

    g.save();

    // Slim wooden posts behind the panels, drifting slower than the track for depth.
    const postGap = 30;
    const postShift = cam * 0.9;
    g.fillStyle = "rgba(92,66,40,0.55)";
    const firstPost = Math.floor(postShift / postGap) - 1;
    for (let p = firstPost; p < firstPost + Math.ceil(w / postGap) + 3; p += 1) {
      g.fillRect(p * postGap - postShift, y - 7, 3, H + 14);
    }
    g.fillStyle = "rgba(6,18,40,0.35)";
    g.fillRect(0, y + H + 3, w, 4);

    for (let i = first; i < first + Math.ceil(w / spacing) + 3; i += 1) {
      const x = i * spacing - cam + 8;
      if (x > w + skew || x + boardW < -skew) continue;
      const right = x + boardW;

      // Light slanted bar between two panels.
      g.beginPath();
      g.moveTo(right + 1 + skew, y);
      g.lineTo(right + 6 + skew, y);
      g.lineTo(right + 6, y + H);
      g.lineTo(right + 1, y + H);
      g.closePath();
      g.fillStyle = "#8fdcff";
      g.shadowColor = "rgba(110,200,255,0.9)";
      g.shadowBlur = 8;
      g.fill();
      g.shadowBlur = 0;

      // Panel body.
      g.beginPath();
      g.moveTo(x + skew, y);
      g.lineTo(right + skew, y);
      g.lineTo(right, y + H);
      g.lineTo(x, y + H);
      g.closePath();
      const body = g.createLinearGradient(0, y, 0, y + H);
      body.addColorStop(0, "#102a63");
      body.addColorStop(1, "#071a3f");
      g.fillStyle = body;
      g.fill();
      const rim = g.createLinearGradient(x, 0, right + skew, 0);
      rim.addColorStop(0, "#63d2ff");
      rim.addColorStop(0.5, "#2e78ff");
      rim.addColorStop(1, "#63d2ff");
      g.strokeStyle = rim;
      g.lineWidth = 2;
      g.shadowColor = "rgba(70,150,255,0.95)";
      g.shadowBlur = 10;
      g.stroke();
      g.shadowBlur = 0;

      const sponsor = sponsorImages.length ? sponsorImages[(((i + cycle) % sponsorImages.length) + sponsorImages.length) % sponsorImages.length] : null;
      const midX = x + (boardW + skew) / 2;
      const midY = y + H / 2;
      if (sponsor && sponsor.complete && sponsor.naturalWidth) {
        g.save();
        g.beginPath();
        g.moveTo(x + skew + 3, y + 3);
        g.lineTo(right + skew - 3, y + 3);
        g.lineTo(right - 3, y + H - 3);
        g.lineTo(x + 3, y + H - 3);
        g.closePath();
        g.clip();
        const boxW = boardW + skew - 6;
        const boxH = H - 6;
        const scale = Math.max(boxW / sponsor.naturalWidth, boxH / sponsor.naturalHeight);
        const iw = sponsor.naturalWidth * scale;
        const ih = sponsor.naturalHeight * scale;
        g.imageSmoothingQuality = "high";
        g.drawImage(sponsor, midX - iw / 2, midY - ih / 2, iw, ih);
        g.restore();
        continue;
      }

      const title = String(race.name || "").trim();
      const text = title && i % 2 === 0 ? title.toUpperCase() : labels.official;
      const crown = H * 0.46;
      g.font = `800 ${Math.round(H * 0.38)}px "Trebuchet MS", "Segoe UI", sans-serif`;
      if ("letterSpacing" in g) g.letterSpacing = `${Math.max(1, Math.round(H * 0.04))}px`;
      const room = boardW - skew - 20 - crown - 8;
      const label = fitText(g, text, Math.max(40, room));
      const textW = g.measureText(label).width;
      const startX = midX - (crown + 8 + textW) / 2;

      // Crown icon.
      const cx = startX;
      const cy = midY - crown * 0.5;
      g.beginPath();
      g.moveTo(cx, cy + crown * 0.85);
      g.lineTo(cx, cy + crown * 0.28);
      g.lineTo(cx + crown * 0.26, cy + crown * 0.55);
      g.lineTo(cx + crown * 0.5, cy);
      g.lineTo(cx + crown * 0.74, cy + crown * 0.55);
      g.lineTo(cx + crown, cy + crown * 0.28);
      g.lineTo(cx + crown, cy + crown * 0.85);
      g.closePath();
      const gold = g.createLinearGradient(0, cy, 0, cy + crown);
      gold.addColorStop(0, "#d9f1ff");
      gold.addColorStop(1, "#5aa8f5");
      g.fillStyle = gold;
      g.shadowColor = "rgba(120,200,255,0.8)";
      g.shadowBlur = 6;
      g.fill();
      g.shadowBlur = 0;

      g.fillStyle = "#ffffff";
      g.textAlign = "left";
      g.textBaseline = "middle";
      g.fillText(label, startX + crown + 8, midY + 1);
      if ("letterSpacing" in g) g.letterSpacing = "0px";
    }

    g.restore();
  }

  function drawField(g, w, h, L, cam, t) {
    const surface = g.createLinearGradient(0, L.fieldTop - 8, 0, h);
    surface.addColorStop(0, habitat.surface[0]);
    surface.addColorStop(1, habitat.surface[1]);
    g.fillStyle = surface;
    g.fillRect(0, L.skyH + L.boardH + 4, w, h);

    if (habitat.meadow) {
      // Mowed stripes: lighter and darker bands that follow the lanes.
      const bands = count <= 12 ? count : Math.max(6, Math.round(L.fieldH / 44));
      const bandH = L.fieldH / bands;
      for (let b = 0; b < bands; b += 1) {
        g.fillStyle = b % 2 === 0 ? "rgba(255,255,255,0.1)" : "rgba(8,70,16,0.08)";
        g.fillRect(0, L.fieldTop + b * bandH, w, bandH + 0.5);
      }
      const edge = g.createLinearGradient(0, L.skyH + L.boardH + 4, 0, L.fieldTop + 30);
      edge.addColorStop(0, "rgba(10,70,20,0.28)");
      edge.addColorStop(1, "rgba(10,70,20,0)");
      g.fillStyle = edge;
      g.fillRect(0, L.skyH + L.boardH + 4, w, L.fieldTop + 30 - (L.skyH + L.boardH + 4));
    }

    if (habitat.garden) {
      const bank = L.skyH + L.boardH + 4;
      const bands = count <= 12 ? count : Math.max(6, Math.round(L.fieldH / 44));
      const bandH = L.fieldH / bands;
      for (let b = 0; b < bands; b += 1) {
        g.fillStyle = b % 2 === 0 ? "rgba(255,255,255,0.08)" : "rgba(8,76,40,0.09)";
        g.fillRect(0, L.fieldTop + b * bandH, w, bandH + 0.5);
      }
      const shade = g.createLinearGradient(0, bank, 0, L.fieldTop + 30);
      shade.addColorStop(0, "rgba(8,70,34,0.32)");
      shade.addColorStop(1, "rgba(8,70,34,0)");
      g.fillStyle = shade;
      g.fillRect(0, bank, w, L.fieldTop + 30 - bank);
      // Clover, daisies, dandelions, and ladybugs in the lawn.
      const lawnCell = 240;
      const lawnCol = Math.floor(cam / lawnCell) - 1;
      const lawnRows = Math.max(2, Math.round(L.fieldH / 85));
      for (let c = lawnCol; c < lawnCol + Math.ceil(w / lawnCell) + 2; c += 1) {
        for (let r = 0; r < lawnRows; r += 1) {
          const rand = mulberry32(hashString(`lawn:${c}:${r}`));
          const pick = rand();
          if (pick < 0.3) continue;
          const lx = c * lawnCell - cam + rand() * lawnCell;
          const ly = L.fieldTop + (r + 0.15 + rand() * 0.7) * (L.fieldH / lawnRows);
          if (pick < 0.55) drawClover(g, lx, ly, 6 + rand() * 4);
          else if (pick < 0.8) drawDaisy(g, lx, ly, 6 + rand() * 3, "#ffffff");
          else if (pick < 0.92) {
            g.fillStyle = "#ffd23a";
            g.beginPath();
            g.arc(lx, ly, 4 + rand() * 2, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = "rgba(255,255,255,0.45)";
            g.beginPath();
            g.arc(lx - 1, ly - 1, 1.6, 0, Math.PI * 2);
            g.fill();
          } else drawLadybug(g, lx, ly, 4.5);
        }
      }
      // Petals drifting on the breeze, and a few butterflies.
      const wind = (Math.max(0, t) / 1000) * 30;
      const petalCell = 280;
      const petalCol = Math.floor((cam + wind) / petalCell) - 1;
      for (let c = petalCol; c < petalCol + Math.ceil(w / petalCell) + 2; c += 1) {
        for (let k = 0; k < 2; k += 1) {
          const rand = mulberry32(hashString(`petal:${c}:${k}`));
          const px = c * petalCell + rand() * petalCell - cam - wind;
          const fall = (rand() * L.fieldH + (Math.max(0, t) / 1000) * (14 + rand() * 12)) % L.fieldH;
          const py = L.fieldTop + fall;
          g.fillStyle = k ? "rgba(255,190,214,0.85)" : "rgba(255,255,255,0.8)";
          g.beginPath();
          g.ellipse(px, py, 4.5, 2.4, Math.sin(Math.max(0, t) / 400 + c + k) * 1.2, 0, Math.PI * 2);
          g.fill();
        }
      }
      const flutterCell = 520;
      const flutterCol = Math.floor(cam / flutterCell) - 1;
      for (let c = flutterCol; c < flutterCol + Math.ceil(w / flutterCell) + 2; c += 1) {
        const rand = mulberry32(hashString(`flutter:${c}`));
        if (rand() < 0.4) continue;
        const phase = rand() * 6.28;
        const bx = c * flutterCell - cam + rand() * flutterCell + Math.sin(Math.max(0, t) / 800 + phase) * 30;
        const by = L.fieldTop + rand() * L.fieldH * 0.85 + Math.cos(Math.max(0, t) / 520 + phase) * 14;
        const flap = 0.35 + 0.65 * Math.abs(Math.sin(Math.max(0, t) / 110 + phase));
        drawButterfly(g, bx, by, 9 + rand() * 4, flap, BLOOMS[Math.floor(rand() * BLOOMS.length)]);
      }
    }

    if (habitat.beach) {
      const bank = L.skyH + L.boardH + 4;
      const bands = count <= 12 ? count : Math.max(6, Math.round(L.fieldH / 44));
      const bandH = L.fieldH / bands;
      for (let b = 0; b < bands; b += 1) {
        g.fillStyle = b % 2 === 0 ? "rgba(255,255,255,0.1)" : "rgba(150,100,40,0.07)";
        g.fillRect(0, L.fieldTop + b * bandH, w, bandH + 0.5);
      }
      const damp = g.createLinearGradient(0, bank, 0, L.fieldTop + 34);
      damp.addColorStop(0, "rgba(130,86,36,0.3)");
      damp.addColorStop(1, "rgba(130,86,36,0)");
      g.fillStyle = damp;
      g.fillRect(0, bank, w, L.fieldTop + 34 - bank);
      // Wind-carved sand ripples.
      g.strokeStyle = "rgba(170,118,56,0.26)";
      g.lineWidth = 1.4;
      g.lineCap = "round";
      const rippleCell = 250;
      const rippleCol = Math.floor(cam / rippleCell) - 1;
      const rippleRows = Math.max(3, Math.round(L.fieldH / 52));
      for (let c = rippleCol; c < rippleCol + Math.ceil(w / rippleCell) + 2; c += 1) {
        for (let r = 0; r < rippleRows; r += 1) {
          const rand = mulberry32(hashString(`ripple:${c}:${r}`));
          if (rand() < 0.3) continue;
          const rx = c * rippleCell - cam + rand() * rippleCell;
          const ry = L.fieldTop + (r + rand()) * (L.fieldH / rippleRows);
          const len = 60 + rand() * 90;
          g.beginPath();
          g.moveTo(rx, ry);
          for (let s = 1; s <= 6; s += 1) g.lineTo(rx + (len * s) / 6, ry + Math.sin(s * 1.3 + rand()) * 2.2);
          g.stroke();
        }
      }
      g.lineCap = "butt";
      // Shells and starfish on the sand.
      const treasureCell = 330;
      const treasureCol = Math.floor(cam / treasureCell) - 1;
      const treasureRows = Math.max(2, Math.round(L.fieldH / 110));
      for (let c = treasureCol; c < treasureCol + Math.ceil(w / treasureCell) + 2; c += 1) {
        for (let r = 0; r < treasureRows; r += 1) {
          const rand = mulberry32(hashString(`treasure:${c}:${r}`));
          const pick = rand();
          if (pick < 0.4) continue;
          const tx = c * treasureCell - cam + rand() * treasureCell;
          const ty = L.fieldTop + (r + 0.2 + rand() * 0.6) * (L.fieldH / treasureRows);
          if (pick < 0.7) drawShell(g, tx, ty, 7 + rand() * 5, rand);
          else if (pick < 0.9) drawStarfish(g, tx, ty, 8 + rand() * 6, rand);
          else {
            g.fillStyle = "rgba(120,86,60,0.35)";
            g.beginPath();
            g.ellipse(tx, ty, 5 + rand() * 4, 3 + rand() * 2, 0, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }

    if (habitat.stream) {
      const bank = L.skyH + L.boardH + 4;
      const reflect = g.createLinearGradient(0, bank, 0, L.fieldTop + L.fieldH * 0.4);
      reflect.addColorStop(0, "rgba(235,248,255,0.4)");
      reflect.addColorStop(1, "rgba(235,248,255,0)");
      g.fillStyle = reflect;
      g.fillRect(0, bank, w, L.fieldTop + L.fieldH * 0.4 - bank);
      const bands = count <= 12 ? count : Math.max(6, Math.round(L.fieldH / 44));
      const bandH = L.fieldH / bands;
      for (let b = 0; b < bands; b += 1) {
        g.fillStyle = b % 2 === 0 ? "rgba(255,255,255,0.06)" : "rgba(0,40,70,0.09)";
        g.fillRect(0, L.fieldTop + b * bandH, w, bandH + 0.5);
      }
      // Smooth riverbed stones seen through the water.
      const stoneCell = 210;
      const stoneCol = Math.floor(cam / stoneCell) - 1;
      const stoneRows = Math.max(2, Math.round(L.fieldH / 80));
      for (let c = stoneCol; c < stoneCol + Math.ceil(w / stoneCell) + 2; c += 1) {
        for (let r = 0; r < stoneRows; r += 1) {
          const rand = mulberry32(hashString(`stone:${c}:${r}`));
          if (rand() < 0.35) continue;
          const sx = c * stoneCell - cam + rand() * stoneCell;
          const sy = L.fieldTop + (r + 0.15 + rand() * 0.7) * (L.fieldH / stoneRows);
          const sw = 9 + rand() * 16;
          g.fillStyle = "rgba(4,44,74,0.22)";
          g.beginPath();
          g.ellipse(sx, sy, sw, sw * 0.5, 0, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "rgba(210,240,255,0.16)";
          g.beginPath();
          g.ellipse(sx - sw * 0.2, sy - sw * 0.14, sw * 0.55, sw * 0.24, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Long current streaks sliding against the swimmers.
      const flow = (Math.max(0, t) / 1000) * 70;
      const streakCell = 150;
      const streakCol = Math.floor((cam + flow) / streakCell) - 1;
      const streakRows = Math.max(4, Math.round(L.fieldH / 36));
      g.lineCap = "round";
      g.lineWidth = 2;
      for (let c = streakCol; c < streakCol + Math.ceil(w / streakCell) + 2; c += 1) {
        for (let r = 0; r < streakRows; r += 1) {
          const rand = mulberry32(hashString(`streak:${c}:${r}`));
          if (rand() < 0.35) continue;
          const sx = c * streakCell + rand() * streakCell - cam - flow;
          const sy = L.fieldTop + (r + rand()) * (L.fieldH / streakRows);
          const len = 36 + rand() * 70;
          const fade = g.createLinearGradient(sx, 0, sx + len, 0);
          fade.addColorStop(0, "rgba(255,255,255,0)");
          fade.addColorStop(0.5, "rgba(255,255,255,0.5)");
          fade.addColorStop(1, "rgba(255,255,255,0)");
          g.strokeStyle = fade;
          g.beginPath();
          g.moveTo(sx, sy);
          g.quadraticCurveTo(sx + len * 0.5, sy - 3 - rand() * 3, sx + len, sy);
          g.stroke();
        }
      }
      g.lineCap = "butt";
    }

    if (habitat.marsh) {
      // Sky reflection near the bank, then slow depth bands across the water.
      const reflect = g.createLinearGradient(0, L.skyH + L.boardH + 4, 0, L.fieldTop + L.fieldH * 0.45);
      reflect.addColorStop(0, "rgba(255,244,200,0.3)");
      reflect.addColorStop(1, "rgba(255,244,200,0)");
      g.fillStyle = reflect;
      g.fillRect(0, L.skyH + L.boardH + 4, w, L.fieldTop + L.fieldH * 0.45 - (L.skyH + L.boardH + 4));
      const bands = count <= 12 ? count : Math.max(6, Math.round(L.fieldH / 44));
      const bandH = L.fieldH / bands;
      for (let b = 0; b < bands; b += 1) {
        g.fillStyle = b % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(0,30,30,0.07)";
        g.fillRect(0, L.fieldTop + b * bandH, w, bandH + 0.5);
      }
      // Shimmering glints that slide with the current.
      g.strokeStyle = "rgba(255,248,210,0.35)";
      g.lineWidth = 1.4;
      g.lineCap = "round";
      const glintCell = 170;
      const glintCol = Math.floor(cam / glintCell) - 1;
      const glintRows = Math.max(3, Math.round(L.fieldH / 60));
      for (let c = glintCol; c < glintCol + Math.ceil(w / glintCell) + 2; c += 1) {
        for (let r = 0; r < glintRows; r += 1) {
          const rand = mulberry32(hashString(`glint:${c}:${r}`));
          if (rand() < 0.4) continue;
          const pulse = 0.5 + 0.5 * Math.sin(Math.max(0, t) / 700 + rand() * 6.28);
          g.globalAlpha = 0.25 + pulse * 0.75;
          const gx = c * glintCell - cam + rand() * glintCell;
          const gy = L.fieldTop + (r + rand()) * (L.fieldH / glintRows);
          g.beginPath();
          g.moveTo(gx, gy);
          g.lineTo(gx + 14 + rand() * 20, gy);
          g.stroke();
        }
      }
      g.globalAlpha = 1;
      g.lineCap = "butt";
      // Lily pads and the odd lotus drifting on the surface.
      const padCell = 230;
      const padCol = Math.floor(cam / padCell) - 1;
      const padRows = Math.max(2, Math.round(L.fieldH / 90));
      for (let c = padCol; c < padCol + Math.ceil(w / padCell) + 2; c += 1) {
        for (let r = 0; r < padRows; r += 1) {
          const rand = mulberry32(hashString(`pad:${c}:${r}`));
          if (rand() < 0.45) continue;
          const px = c * padCell - cam + rand() * padCell;
          const py = L.fieldTop + (r + 0.2 + rand() * 0.6) * (L.fieldH / padRows);
          drawLilyPad(g, px, py, 12 + rand() * 11, rand);
        }
      }
    }

    if (count <= 24) {
      g.strokeStyle = habitat.lane;
      g.lineWidth = 1;
      for (let lane = 1; lane < count; lane += 1) {
        const y = (laneY(L, lane - 1) + laneY(L, lane)) / 2 + L.spriteH * 0.35;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
    }

    g.strokeStyle = habitat.mark;
    g.lineWidth = 1.6;
    const cell = 110;
    const firstCol = Math.floor(cam / cell) - 1;
    const rows = Math.ceil(L.fieldH / 34);
    const drift = (Math.max(0, t) / 1000) * 14;
    for (let c = firstCol; c < firstCol + Math.ceil(w / cell) + 2; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        const rand = mulberry32(hashString(`mark:${c}:${r}`));
        const x = c * cell - cam + rand() * cell - (drift % cell) * 0.2;
        const y = L.fieldTop + r * 34 + rand() * 20;
        const len = 10 + rand() * 18;
        g.beginPath();
        if (habitat.meadow) {
          const blade = 5 + len * 0.28;
          g.moveTo(x, y);
          g.lineTo(x - 3, y - blade);
          g.moveTo(x + 2, y);
          g.lineTo(x + 2, y - blade - 2);
          g.moveTo(x + 4, y);
          g.lineTo(x + 7, y - blade);
        } else if (habitat.garden) {
          const blade = 4 + len * 0.22;
          g.moveTo(x, y);
          g.lineTo(x - 2, y - blade);
          g.moveTo(x + 2, y);
          g.lineTo(x + 2, y - blade - 2);
          g.moveTo(x + 4, y);
          g.lineTo(x + 6, y - blade);
        } else if (habitat.beach) {
          g.rect(x, y, 1.6, 1.6);
          g.rect(x + 7, y - 4, 1.4, 1.4);
          g.rect(x + 13, y + 2, 1.8, 1.8);
        } else if (habitat.stream) {
          const bubble = 1.5 + len * 0.1;
          g.arc(x, y, bubble, 0, Math.PI * 2);
          g.moveTo(x + bubble * 3.2 + 3, y - bubble * 2);
          g.arc(x + bubble * 3.2, y - bubble * 2, bubble * 0.6, 0, Math.PI * 2);
        } else if (habitat.marsh) {
          g.ellipse(x + len / 2, y, len * 0.6, len * 0.15, 0, 0, Math.PI * 2);
        } else {
          g.moveTo(x, y);
          g.quadraticCurveTo(x + len / 2, y - 3, x + len, y);
        }
        g.stroke();
      }
    }

    const startX = L.startX - cam;
    if (startX > -10 && startX < w + 10) {
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.fillRect(startX - 2, L.fieldTop - 4, 4, L.fieldH + 4);
    }

    for (const mark of [0.25, 0.5, 0.75]) {
      const x = L.startX + L.trackLen * mark - cam;
      if (x < -40 || x > w + 40) continue;
      g.fillStyle = "rgba(255,255,255,0.18)";
      g.fillRect(x - 1, L.fieldTop, 2, L.fieldH);
      g.fillStyle = "rgba(255,255,255,0.75)";
      g.font = `700 12px "Trebuchet MS", sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "top";
      g.fillText(`${Math.round(mark * 100)}%`, x, L.fieldTop + 2);
    }

    const finishX = L.finishX - cam;
    if (finishX > -30 && finishX < w + 30) {
      const square = 7;
      for (let y = L.fieldTop - 6, row = 0; y < L.fieldBottom; y += square, row += 1) {
        for (let col = 0; col < 2; col += 1) {
          g.fillStyle = (row + col) % 2 === 0 ? "#fff" : "#111";
          g.fillRect(finishX - square + col * square, y, square, square);
        }
      }
      g.fillStyle = "#e03131";
      g.fillRect(finishX - 3, L.skyH - L.skyH * 0.35, 6, L.skyH * 0.35 + 4);
      roundRect(g, finishX - 46, L.skyH - L.skyH * 0.35 - 22, 92, 22, 6);
      g.fill();
      g.fillStyle = "#fff";
      g.font = `800 13px "Trebuchet MS", sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(labels.finish, finishX, L.skyH - L.skyH * 0.35 - 10);
    }
  }

  function bodyMotion(animal, track, progress, speed, t, L) {
    const stride = (progress * L.trackLen) / Math.max(18, L.spriteH * 0.9) + track.phase;
    const moving = t > 0 && progress < 1.02;
    if (animal === "frog") {
      if (!moving || progress > 1.01) return { dy: 0, rot: 0, squash: 1, frame: 0, air: 0, shift: 0 };
      const c = (((stride * HOPS_PER_STRIDE) % 1) + 1) % 1;
      const frame = 1 + Math.min(FROG_FRAMES - 1, Math.floor(c * FROG_FRAMES));
      const settle = clamp((1 - progress) / 0.04, 0, 1);
      const hopPx = Math.max(18, L.spriteH * 0.9) / HOPS_PER_STRIDE;
      if (c >= FROG_TAKEOFF && c < FROG_LANDING) {
        const u = (c - FROG_TAKEOFF) / (FROG_LANDING - FROG_TAKEOFF);
        const air = 4 * u * (1 - u);
        return { dy: -air * L.spriteH * 0.5, rot: -0.22 * Math.cos(Math.PI * u), squash: 1 + air * 0.04, frame, air, shift: (u - c) * hopPx * settle };
      }
      const ground = 1 - FROG_LANDING + FROG_TAKEOFF;
      const u = (c >= FROG_LANDING ? c - FROG_LANDING : c + 1 - FROG_LANDING) / ground;
      const held = c >= FROG_LANDING ? 1 - c : -c;
      return { dy: 0, rot: 0.05 * Math.sin(Math.PI * u), squash: 1 - Math.sin(Math.PI * u) * 0.1, frame, air: 0, shift: held * hopPx * settle };
    }
    if (animal === "fish") {
      const swimming = moving && progress < 1.01;
      const beat = swimming ? stride * 0.9 : t / 900 + track.phase;
      const cycle = (((beat / (Math.PI * 2)) % 1) + 1) % 1;
      const sway = Math.sin(beat);
      return {
        dy: Math.sin(beat * 0.5 + track.phase) * L.spriteH * 0.05,
        rot: swimming ? -sway * 0.035 : 0,
        squash: 1,
        frame: 1 + Math.floor(cycle * 8),
      };
    }
    if (animal === "turtle") {
      if (!moving || progress > 1.01) return { dy: 0, rot: 0, squash: 1, frame: 0 };
      const cycle = (((stride * 0.5) % 1) + 1) % 1;
      return { dy: 0, rot: 0, squash: 1, frame: 1 + Math.floor(cycle * 8) };
    }
    if (animal === "snail") {
      if (!moving || progress > 1.01) return { dy: 0, rot: 0, squash: 1, frame: 0 };
      const cycle = (((stride * 0.4) % 1) + 1) % 1;
      return { dy: 0, rot: 0, squash: 1, frame: 1 + Math.floor(cycle * 8) };
    }
    if (!moving || progress > 1.01) return { dy: 0, rot: 0, squash: 1, frame: 0 };
    const cycle = (((stride * 0.45) % 1) + 1) % 1;
    return { dy: 0, rot: 0, squash: 1, frame: 1 + Math.floor(cycle * 6) };
  }

  // Opaque extent of the baked sprite, as fractions of the sprite height measured from the lane line.
  // `bottom` is averaged over every frame so the contact point does not jump with the stride.
  let extent = null;
  function extentOf(sprite) {
    if (extent) return extent;
    extent = { top: -0.5, bottom: 0.3 };
    try {
      let topSum = 0;
      let bottomSum = 0;
      let seen = 0;
      for (const image of fullFrames(sprite)) {
        if (!image) continue;
        const pad = image.pad || NO_PAD;
        const data = image.getContext("2d").getImageData(0, 0, image.width, image.height).data;
        const toFrac = (row) => -0.62 + (((row / image.height) * (SPRITE_H + pad.top + pad.bottom)) - pad.top) / SPRITE_H;
        const solid = (row) => {
          let hits = 0;
          for (let col = 0; col < image.width; col += 1) {
            if (data[(row * image.width + col) * 4 + 3] > 80 && ++hits >= 4) return true;
          }
          return false;
        };
        let first = 0;
        while (first < image.height && !solid(first)) first += 1;
        let last = image.height - 1;
        while (last > first && !solid(last)) last -= 1;
        topSum += toFrac(first);
        bottomSum += toFrac(last + 1);
        seen += 1;
      }
      if (seen) extent = { top: topSum / seen, bottom: bottomSum / seen };
    } catch {
      extent = { top: -0.5, bottom: 0.3 };
    }
    return extent;
  }

  const DUST_STEP = 60;
  const DUST_LIFE = 1400;
  const dustPower = new Map();

  // How hard the turtle was pushing forward at a past moment, and how fast it was going.
  // `power` is the strength of the burst (acceleration plus a light trail while moving fast);
  // `pace` is the speed relative to the average, which sets how big and long-lived the cloud is.
  function pushAt(track, when) {
    if (when <= 0 || when >= track.finishMs) return { power: 0, pace: 0 };
    const key = track.lane * 1000003 + Math.round(when / DUST_STEP);
    const known = dustPower.get(key);
    if (known) return known;
    const now = speedAt(track, when) * plan.durationMs;
    const before = speedAt(track, when - 300) * plan.durationMs;
    const gain = now - before;
    const pace = clamp(now / 2, 0.15, 1.5);
    const burst = clamp((gain - 0.02) / 0.25, 0, 1);
    const cruise = clamp((now - 0.6) * 0.6, 0, 0.55);
    const entry = { power: Math.max(burst, cruise) * (0.7 + pace * 0.3), pace };
    if (dustPower.size > 40000) dustPower.clear();
    dustPower.set(key, entry);
    return entry;
  }

  function drawDust(g, track, row, t, x, ground, sw, sh, cam, spriteW, viewW, L) {
    if (count > 30) return;
    const newest = Math.floor(t / DUST_STEP);
    const puffs = Math.ceil(DUST_LIFE / DUST_STEP);
    g.save();
    for (let k = 0; k < puffs; k += 1) {
      const index = newest - k;
      const born = index * DUST_STEP;
      const age = (t - born) / DUST_LIFE;
      if (age < 0 || age >= 1) continue;
      const { power, pace } = pushAt(track, born);
      if (power <= 0.02) continue;
      const rand = mulberry32(hashString(`dust:${track.lane}:${index}`));
      const bornX = L.startX + progressAt(track, born) * L.trackLen - cam - spriteW * 0.92;
      const originX = bornX + sw * (0.16 + rand() * 0.08);
      const ease = 1 - Math.pow(1 - age, 2);
      const billow = sh * (0.12 + power * 0.14 + pace * 0.08) * (0.6 + ease * (1.3 + pace));
      const px = originX - sw * (0.14 + pace * 0.3) * ease - rand() * sw * 0.06;
      const py = ground - sh * 0.05 - ease * sh * (0.16 + power * 0.26 + pace * 0.1) * (0.7 + rand() * 0.6);
      if (px < -sw * 2 || px > viewW + sw) continue;
      const fadeIn = Math.min(1, age / 0.06);
      const alpha = Math.min(1, power * 1.15) * Math.pow(1 - age, 1.25) * fadeIn;
      // A ragged cloud: several flattened blobs, hugging the ground and fanning out behind the flippers.
      const blobs = count <= 12 ? 9 : 4;
      for (let b = 0; b < blobs; b += 1) {
        const spread = (b / Math.max(1, blobs - 1) - 0.5) * 2;
        const bx = px + spread * billow * 1.15 + (rand() - 0.5) * billow * 0.4;
        const by = py + (rand() - 0.35) * billow * 0.5 + Math.abs(spread) * billow * 0.12 - (1 - Math.abs(spread)) * billow * 0.25;
        const r = billow * (0.5 + rand() * 0.5) * (1 - Math.abs(spread) * 0.25);
        g.save();
        g.translate(bx, by);
        g.scale(1.25, 0.72);
        const puff = g.createRadialGradient(0, 0, r * 0.05, 0, 0, r);
        // Warm ochre body with a pale core so the cloud reads against light sand.
        puff.addColorStop(0, `rgba(240,222,184,${alpha * 0.95})`);
        puff.addColorStop(0.45, `rgba(196,156,100,${alpha * 0.85})`);
        puff.addColorStop(0.8, `rgba(150,110,66,${alpha * 0.45})`);
        puff.addColorStop(1, "rgba(130,92,52,0)");
        g.fillStyle = puff;
        g.beginPath();
        g.arc(0, 0, r, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      // A few kicked-up grains that arc away from the flippers.
      if (age < 0.6 && power > 0.15) {
        const grains = pace > 0.9 ? 7 : 4;
        for (let n = 0; n < grains; n += 1) {
          const gv = (0.4 + rand() * 0.9) * sh * 0.9;
          const ga = -Math.PI * (0.62 + rand() * 0.3);
          const gt = age * (DUST_LIFE / 1000);
          const gx = originX + Math.cos(ga) * gv * gt;
          const gy = ground - sh * 0.04 + Math.sin(ga) * gv * gt + sh * 1.6 * gt * gt;
          if (gy > ground + sh * 0.04) continue;
          g.fillStyle = `rgba(150,108,62,${Math.min(1, power * 1.2) * (1 - age * 1.6)})`;
          g.beginPath();
          g.arc(gx, gy, Math.max(1.2, sh * 0.02), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.restore();
  }

  // ---- Fish: partly submerged body, surface ripples, bow wave, and spray ----
  const tinted = new WeakMap();
  // Share of the body height, measured from the top, where the surface cuts the fish (1/3 submerged).
  const WATERLINE = 4 / 5;

  function submergedImage(image, waterFrac) {
    const known = tinted.get(image);
    if (known) return known;
    const pad = image.pad || NO_PAD;
    const copy = document.createElement("canvas");
    copy.width = image.width;
    copy.height = image.height;
    const k = copy.getContext("2d");
    k.drawImage(image, 0, 0);
    k.globalCompositeOperation = "source-atop";
    const row = (((waterFrac + 0.62) * SPRITE_H + pad.top) / (SPRITE_H + pad.top + pad.bottom)) * image.height;
    const grad = k.createLinearGradient(0, row - 6, 0, image.height);
    grad.addColorStop(0, "rgba(150,226,244,0.4)");
    grad.addColorStop(0.45, "rgba(40,158,210,0.58)");
    grad.addColorStop(1, "rgba(8,82,150,0.74)");
    k.fillStyle = grad;
    k.fillRect(0, 0, image.width, image.height);
    tinted.set(image, copy);
    return copy;
  }

  const RIPPLE_STEP = 70;
  const RIPPLE_LIFE = 1300;
  const ripplePower = new Map();

  function swimAt(track, when) {
    const key = track.lane * 1000003 + Math.round(when / RIPPLE_STEP);
    const known = ripplePower.get(key);
    if (known != null) return known;
    const pace = when > 0 && when < track.finishMs + 600 ? clamp((speedAt(track, when) * plan.durationMs) / 2, 0.12, 1.5) : 0.12;
    if (ripplePower.size > 40000) ripplePower.clear();
    ripplePower.set(key, pace);
    return pace;
  }

  function surfaceRipples(g, track, t, waterY, sw, sh, cam, spriteW, viewW, L) {
    const newest = Math.floor(t / RIPPLE_STEP);
    const total = Math.ceil(RIPPLE_LIFE / RIPPLE_STEP);
    g.save();
    g.lineCap = "round";
    for (let k = 0; k < total; k += 1) {
      const index = newest - k;
      const born = index * RIPPLE_STEP;
      const age = (t - born) / RIPPLE_LIFE;
      if (age < 0 || age >= 1) continue;
      const pace = swimAt(track, born);
      const racing = born > 0;
      if (!racing && index % 9 !== 0) continue;
      const power = racing ? 0.4 + pace * 0.6 : 0.25;
      const bornX = L.startX + progressAt(track, born) * L.trackLen - cam - spriteW * 0.92;
      const cx = bornX + sw * 0.62;
      if (cx < -sw * 2 || cx > viewW + sw * 2) continue;
      const ease = 1 - Math.pow(1 - age, 1.8);
      const rx = sw * (0.1 + ease * (0.4 + pace * 0.55));
      const ry = rx * 0.2;
      const fade = Math.pow(1 - age, 1.4);
      for (let ring = 0; ring < 2; ring += 1) {
        const scale = ring ? 0.58 : 1;
        g.strokeStyle = `rgba(238,252,255,${(ring ? 0.5 : 0.85) * fade * Math.min(1, power)})`;
        g.lineWidth = (0.9 + pace * 1.9) * (1 - age * 0.6) * (ring ? 0.8 : 1);
        g.beginPath();
        g.ellipse(cx, waterY + sh * 0.02, rx * scale, ry * scale, 0, 0, Math.PI * 2);
        g.stroke();
      }
      if (age < 0.35) {
        const glow = g.createRadialGradient(cx, waterY, 0, cx, waterY, rx);
        glow.addColorStop(0, `rgba(255,255,255,${0.35 * fade * power})`);
        glow.addColorStop(1, "rgba(255,255,255,0)");
        g.save();
        g.translate(cx, waterY);
        g.scale(1, 0.22);
        g.fillStyle = glow;
        g.translate(-cx, -waterY);
        g.beginPath();
        g.arc(cx, waterY, rx, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
    g.restore();
  }

  function bowWave(g, t, x, waterY, sw, sh, pace) {
    const nose = x + sw * 0.94;
    const len = sw * (0.28 + pace * 0.55);
    const spread = sh * (0.05 + pace * 0.1);
    const wobble = Math.sin(t / 90) * 0.8;
    g.save();
    g.lineCap = "round";
    for (const side of [-1, 1]) {
      g.strokeStyle = `rgba(245,253,255,${0.35 + pace * 0.4})`;
      g.lineWidth = 1.2 + pace * 1.8;
      g.beginPath();
      g.moveTo(nose, waterY);
      g.quadraticCurveTo(nose - len * 0.5, waterY + side * spread * 0.35 + wobble, nose - len, waterY + side * spread);
      g.stroke();
      g.strokeStyle = `rgba(245,253,255,${0.22 + pace * 0.25})`;
      g.lineWidth = 0.9 + pace;
      g.beginPath();
      g.moveTo(nose - len * 0.15, waterY);
      g.quadraticCurveTo(nose - len * 0.6, waterY + side * spread * 0.5, nose - len * 1.25, waterY + side * spread * 1.35);
      g.stroke();
    }
    // Foam riding along the waterline.
    for (let f = 0; f < 5; f += 1) {
      const fx = x + sw * (0.2 + f * 0.17) - ((t / 5) % 6);
      g.fillStyle = `rgba(255,255,255,${0.35 + 0.25 * Math.sin(t / 120 + f * 2)})`;
      g.beginPath();
      g.ellipse(fx, waterY + sh * 0.015, sw * 0.045, sh * 0.018, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function sprayAndBubbles(g, t, x, waterY, sw, sh, pace, lane) {
    g.save();
    if (pace > 0.7) {
      const drops = pace > 1.05 ? 7 : 4;
      for (let i = 0; i < drops; i += 1) {
        const phase = (t / (320 - pace * 70) + i / drops + lane * 0.13) % 1;
        const rand = mulberry32(hashString(`spray:${lane}:${i}`));
        const vx = sw * (0.12 + rand() * 0.28) * (0.6 + pace * 0.5);
        const vy = sh * (0.28 + rand() * 0.34) * (0.6 + pace * 0.6);
        const dx = vx * phase * 1.2;
        const dy = -vy * phase + sh * 0.7 * phase * phase;
        g.fillStyle = `rgba(240,252,255,${0.85 * (1 - phase)})`;
        g.beginPath();
        g.arc(x + sw * 0.96 + dx * 0.4 - sw * 0.1 * phase, waterY + dy, Math.max(1, sh * (0.022 + rand() * 0.014)), 0, Math.PI * 2);
        g.fill();
      }
    }
    // Bubbles streaming off the tail and rising to the surface.
    g.lineWidth = 1;
    for (let i = 0; i < 6; i += 1) {
      const phase = (t / (900 - pace * 250) + i / 6 + lane * 0.21) % 1;
      const rand = mulberry32(hashString(`bubble:${lane}:${i}`));
      const bx = x + sw * 0.12 - phase * sw * (0.25 + pace * 0.35) - rand() * sw * 0.05;
      const by = waterY + sh * (0.26 + rand() * 0.12) - phase * sh * 0.22 + Math.sin(phase * 12 + i) * 1.5;
      g.strokeStyle = `rgba(230,250,255,${0.75 * (1 - phase)})`;
      g.beginPath();
      g.arc(bx, by, 1.2 + rand() * 1.8 * (0.6 + pace * 0.4), 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  function drawSwimmer(g, paint, image, sprite, track, row, t, x, y, sw, sh, cam, spriteW, viewW, L, speed) {
    // Only the lowest third of the body is underwater; the eyes stay clear of the surface.
    const span = extentOf(sprite);
    const waterFrac = span.top + (span.bottom - span.top) * WATERLINE;
    const waterY = y + sh * waterFrac;
    const pace = t > 0 && !row.done ? clamp(speed / 2, 0.12, 1.5) : row.done ? 0.2 : 0.12;
    const amp = 0.7 + pace * 2.2;
    const left = x - sw * 1.2;
    const right = x + sw * 2.2;
    const surface = (clipBelow) => {
      g.beginPath();
      g.moveTo(left, clipBelow ? y + sh * 2 : y - sh * 2);
      g.lineTo(left, waterY);
      for (let px = left; px <= right; px += 6) {
        g.lineTo(px, waterY + Math.sin(px * 0.11 + t / (140 - pace * 40)) * amp);
      }
      g.lineTo(right, waterY);
      g.lineTo(right, clipBelow ? y + sh * 2 : y - sh * 2);
      g.closePath();
    };
    // Back and dorsal fin above the surface, belly and tail seen through the water.
    g.save();
    surface(false);
    g.clip();
    paint(image, true);
    g.restore();
    g.save();
    surface(true);
    g.clip();
    paint(submergedImage(image, waterFrac), false);
    g.restore();

    // Meniscus: a bright rim where the water meets the body.
    g.save();
    g.lineCap = "round";
    g.strokeStyle = `rgba(235,252,255,${0.55 + pace * 0.3})`;
    g.lineWidth = 1.3 + pace;
    g.beginPath();
    for (let px = x + sw * 0.05; px <= x + sw * 1.0; px += 5) {
      const py = waterY + Math.sin(px * 0.11 + t / (140 - pace * 40)) * amp;
      if (px === x + sw * 0.05) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
    g.restore();

    if (count <= 30) surfaceRipples(g, track, t, waterY, sw, sh, cam, spriteW, viewW, L);
    bowWave(g, t, x, waterY, sw, sh, pace);
    if (count <= 30) sprayAndBubbles(g, t, x, waterY, sw, sh, pace, track.lane);
  }

  function drawRacers(g, w, L, cam, t, rows, follow) {
    const byLane = new Map(rows.map((row, index) => [row.track.lane, { ...row, rank: index }]));
    const labelled = new Set();
    const allLabels = L.compact ? 12 : 40;
    const laneGap = (L.fieldH - L.spriteH * 0.75) / count;
    if (count <= allLabels && laneGap >= 22) plan.tracks.forEach((track) => labelled.add(track.lane));
    else if (t > 0) rows.slice(0, L.compact ? 5 : 10).forEach((row) => labelled.add(row.track.lane));
    if (follow != null) labelled.add(follow);

    const spriteW = (L.spriteH * SPRITE_W) / SPRITE_H;
    const tags = [];
    const positions = [];
    for (const track of plan.tracks) {
      const row = byLane.get(track.lane);
      const trackX = L.startX + row.progress * L.trackLen - cam - spriteW * 0.92;
      if (trackX < -spriteW * 1.5 || trackX > w + spriteW) continue;
      const y = laneY(L, track.lane);
      const speed = speedAt(track, t) * plan.durationMs;
      const motion = bodyMotion(animal, track, row.progress, speed, t, L);
      const x = trackX + (motion.shift || 0);
      const depth = 0.86 + (track.lane / Math.max(1, count - 1)) * 0.14;
      const sw = spriteW * depth;
      const sh = L.spriteH * depth;

      const lift = 1 - 0.45 * (motion.air || 0);
      if (animal === "turtle") {
        // Contact shadow tucked right under the flippers so the turtle sits on the sand.
        const foot = extentOf(sprites[track.lane]).bottom;
        // Centre the shadow a little above the flipper tips so it tucks under the shell.
        const ground = y + sh * (foot - 0.03);
        const spread = sw * 0.4;
        const cx = x + sw * 0.46;
        const pool = g.createRadialGradient(cx, ground, 0, cx, ground, spread);
        pool.addColorStop(0, "rgba(60,34,8,0.55)");
        pool.addColorStop(0.5, "rgba(60,34,8,0.34)");
        pool.addColorStop(1, "rgba(60,34,8,0)");
        g.save();
        g.translate(0, ground);
        g.scale(1, (sh * 0.085) / spread);
        g.translate(0, -ground);
        g.fillStyle = pool;
        g.beginPath();
        g.arc(cx, ground, spread, 0, Math.PI * 2);
        g.fill();
        g.restore();
        if (t > 0 && row.progress < 1.01) drawDust(g, track, row, t, x, ground, sw, sh, cam, spriteW, w, L);
      } else {
        g.fillStyle = `rgba(0,0,0,${0.18 * lift})`;
        g.beginPath();
        g.ellipse(x + sw * 0.5, y + sh * 0.36, sw * 0.34 * lift, sh * 0.09 * lift, 0, 0, Math.PI * 2);
        g.fill();
      }

      if (t > 0 && !row.done && speed > 1.25) {
        g.strokeStyle = "rgba(255,255,255,0.55)";
        g.lineWidth = Math.max(1, sh * 0.05);
        for (let k = 0; k < 3; k += 1) {
          const ly = y - sh * 0.15 + k * sh * 0.14;
          g.beginPath();
          g.moveTo(x - sw * (0.05 + k * 0.08), ly);
          g.lineTo(x - sw * (0.35 + k * 0.1) * Math.min(2, speed - 0.8), ly);
          g.stroke();
        }
      }

      const sprite = sprites[track.lane];
      const image = frameOf(sprite, motion.frame || 0);
      if (!image) {
        // Not baked yet (only for a moment on very large fields): a plain blob in the racer's colour.
        g.fillStyle = sprite.skin.color;
        g.beginPath();
        g.ellipse(x + sw * 0.5, y + sh * 0.08, sw * 0.3, sh * 0.2, 0, 0, Math.PI * 2);
        g.fill();
      } else {
        const pad = image.pad || NO_PAD;
        const unitPx = sw / SPRITE_W;
        const paint = (picture, glow) => {
          g.save();
          g.translate(x + sw / 2, y + motion.dy);
          g.rotate(motion.rot);
          g.scale(1 / motion.squash, motion.squash);
          if (glow && follow === track.lane) {
            g.shadowColor = "#fff";
            g.shadowBlur = 14;
          }
          g.drawImage(picture, -sw / 2 - pad.left * unitPx, -sh * 0.62 - pad.top * unitPx, (SPRITE_W + pad.left + pad.right) * unitPx, (SPRITE_H + pad.top + pad.bottom) * unitPx);
          g.restore();
        };
        if (animal === "fish") {
          drawSwimmer(g, paint, image, sprite, track, row, t, x, y, sw, sh, cam, spriteW, w, L, speed);
        } else {
          paint(image, true);
        }
      }

      if (animal === "frog" && t > 0 && row.progress < 1.01) {
        const unit = Math.max(18, L.spriteH * 0.9);
        const hops = ((row.progress * L.trackLen) / unit + track.phase) * HOPS_PER_STRIDE;
        for (const splash of SPLASHES) {
          const n = Math.floor(hops - splash.mark);
          const age = (hops - splash.mark - n) / splash.span;
          if (age >= 1) continue;
          const touch = splash.kind === "land" ? n + 1 : n;
          if (n + splash.mark < track.phase * HOPS_PER_STRIDE) continue;
          const at = ((touch / HOPS_PER_STRIDE - track.phase) * unit) / L.trackLen;
          const sx = L.startX + at * L.trackLen - cam - spriteW * 0.92 + sw * splash.foot;
          drawSplash(g, sx, y + sh * 0.22, sw * (splash.kind === "land" ? 0.3 : 0.2), age, n * 7919 + track.lane * 131 + splash.kind.length, splash.kind);
        }
      }

      if (row.done && track.place <= Math.max(3, count <= 40 ? count : 10)) {
        const medal = MEDALS[track.place - 1] || "#fff";
        const r = clamp(sh * 0.2, 7, 13);
        g.beginPath();
        g.arc(x + sw * 0.9, y - sh * 0.55, r, 0, Math.PI * 2);
        g.fillStyle = medal;
        g.fill();
        g.strokeStyle = "#1c2836";
        g.lineWidth = 1.5;
        g.stroke();
        g.fillStyle = "#1c2836";
        g.font = `800 ${Math.round(r * 1.1)}px "Trebuchet MS", sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(String(track.place), x + sw * 0.9, y - sh * 0.55 + 1);
      }
      positions.push({ lane: track.lane, x, y: y - sh * 0.62 + motion.dy, w: sw, h: sh });
      if (labelled.has(track.lane)) tags.push({ track, x: x + sw * 0.45, y: y - sh * 0.62 + motion.dy, focus: follow === track.lane });
    }
    lastPositions = positions;

    const size = clamp(L.spriteH * 0.32, 10, 14);
    g.font = `700 ${size}px "Trebuchet MS", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const label of tags) {
      const text = fitText(g, label.track.name, 110);
      const tw = g.measureText(text).width + 12;
      roundRect(g, label.x - tw / 2, label.y - size - 6, tw, size + 6, (size + 6) / 2);
      g.fillStyle = label.focus ? "rgba(255,212,59,0.95)" : "rgba(10,20,30,0.62)";
      g.fill();
      g.fillStyle = label.focus ? "#1c2836" : "#fff";
      g.fillText(text, label.x, label.y - size / 2 - 3);
    }
  }

  function drawHud(g, w, h, L, t, rows, status) {
    const clockMs = clamp(t, 0, plan.winner.finishMs);
    const pad = 10;
    g.font = `800 ${L.compact ? 14 : 16}px "Trebuchet MS", sans-serif`;
    g.textBaseline = "middle";
    g.textAlign = "left";
    const title = fitText(g, race.name, L.compact ? 150 : 260);
    const clock = formatClock(clockMs);
    const titleW = g.measureText(title).width;
    g.font = `800 ${L.compact ? 18 : 22}px ui-monospace, Consolas, monospace`;
    const clockW = g.measureText(clock).width;
    const boxW = titleW + clockW + 36;
    roundRect(g, pad, pad, boxW, L.compact ? 30 : 36, 10);
    g.fillStyle = "rgba(10,18,28,0.72)";
    g.fill();
    g.fillStyle = "#fff";
    g.font = `800 ${L.compact ? 14 : 16}px "Trebuchet MS", sans-serif`;
    g.fillText(title, pad + 12, pad + (L.compact ? 15 : 18));
    g.fillStyle = "#7dffa1";
    g.font = `800 ${L.compact ? 18 : 22}px ui-monospace, Consolas, monospace`;
    g.fillText(clock, pad + 24 + titleW, pad + (L.compact ? 15 : 18));

    const shown = rows.slice(0, L.compact ? 3 : 5);
    const boardW = L.compact ? 150 : 200;
    const lineH = L.compact ? 18 : 21;
    const stacked = boxW + boardW + pad * 3 > w;
    const bx = w - boardW - pad;
    const by = stacked ? pad + (L.compact ? 30 : 36) + 6 : pad;
    roundRect(g, bx, by, boardW, 24 + shown.length * lineH, 10);
    g.fillStyle = "rgba(10,18,28,0.72)";
    g.fill();
    g.fillStyle = "#d6b25e";
    g.font = `800 11px "Trebuchet MS", sans-serif`;
    const heading = status === "ready" ? labels.lineup : t < plan.endMs ? labels.live : labels.result;
    g.fillText(heading, bx + 10, by + 12);
    shown.forEach((row, index) => {
      const y = by + 24 + index * lineH + lineH / 2 - 2;
      g.fillStyle = sprites[row.track.lane].skin.color;
      g.beginPath();
      g.arc(bx + 16, y, 5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = row.done ? MEDALS[index] || "#fff" : "#fff";
      g.font = `800 ${L.compact ? 12 : 13}px "Trebuchet MS", sans-serif`;
      g.fillText(`${index + 1}.`, bx + 26, y);
      g.fillStyle = "#fff";
      g.font = `600 ${L.compact ? 12 : 13}px "Trebuchet MS", sans-serif`;
      g.fillText(fitText(g, row.track.name, boardW - 56), bx + 46, y);
    });

    const barY = h - (L.compact ? 16 : 20);
    const barX = pad + 4;
    const barW = w - pad * 2 - 8;
    roundRect(g, barX, barY - 4, barW, 8, 4);
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fill();
    for (const row of rows) {
      const px = barX + clamp(row.progress, 0, 1) * barW;
      g.fillStyle = sprites[row.track.lane].skin.color;
      g.fillRect(px - 1.5, barY - 4, 3, 8);
    }
    g.fillStyle = "#fff";
    g.fillRect(barX + barW - 2, barY - 7, 3, 14);

    const lead = rows[0];
    if (t > 0 && t < plan.winner.finishMs && lead.progress > 0.86) {
      const pulse = 0.65 + Math.sin(t / 120) * 0.35;
      g.globalAlpha = pulse;
      g.fillStyle = "#ffd43b";
      g.font = `900 ${L.compact ? 18 : 24}px "Trebuchet MS", sans-serif`;
      g.textAlign = "center";
      g.fillText(labels.finalStretch, w / 2, L.skyH * 0.32);
      g.globalAlpha = 1;
    }

    if (t >= plan.winner.finishMs) {
      const text = `${labels.winner}  ${plan.winner.name}`;
      g.font = `900 ${L.compact ? 18 : 26}px "Trebuchet MS", sans-serif`;
      g.textAlign = "center";
      const tw = Math.min(w - 40, g.measureText(text).width + 40);
      const flash = clamp(1 - (t - plan.winner.finishMs) / 600, 0, 1);
      roundRect(g, w / 2 - tw / 2, L.skyH * 0.32 - 20, tw, 40, 20);
      g.fillStyle = `rgba(255,212,59,${0.85 + flash * 0.15})`;
      g.fill();
      g.fillStyle = "#1c2836";
      g.fillText(fitText(g, text, tw - 30), w / 2, L.skyH * 0.32 + 1);
      if (flash > 0) {
        g.fillStyle = `rgba(255,255,255,${flash * 0.55})`;
        g.fillRect(0, 0, w, h);
      }
    }

    if (status === "racing" && t < 700 && t > -3200) {
      const label = t < 0 ? String(Math.ceil(-t / 1000)) : labels.go;
      const local = t < 0 ? 1 - ((-t % 1000) / 1000) : t / 700;
      g.save();
      g.globalAlpha = t < 0 ? 1 : 1 - local;
      g.translate(w / 2, h / 2);
      g.scale(1 + local * 0.35, 1 + local * 0.35);
      g.font = `900 ${Math.round(Math.min(w, h) * 0.22)}px "Trebuchet MS", sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 10;
      g.strokeStyle = "#1c2836";
      g.strokeText(label, 0, 0);
      g.fillStyle = t < 0 ? "#fff" : "#7dffa1";
      g.fillText(label, 0, 0);
      g.restore();
    }
  }

  function draw(g, w, h, t, { follow = null, status = "racing" } = {}) {
    bakeDeadline = performance.now() + BAKE_BUDGET_MS;
    bakedThisFrame = 0;
    const L = layout(w, h);
    const rows = standings(plan, t);
    const cam = cameraX(L, w, rows, t, follow);
    g.clearRect(0, 0, w, h);
    drawSky(g, w, L, cam, t);
    drawBoards(g, w, L, cam, t);
    drawField(g, w, h, L, cam, t);
    drawRacers(g, w, L, cam, t, rows, follow);
    drawHud(g, w, h, L, t, rows, status);
  }

  function positionOf(lane) {
    return lastPositions.find((item) => item.lane === lane) || null;
  }

  function hitTest(px, py) {
    let best = null;
    let bestDistance = Infinity;
    for (const item of lastPositions) {
      const inside = px >= item.x && px <= item.x + item.w && py >= item.y && py <= item.y + item.h;
      const cx = item.x + item.w / 2;
      const cy = item.y + item.h / 2;
      const distance = Math.hypot(px - cx, py - cy) - (inside ? 1000 : 0);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = item;
      }
    }
    if (!best) return null;
    return bestDistance < Math.max(40, best.h) ? best.lane : null;
  }

  return { plan, sprites, draw, hitTest, positionOf, prewarm };
}
