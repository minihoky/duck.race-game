import { useEffect, useRef } from "react";

const PALETTES = [
  ["#fde047", "#fbbf24", "#fff7c2"],
  ["#38bdf8", "#7dd3fc", "#e0f2fe"],
  ["#f472b6", "#fb7185", "#ffe4ec"],
  ["#34d399", "#6ee7b7", "#d1fae5"],
  ["#a78bfa", "#c4b5fd", "#ede9fe"],
  ["#fb923c", "#fdba74", "#ffedd5"],
];

// Celebratory fireworks on a transparent canvas that fills its (positioned) parent.
// Rockets climb, burst into glittering trails, and the sparks fall away under gravity.
export default function Fireworks({ className = "" }) {
  const ref = useRef(null);

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
    let nextLaunch = 0;
    let launched = 0;
    let frame = 0;
    let last = performance.now();

    const launch = (now) => {
      const x = width * (0.12 + Math.random() * 0.76);
      const burstY = height * (0.12 + Math.random() * 0.4);
      rockets.push({
        x,
        y: height + 8,
        vx: (Math.random() - 0.5) * 30,
        vy: -Math.sqrt(2 * 520 * (height + 8 - burstY)),
        burstY,
        palette: PALETTES[launched % PALETTES.length],
        born: now,
      });
      launched += 1;
    };

    const burst = (rocket) => {
      const [main, accent, core] = rocket.palette;
      const rings = Math.random() < 0.45;
      const total = rings ? 54 : 78;
      const power = 120 + Math.random() * 90;
      for (let i = 0; i < total; i += 1) {
        const angle = (i / total) * Math.PI * 2 + (rings ? 0 : Math.random() * 0.2);
        const speed = rings ? power : power * (0.25 + Math.random() * 0.85);
        sparks.push({
          x: rocket.x,
          y: rocket.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          ttl: 1.1 + Math.random() * 0.9,
          color: i % 7 === 0 ? core : i % 3 === 0 ? accent : main,
          size: 1.2 + Math.random() * 1.6,
          twinkle: Math.random() * 6.28,
        });
      }
      // A bright flash at the centre of the burst.
      sparks.push({ x: rocket.x, y: rocket.y, vx: 0, vy: 0, life: 0, ttl: 0.28, color: core, size: 14, flash: true, twinkle: 0 });
    };

    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (now >= nextLaunch) {
        launch(now);
        // Opening salvo of three, then a steady rhythm with the occasional double.
        nextLaunch = now + (launched < 3 ? 220 : 520 + Math.random() * 520);
        if (launched > 3 && Math.random() < 0.25) launch(now);
      }

      g.setTransform(ratio, 0, 0, ratio, 0, 0);
      // Fade the previous frame instead of clearing it, which leaves glowing trails.
      g.globalCompositeOperation = "destination-out";
      g.fillStyle = "rgba(0,0,0,0.2)";
      g.fillRect(0, 0, width, height);
      g.globalCompositeOperation = "lighter";

      for (let i = rockets.length - 1; i >= 0; i -= 1) {
        const rocket = rockets[i];
        rocket.vy += 520 * dt;
        rocket.x += rocket.vx * dt;
        rocket.y += rocket.vy * dt;
        g.fillStyle = rocket.palette[2];
        g.beginPath();
        g.arc(rocket.x, rocket.y, 2, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = `${rocket.palette[0]}66`;
        g.beginPath();
        g.arc(rocket.x - rocket.vx * 0.02, rocket.y - rocket.vy * 0.02, 3.2, 0, Math.PI * 2);
        g.fill();
        if (rocket.vy >= -20 || rocket.y <= rocket.burstY) {
          burst(rocket);
          rockets.splice(i, 1);
        }
      }

      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const spark = sparks[i];
        spark.life += dt;
        if (spark.life >= spark.ttl) {
          sparks.splice(i, 1);
          continue;
        }
        const k = spark.life / spark.ttl;
        if (spark.flash) {
          const flash = g.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, spark.size * (1 + k * 3));
          flash.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - k)})`);
          flash.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = flash;
          g.beginPath();
          g.arc(spark.x, spark.y, spark.size * (1 + k * 3), 0, Math.PI * 2);
          g.fill();
          continue;
        }
        spark.vx *= 0.985;
        spark.vy = spark.vy * 0.985 + 90 * dt;
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        const glitter = 0.65 + 0.35 * Math.sin(spark.twinkle + spark.life * 28);
        g.globalAlpha = Math.max(0, (1 - k) * glitter);
        g.strokeStyle = spark.color;
        g.lineWidth = spark.size;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(spark.x, spark.y);
        g.lineTo(spark.x - spark.vx * 0.045, spark.y - spark.vy * 0.045);
        g.stroke();
        g.globalAlpha = 1;
      }
      g.globalCompositeOperation = "source-over";
    };

    frame = requestAnimationFrame((now) => {
      last = now;
      nextLaunch = now;
      tick(now);
    });

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden="true" />;
}
