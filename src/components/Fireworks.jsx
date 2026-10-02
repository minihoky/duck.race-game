import { useEffect, useRef } from "react";
import { sfx } from "../race/sound";

const PALETTES = [
  ["#ffd23f", "#ffb400", "#fff6c9"],
  ["#38bdf8", "#7dd3fc", "#e6f6ff"],
  ["#ff5fa2", "#fb7185", "#ffe3ee"],
  ["#34d399", "#86efac", "#e0fff0"],
  ["#a78bfa", "#d0bfff", "#f3edff"],
  ["#ff8a3d", "#ffc074", "#fff0dd"],
  ["#ff3b3b", "#ff8f8f", "#ffe5e5"],
];

// Colour ramp used when sparks spell out the winner's name.
const NAME_STOPS = [
  [255, 213, 74],
  [255, 159, 67],
  [255, 95, 162],
  [185, 128, 255],
  [76, 216, 255],
];

const GRAVITY = 520;
const NAME_TRAVEL = 1.35;
const NAME_HOLD = 2.5;
const NAME_FADE = 1;
const NAME_TOTAL = NAME_TRAVEL + NAME_HOLD + NAME_FADE;
const NAME_EVERY = 9.5;

function rampColor(k) {
  const scaled = Math.min(0.9999, Math.max(0, k)) * (NAME_STOPS.length - 1);
  const index = Math.floor(scaled);
  const mix = scaled - index;
  const a = NAME_STOPS[index];
  const b = NAME_STOPS[index + 1];
  return [Math.round(a[0] + (b[0] - a[0]) * mix), Math.round(a[1] + (b[1] - a[1]) * mix), Math.round(a[2] + (b[2] - a[2]) * mix)];
}

// Points of the glowing outline shape `kind` around (0, 0), unit radius.
function shapePoint(kind, i, total) {
  const a = (i / total) * Math.PI * 2;
  if (kind === "heart") {
    const x = 16 * Math.pow(Math.sin(a), 3);
    const y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
    return [x / 17, y / 17];
  }
  if (kind === "star") {
    const spike = i % 2 === 0 ? 1 : 0.42;
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(angle) * spike, Math.sin(angle) * spike];
  }
  return [Math.cos(a), Math.sin(a)];
}

// Celebratory fireworks on a transparent canvas that fills its (positioned) parent.
// Rockets climb and burst into many kinds of glittering shells; every so often a salvo
// writes the winner's name across the sky out of sparks.
export default function Fireworks({ className = "", text = "", onNameChange }) {
  const ref = useRef(null);
  const textRef = useRef(text);
  const notifyRef = useRef(onNameChange);
  textRef.current = text;
  notifyRef.current = onNameChange;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const g = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let ratio = 1;
    const fit = () => {
      const box = canvas.getBoundingClientRect();
      ratio = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, box.width);
      height = Math.max(1, box.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    };
    fit();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
    observer?.observe(canvas);

    const rockets = [];
    const sparks = [];
    let flash = 0;
    let shells = 0;
    let nextLaunch = 0;
    let frame = 0;
    let last = performance.now();
    let clock = 0;
    let nameStart = 0.7;
    let name = null;
    let nameShown = false;

    const setNameShown = (on) => {
      if (on === nameShown) return;
      nameShown = on;
      notifyRef.current?.(on);
    };

    // Where a firework sits across the sky, as a stereo position: -0.7 (far left) to 0.7 (far right).
    const panOf = (x) => Math.max(-1, Math.min(1, (x / Math.max(1, width)) * 2 - 1)) * 0.7;

    const launch = (targetX, targetY) => {
      const x = targetX ?? width * (0.08 + Math.random() * 0.84);
      const burstY = targetY ?? height * (0.1 + Math.random() * 0.45);
      const climb = Math.max(60, height + 8 - burstY);
      rockets.push({
        x,
        y: height + 8,
        vx: (Math.random() - 0.5) * 36,
        vy: -Math.sqrt(2 * GRAVITY * climb),
        burstY,
        palette: PALETTES[shells % PALETTES.length],
        kind: shells % 5,
      });
      shells += 1;
      sfx.rocket(panOf(x));
    };

    const spark = (x, y, vx, vy, ttl, color, size, extra = {}) => {
      sparks.push({ x, y, vx, vy, life: 0, ttl, color, size, twinkle: Math.random() * 6.28, drag: 0.985, ...extra });
    };

    const burst = (x, y, palette, kind, scale = 1) => {
      const [main, accent, core] = palette;
      sfx.boom(scale, kind, panOf(x));
      flash = Math.min(1, flash + 0.35 * scale);
      sparks.push({ x, y, vx: 0, vy: 0, life: 0, ttl: 0.34, color: core, size: 18 * scale, flash: true, twinkle: 0, drag: 1 });
      const power = (150 + Math.random() * 110) * scale;
      if (kind === 0) {
        // Peony: a dense, full sphere.
        for (let i = 0; i < 130; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = power * (0.15 + Math.random() * 0.9);
          spark(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1.2 + Math.random() * 1, i % 6 === 0 ? core : i % 3 === 0 ? accent : main, 1.4 + Math.random() * 1.8);
        }
      } else if (kind === 1) {
        // Double ring in two colours.
        for (let ring = 0; ring < 2; ring += 1) {
          const total = 56;
          for (let i = 0; i < total; i += 1) {
            const angle = (i / total) * Math.PI * 2 + ring * 0.05;
            const speed = power * (ring ? 0.58 : 1);
            spark(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1.5 + ring * 0.2, ring ? accent : main, 2.2 - ring * 0.4);
          }
        }
      } else if (kind === 2) {
        // Willow: slow golden sparks that hang and drip.
        for (let i = 0; i < 90; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = power * (0.3 + Math.random() * 0.6);
          spark(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 2.2 + Math.random() * 1.2, i % 4 === 0 ? core : accent, 1.4 + Math.random(), { drag: 0.965, fall: 70, trail: 0.07 });
        }
      } else if (kind === 3) {
        // Shape burst: heart or star.
        const shape = shells % 2 ? "heart" : "star";
        const total = shape === "star" ? 40 : 70;
        for (let i = 0; i < total; i += 1) {
          const [px, py] = shapePoint(shape, i, total);
          spark(x, y, px * power * 0.95, py * power * 0.95, 1.7, i % 5 === 0 ? core : main, 2.4, { drag: 0.975 });
        }
        for (let i = 0; i < 40; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = power * 0.35 * Math.random();
          spark(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1.1, accent, 1.4);
        }
      } else {
        // Crossette: each streak splits into four crackling sparks.
        for (let i = 0; i < 18; i += 1) {
          const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.2;
          const speed = power * (0.7 + Math.random() * 0.3);
          spark(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.7 + Math.random() * 0.2, main, 2.6, { split: { palette, count: 4 } });
        }
      }
    };

    const splitSpark = (parent) => {
      const [, accent, core] = parent.split.palette;
      sfx.split(panOf(parent.x));
      for (let i = 0; i < parent.split.count; i += 1) {
        const angle = (i / parent.split.count) * Math.PI * 2 + Math.PI / 4;
        spark(parent.x, parent.y, Math.cos(angle) * 85, Math.sin(angle) * 85, 0.8, i % 2 ? core : accent, 1.8);
      }
    };

    // ---- The winner's name, written in sparks ----
    const buildName = () => {
      const label = String(textRef.current || "").trim();
      if (!label) return null;
      const size = Math.max(40, Math.min(150, height * 0.2, (width * 0.84) / Math.max(3, label.length * 0.62)));
      const sheet = document.createElement("canvas");
      sheet.width = Math.ceil(width);
      sheet.height = Math.ceil(size * 1.6);
      const k = sheet.getContext("2d", { willReadFrequently: true });
      let fontSize = size;
      k.font = `800 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
      const wide = k.measureText(label).width;
      if (wide > width * 0.88) {
        fontSize *= (width * 0.88) / wide;
        k.font = `800 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
      }
      k.textAlign = "center";
      k.textBaseline = "middle";
      k.fillStyle = "#fff";
      k.fillText(label, sheet.width / 2, sheet.height / 2);
      const data = k.getImageData(0, 0, sheet.width, sheet.height).data;
      const step = Math.max(3, Math.round(fontSize / 20));
      const spots = [];
      let minX = Infinity;
      let maxX = -Infinity;
      for (let y = 0; y < sheet.height; y += step) {
        for (let x = 0; x < sheet.width; x += step) {
          if (data[(y * sheet.width + x) * 4 + 3] > 140) {
            spots.push([x, y]);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
          }
        }
      }
      if (spots.length < 6) return null;
      while (spots.length > 1100) spots.splice(Math.floor(Math.random() * spots.length), 1);
      const textY = height * 0.46;
      const offsetY = textY - sheet.height / 2;
      const seeds = [width * 0.22, width * 0.5, width * 0.78];
      const dots = spots.map(([x, y]) => {
        const seed = seeds[Math.floor(Math.random() * seeds.length)];
        const angle = Math.random() * Math.PI * 2;
        const reach = 30 + Math.random() * 90;
        return {
          tx: x,
          ty: y + offsetY,
          ox: seed + Math.cos(angle) * reach,
          oy: textY - fontSize * 0.9 + Math.sin(angle) * reach * 0.6,
          delay: Math.random() * 0.3,
          swirl: (Math.random() - 0.5) * 70,
          color: rampColor((x - minX) / Math.max(1, maxX - minX)),
          phase: Math.random() * 6.28,
          size: 1.3 + Math.random() * 1.2,
          vx: 0,
          vy: 0,
        };
      });
      return { dots, seeds, textY, fontSize, started: false, scatter: false, centre: [(minX + maxX) / 2, textY] };
    };

    const drawName = (elapsed) => {
      const show = elapsed < NAME_TOTAL - 0.4;
      setNameShown(show);
      if (!name.started) {
        name.started = true;
        sfx.shimmer();
        // Three real shells go off where the sparks gather.
        name.seeds.forEach((x, i) => burst(x, name.textY - name.fontSize * 0.9, PALETTES[(i * 2 + 1) % PALETTES.length], i === 1 ? 0 : 1, 0.9));
      }
      const fadeStart = NAME_TRAVEL + NAME_HOLD;
      const dissolving = elapsed > fadeStart;
      const fade = dissolving ? Math.max(0, 1 - (elapsed - fadeStart) / NAME_FADE) : 1;
      if (dissolving && !name.scatter) {
        name.scatter = true;
        for (const dot of name.dots) {
          const dx = dot.tx - name.centre[0];
          const dy = dot.ty - name.centre[1];
          const norm = Math.hypot(dx, dy) || 1;
          dot.vx = (dx / norm) * (30 + Math.random() * 80);
          dot.vy = (dy / norm) * (20 + Math.random() * 40) - 20 - Math.random() * 40;
        }
      }
      // A soft glow behind the lettering so it reads against whatever is underneath.
      if (!dissolving || fade > 0.1) {
        const glowIn = Math.min(1, elapsed / 0.9) * fade;
        const halo = g.createRadialGradient(name.centre[0], name.textY, 0, name.centre[0], name.textY, Math.max(width * 0.5, 120));
        halo.addColorStop(0, `rgba(255,190,90,${0.03 * glowIn})`);
        halo.addColorStop(1, "rgba(255,214,120,0)");
        g.fillStyle = halo;
        g.fillRect(0, 0, width, height);
      }
      for (const dot of name.dots) {
        let x;
        let y;
        let alpha;
        const local = elapsed - dot.delay;
        if (local < 0) continue;
        if (!dissolving) {
          const p = Math.min(1, local / NAME_TRAVEL);
          const ease = 1 - Math.pow(1 - p, 3);
          const arc = Math.sin(p * Math.PI) * dot.swirl;
          x = dot.ox + (dot.tx - dot.ox) * ease + arc;
          y = dot.oy + (dot.ty - dot.oy) * ease - Math.abs(arc) * 0.4;
          if (p >= 1) {
            x += Math.sin(elapsed * 9 + dot.phase) * 0.5;
            y += Math.cos(elapsed * 7 + dot.phase) * 0.5;
          }
          alpha = Math.min(1, local / 0.2);
        } else {
          const s = elapsed - fadeStart;
          x = dot.tx + dot.vx * s;
          y = dot.ty + dot.vy * s + 220 * s * s;
          alpha = fade;
        }
        const glint = 0.72 + 0.28 * Math.sin(elapsed * 14 + dot.phase);
        const [r, gr, b] = dot.color;
        const settled = !dissolving && elapsed - dot.delay > NAME_TRAVEL;
        const sparkle = settled && Math.sin(elapsed * 5 + dot.phase * 3) > 0.93;
        // The canvas keeps ~84% of each frame, so per-frame alphas stay small to avoid piling up into a white blob.
        g.fillStyle = `rgba(${r},${gr},${b},${0.05 * alpha * glint})`;
        g.beginPath();
        g.arc(x, y, dot.size * (sparkle ? 4.5 : 2.2), 0, Math.PI * 2);
        g.fill();
        g.fillStyle = sparkle ? `rgba(255,255,255,${0.6 * alpha})` : `rgba(${r},${gr},${b},${0.55 * alpha * glint})`;
        g.beginPath();
        g.arc(x, y, dot.size * (sparkle ? 1.6 : 0.95), 0, Math.PI * 2);
        g.fill();
      }
    };

    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;

      if (clock >= nextLaunch) {
        launch();
        // An opening salvo, then a lively rhythm with frequent doubles and triples.
        nextLaunch = clock + (shells < 6 ? 0.12 : 0.28 + Math.random() * 0.32);
        if (shells > 6) {
          if (Math.random() < 0.45) launch();
          if (Math.random() < 0.18) launch();
        }
      }

      g.setTransform(ratio, 0, 0, ratio, 0, 0);
      // Fade the previous frame instead of clearing it, which leaves long glowing trails.
      g.globalCompositeOperation = "destination-out";
      g.fillStyle = "rgba(0,0,0,0.16)";
      g.fillRect(0, 0, width, height);
      g.globalCompositeOperation = "lighter";

      if (flash > 0.01) {
        g.fillStyle = `rgba(255,236,190,${flash * 0.035})`;
        g.fillRect(0, 0, width, height);
        flash *= 0.88;
      }

      for (let i = rockets.length - 1; i >= 0; i -= 1) {
        const rocket = rockets[i];
        rocket.vy += GRAVITY * dt;
        rocket.x += rocket.vx * dt;
        rocket.y += rocket.vy * dt;
        g.fillStyle = rocket.palette[2];
        g.beginPath();
        g.arc(rocket.x, rocket.y, 2.2, 0, Math.PI * 2);
        g.fill();
        for (let tail = 1; tail <= 4; tail += 1) {
          g.fillStyle = `${rocket.palette[0]}${(70 - tail * 14).toString(16).padStart(2, "0")}`;
          g.beginPath();
          g.arc(rocket.x - rocket.vx * 0.012 * tail, rocket.y - rocket.vy * 0.012 * tail, 3 - tail * 0.3, 0, Math.PI * 2);
          g.fill();
        }
        if (rocket.vy >= -20 || rocket.y <= rocket.burstY) {
          burst(rocket.x, rocket.y, rocket.palette, rocket.kind);
          rockets.splice(i, 1);
        }
      }

      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const item = sparks[i];
        item.life += dt;
        if (item.life >= item.ttl) {
          if (item.split) splitSpark(item);
          sparks.splice(i, 1);
          continue;
        }
        const k = item.life / item.ttl;
        if (item.flash) {
          const radius = item.size * (1 + k * 3.5);
          const glow = g.createRadialGradient(item.x, item.y, 0, item.x, item.y, radius);
          glow.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - k)})`);
          glow.addColorStop(0.4, `rgba(255,224,160,${0.45 * (1 - k)})`);
          glow.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = glow;
          g.beginPath();
          g.arc(item.x, item.y, radius, 0, Math.PI * 2);
          g.fill();
          continue;
        }
        item.vx *= item.drag;
        item.vy = item.vy * item.drag + (item.fall ?? 90) * dt;
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        const glitter = 0.6 + 0.4 * Math.sin(item.twinkle + item.life * 30);
        g.globalAlpha = Math.max(0, (1 - k) * glitter);
        g.strokeStyle = item.color;
        g.lineWidth = item.size;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(item.x, item.y);
        g.lineTo(item.x - item.vx * (item.trail ?? 0.05), item.y - item.vy * (item.trail ?? 0.05));
        g.stroke();
        g.globalAlpha = 1;
      }

      // The name salvo: first after a short opening, then on a regular beat.
      if (!name && clock >= nameStart) {
        name = buildName();
        if (name) name.begun = clock;
        else nameStart = clock + NAME_EVERY;
      }
      if (name) {
        const elapsed = clock - name.begun;
        if (elapsed >= NAME_TOTAL) {
          name = null;
          setNameShown(false);
          nameStart = clock + NAME_EVERY - NAME_TOTAL;
        } else {
          drawName(elapsed);
        }
      }
      g.globalCompositeOperation = "source-over";
    };

    frame = requestAnimationFrame((now) => {
      last = now;
      tick(now);
    });

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      if (nameShown) notifyRef.current?.(false);
    };
  }, []);

  return <canvas ref={ref} className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden="true" />;
}
