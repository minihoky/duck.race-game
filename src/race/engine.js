import { formatClock } from "../lib/format";
import { SPRITE_H, SPRITE_W, bakeFrames, skinsFor } from "./art";
import { buildPlan, hashString, mulberry32, progressAt, speedAt, standings } from "./motion";

const HABITATS = {
  rabbit: {
    sky: ["#7cc8f2", "#e3f4ff"],
    far: "#8cc46a",
    mid: "#4f8a3a",
    surface: ["#86c95f", "#4e9a3b"],
    mark: "rgba(40,90,30,0.35)",
    lane: "rgba(255,255,255,0.1)",
    decor: "tree",
  },
  frog: {
    sky: ["#b5e8c8", "#f0fbe0"],
    far: "#6b8f3d",
    mid: "#3f6a2a",
    surface: ["#4f8a5e", "#28553b"],
    mark: "rgba(190,240,170,0.35)",
    lane: "rgba(255,255,255,0.06)",
    decor: "reed",
  },
  fish: {
    sky: ["#9cc3f5", "#e1ecfb"],
    far: "#7486a1",
    mid: "#2f6b45",
    surface: ["#2fb2d4", "#0d6e8e"],
    mark: "rgba(255,255,255,0.38)",
    lane: "rgba(255,255,255,0.08)",
    decor: "pine",
  },
  turtle: {
    sky: ["#f7955a", "#fde7a3"],
    far: "#2b9fd9",
    mid: "#1f5c45",
    surface: ["#f3dba6", "#ddb26e"],
    mark: "rgba(150,100,40,0.28)",
    lane: "rgba(120,80,30,0.08)",
    decor: "palm",
  },
  seahorse: {
    sky: ["#0b3b5c", "#0f6a96"],
    far: "#145a70",
    mid: "#c2416f",
    surface: ["#11718c", "#0a3f55"],
    mark: "rgba(200,240,255,0.35)",
    lane: "rgba(255,255,255,0.05)",
    decor: "coral",
  },
};

const MEDALS = ["#ffd43b", "#ced4da", "#e8a15a"];

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

export function createRace(race, sponsorImages = []) {
  const plan = buildPlan(race);
  const look = skinsFor(race);
  const animal = HABITATS[race.animal] ? race.animal : "rabbit";
  const habitat = HABITATS[animal];
  const count = plan.tracks.length;
  const sprites = plan.tracks.map((track) => {
    const skin = look(track.lane);
    return { skin, frames: bakeFrames(animal, skin) };
  });

  function layout(w, h) {
    const compact = w < 640;
    const skyH = h * (compact ? 0.24 : 0.28);
    const boardH = clamp(h * 0.075, 22, 52);
    const fieldTop = skyH + boardH + 8;
    const fieldBottom = h - (compact ? 30 : 38);
    const fieldH = fieldBottom - fieldTop;
    const spriteH = clamp((fieldH / count) * 1.7, compact ? 22 : 30, Math.min(72, fieldH * 0.3));
    const trackLen = w * clamp(plan.durationMs / 7000, 2.2, 9);
    const startX = w * 0.14;
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

  function drawSky(g, w, L, cam) {
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
      g.fillStyle = "#6b4a2b";
      g.fillRect(x - size * 0.05, base - size * 0.5, size * 0.1, size * 0.5);
      g.fillStyle = habitat.mid;
      g.beginPath();
      g.arc(x, base - size * 0.65, size * 0.32, 0, Math.PI * 2);
      g.arc(x - size * 0.2, base - size * 0.5, size * 0.22, 0, Math.PI * 2);
      g.arc(x + size * 0.22, base - size * 0.52, size * 0.24, 0, Math.PI * 2);
      g.fill();
    } else if (kind === "reed") {
      g.strokeStyle = habitat.mid;
      g.lineWidth = 2;
      for (let j = 0; j < 5; j += 1) {
        const rx = x + (j - 2) * size * 0.08;
        const top = base - size * (0.6 + rand() * 0.4);
        g.beginPath();
        g.moveTo(rx, base);
        g.quadraticCurveTo(rx + 4, (base + top) / 2, rx + (rand() - 0.5) * 8, top);
        g.stroke();
        if (j % 2 === 0) {
          g.fillStyle = "#6b4226";
          roundRect(g, rx - 2.5, top + 4, 5, size * 0.16, 2.5);
          g.fill();
        }
      }
    } else if (kind === "pine") {
      g.fillStyle = habitat.mid;
      for (let j = 0; j < 3; j += 1) {
        const w2 = size * (0.38 - j * 0.09);
        const y = base - size * (0.2 + j * 0.26);
        g.beginPath();
        g.moveTo(x - w2, y);
        g.lineTo(x, y - size * 0.36);
        g.lineTo(x + w2, y);
        g.closePath();
        g.fill();
      }
    } else if (kind === "palm") {
      g.strokeStyle = "#7a5230";
      g.lineWidth = Math.max(2, size * 0.06);
      g.beginPath();
      g.moveTo(x, base);
      g.quadraticCurveTo(x + size * 0.15, base - size * 0.5, x + size * 0.05, base - size * 0.95);
      g.stroke();
      g.fillStyle = habitat.mid;
      for (let j = 0; j < 5; j += 1) {
        const a = -Math.PI / 2 + (j - 2) * 0.6;
        g.beginPath();
        g.ellipse(x + size * 0.05 + Math.cos(a) * size * 0.22, base - size * 0.95 + Math.sin(a) * size * 0.12, size * 0.26, size * 0.06, a, 0, Math.PI * 2);
        g.fill();
      }
    } else if (kind === "coral") {
      g.strokeStyle = rand() < 0.5 ? habitat.mid : "#f08c3a";
      g.lineCap = "round";
      g.lineWidth = Math.max(3, size * 0.08);
      const branch = (bx, by, len, angle, depth) => {
        const ex = bx + Math.cos(angle) * len;
        const ey = by + Math.sin(angle) * len;
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(ex, ey);
        g.stroke();
        if (depth > 0) {
          branch(ex, ey, len * 0.7, angle - 0.45, depth - 1);
          branch(ex, ey, len * 0.7, angle + 0.45, depth - 1);
        }
      };
      branch(x, base, size * 0.32, -Math.PI / 2, 2);
    }
    g.restore();
  }

  function drawBoards(g, w, L, cam, t) {
    const y = L.skyH + 2;
    const spacing = clamp(w * 0.3, 220, 360);
    const boardW = spacing - 10;
    const first = Math.floor(cam / spacing) - 1;
    g.fillStyle = "#0b1118";
    g.fillRect(0, y - 2, w, L.boardH + 6);
    const cycle = Math.floor(Math.max(0, t) / 4000);
    for (let i = first; i < first + Math.ceil(w / spacing) + 3; i += 1) {
      const x = i * spacing - cam + 5;
      if (x > w || x + boardW < 0) continue;
      roundRect(g, x, y, boardW, L.boardH, 4);
      g.fillStyle = "#07140c";
      g.fill();
      g.strokeStyle = "rgba(214,178,94,0.8)";
      g.lineWidth = 1.5;
      g.stroke();
      const sponsor = sponsorImages.length ? sponsorImages[(((i + cycle) % sponsorImages.length) + sponsorImages.length) % sponsorImages.length] : null;
      if (sponsor && sponsor.complete && sponsor.naturalWidth) {
        const scale = Math.min((boardW - 12) / sponsor.naturalWidth, (L.boardH - 8) / sponsor.naturalHeight);
        const iw = sponsor.naturalWidth * scale;
        const ih = sponsor.naturalHeight * scale;
        g.drawImage(sponsor, x + (boardW - iw) / 2, y + (L.boardH - ih) / 2, iw, ih);
      } else {
        g.fillStyle = "#7dffa1";
        g.font = `700 ${Math.round(L.boardH * 0.42)}px "Trebuchet MS", sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        const text = i % 2 === 0 ? race.name.toUpperCase() : "OFFICIAL RACE";
        g.fillText(fitText(g, text, boardW - 16), x + boardW / 2, y + L.boardH / 2 + 1);
      }
    }
  }

  function drawField(g, w, h, L, cam, t) {
    const surface = g.createLinearGradient(0, L.fieldTop - 8, 0, h);
    surface.addColorStop(0, habitat.surface[0]);
    surface.addColorStop(1, habitat.surface[1]);
    g.fillStyle = surface;
    g.fillRect(0, L.skyH + L.boardH + 4, w, h);

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
        g.moveTo(x, y);
        g.quadraticCurveTo(x + len / 2, y - 3, x + len, y);
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
      g.fillText("FINISH", finishX, L.skyH - L.skyH * 0.35 - 10);
    }
  }

  function bodyMotion(animal, track, progress, speed, t, L) {
    const stride = (progress * L.trackLen) / Math.max(18, L.spriteH * 0.9) + track.phase;
    const moving = t > 0 && progress < 1.02;
    const calm = Math.sin(t / 380 + track.phase) * 0.5;
    if (animal === "frog") {
      const hop = moving ? Math.abs(Math.sin(stride * 0.7)) : 0;
      return { dy: -hop * L.spriteH * 0.32, rot: moving ? -0.12 * Math.cos(stride * 0.7) : 0, squash: moving ? 1 + (1 - hop) * 0.08 : 1 };
    }
    if (animal === "fish") return { dy: Math.sin(stride * 1.4) * L.spriteH * 0.05, rot: Math.sin(stride * 2.2) * 0.1, squash: 1 };
    if (animal === "turtle") return { dy: moving ? -Math.abs(Math.sin(stride * 1.6)) * L.spriteH * 0.04 : 0, rot: moving ? Math.sin(stride * 1.6) * 0.05 : 0, squash: 1 };
    if (animal === "seahorse") return { dy: Math.sin(stride * 0.9 + calm) * L.spriteH * 0.12, rot: Math.sin(stride * 0.9) * 0.08 - 0.05, squash: 1 };
    if (!moving || progress > 1.01) return { dy: 0, rot: 0, squash: 1, frame: 0 };
    const cycle = (((stride * 0.45) % 1) + 1) % 1;
    return { dy: 0, rot: 0, squash: 1, frame: 1 + Math.floor(cycle * 6) };
  }

  function drawRacers(g, w, L, cam, t, rows, follow) {
    const byLane = new Map(rows.map((row, index) => [row.track.lane, { ...row, rank: index }]));
    const labelled = new Set();
    const allLabels = L.compact ? 12 : 40;
    if (count <= allLabels) plan.tracks.forEach((track) => labelled.add(track.lane));
    else rows.slice(0, L.compact ? 5 : 10).forEach((row) => labelled.add(row.track.lane));
    if (follow != null) labelled.add(follow);

    const spriteW = (L.spriteH * SPRITE_W) / SPRITE_H;
    const crowded = (L.fieldH / count) < L.spriteH * 0.8;
    const labels = [];
    for (const track of plan.tracks) {
      const row = byLane.get(track.lane);
      const stagger = crowded && track.lane % 2 === 1 ? spriteW * 0.75 * (1 - Math.min(1, row.progress)) : 0;
      const x = L.startX + row.progress * L.trackLen - cam - spriteW * 0.92 - stagger;
      if (x < -spriteW * 1.5 || x > w + spriteW) continue;
      const y = laneY(L, track.lane);
      const speed = speedAt(track, t) * plan.durationMs;
      const motion = bodyMotion(animal, track, row.progress, speed, t, L);
      const depth = 0.86 + (track.lane / Math.max(1, count - 1)) * 0.14;
      const sw = spriteW * depth;
      const sh = L.spriteH * depth;

      g.fillStyle = "rgba(0,0,0,0.18)";
      g.beginPath();
      g.ellipse(x + sw * 0.5, y + sh * 0.36, sw * 0.34, sh * 0.09, 0, 0, Math.PI * 2);
      g.fill();

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

      g.save();
      g.translate(x + sw / 2, y + motion.dy);
      g.rotate(motion.rot);
      g.scale(1 / motion.squash, motion.squash);
      if (follow === track.lane) {
        g.shadowColor = "#fff";
        g.shadowBlur = 14;
      }
      const frames = sprites[track.lane].frames;
      g.drawImage(frames[motion.frame || 0] || frames[0], -sw / 2, -sh * 0.62, sw, sh);
      g.restore();

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
      if (labelled.has(track.lane)) labels.push({ track, x: x + sw * 0.45, y: y - sh * 0.62 + motion.dy, focus: follow === track.lane });
    }

    const size = clamp(L.spriteH * 0.32, 10, 14);
    g.font = `700 ${size}px "Trebuchet MS", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const label of labels) {
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
    const heading = status === "ready" ? "LINEUP" : t < plan.endMs ? "LIVE" : "RESULT";
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
      g.fillText("FINAL STRETCH", w / 2, L.skyH * 0.32);
      g.globalAlpha = 1;
    }

    if (t >= plan.winner.finishMs) {
      const text = `WINNER  ${plan.winner.name}`;
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
      const label = t < 0 ? String(Math.ceil(-t / 1000)) : "GO!";
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
    const L = layout(w, h);
    const rows = standings(plan, t);
    const cam = cameraX(L, w, rows, t, follow);
    g.clearRect(0, 0, w, h);
    drawSky(g, w, L, cam);
    drawBoards(g, w, L, cam, t);
    drawField(g, w, h, L, cam, t);
    drawRacers(g, w, L, cam, t, rows, follow);
    drawHud(g, w, h, L, t, rows, status);
  }

  return { plan, sprites, draw };
}
