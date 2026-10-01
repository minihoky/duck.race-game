import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon, icons } from "../components/Icons";
import { siteName } from "../content/site";
import { useT } from "../lib/i18n";
import { usePageTitle } from "../lib/usePageTitle";
import { ANIMALS } from "../race/art";
import { createRace } from "../race/engine";

const DEMO_NAMES = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabi", "Heitor"];
const DEMO_ORDER = Object.keys(ANIMALS);
const DEMO_MS = 9000;
const DEMO_LEAD = 2200;
const DEMO_REST = 3200;

function demoRace(round) {
  const animal = DEMO_ORDER[round % DEMO_ORDER.length];
  const lanes = DEMO_NAMES.map((_, lane) => lane);
  for (let i = lanes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  const places = new Map(lanes.map((lane, index) => [lane, index + 1]));
  let finish = DEMO_MS;
  const gaps = lanes.map(() => 90 + Math.random() * 260);
  const finishByPlace = gaps.map((gap, index) => (index === 0 ? finish : (finish += gap)));
  return {
    id: `demo-${round}-${Math.random().toString(36).slice(2, 8)}`,
    animal,
    durationMs: DEMO_MS,
    leadInMs: DEMO_LEAD,
    motionSeed: Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0"),
    names: DEMO_NAMES,
    entrants: DEMO_NAMES.map((name, lane) => ({ name, lane, place: places.get(lane), finishMs: finishByPlace[places.get(lane) - 1] })),
  };
}

function DemoRace() {
  const { t, lang } = useT();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [round, setRound] = useState(0);
  const race = useMemo(() => demoRace(round), [round]);
  const labels = useMemo(
    () => ({ finish: t("FINISH"), official: t("DEMO"), lineup: t("LINEUP"), live: t("LIVE"), result: t("RESULT"), finalStretch: t("FINAL STRETCH"), winner: t("WINNER"), go: t("GO!") }),
    [lang]
  );
  const engine = useMemo(() => createRace(race, [], labels), [race, labels]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const g = canvas.getContext("2d");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    let size = { w: 0, h: 0, ratio: 1 };
    let frame = 0;
    let visible = true;

    function resize() {
      const rect = wrap.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      size = { w: rect.width, h: rect.height, ratio };
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
    }

    function tick(now) {
      const elapsed = now - started;
      const t = reduced ? engine.plan.endMs + 1500 : elapsed - DEMO_LEAD;
      g.setTransform(size.ratio, 0, 0, size.ratio, 0, 0);
      engine.draw(g, size.w, size.h, t, { status: t > engine.plan.endMs + 600 ? "finished" : "racing" });
      if (!reduced && t > engine.plan.endMs + DEMO_REST) {
        setRound((value) => value + 1);
        return;
      }
      if (visible) frame = requestAnimationFrame(tick);
    }

    const observer = new IntersectionObserver(([entry]) => {
      const next = entry.isIntersecting;
      if (next && !visible) frame = requestAnimationFrame(tick);
      visible = next;
    });
    observer.observe(wrap);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(wrap);
    resize();
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [engine]);

  return (
    <div ref={wrapRef} className="relative h-[300px] overflow-hidden rounded-3xl border border-[#d6b25e]/30 bg-[#0c1524] shadow-2xl sm:h-[380px]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label={t("Demonstration race")} />
      <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">{t("Demo · not an official draw")}</span>
    </div>
  );
}

const FEATURES = [
  {
    icon: "shield",
    title: "Provably fair",
    text: "Before each race the server commits to a hidden seed and publishes its hash together with the list of names and race parameters. After the race, anyone can check the result.",
  },
  {
    icon: "trophy",
    title: "Five animals",
    text: "Rabbits, frogs, fish, turtles and snails, each with its own scenery. Every participant gets a unique color and accessory.",
  },
  {
    icon: "sparkles",
    title: "Made to watch live",
    text: "Tap a racer to follow it, cheer along, and follow the live commentary. The result was decided on the server before the start; the animation only shows it.",
  },
  {
    icon: "users",
    title: "Up to 200 names",
    text: "Paste a list, remove duplicates, shuffle, or number entries. Each name gets its own lane.",
  },
  {
    icon: "timer",
    title: "Replays and history",
    text: "Every finished race stays in your history with its full result, an exact replay, and a public verification page to share.",
  },
  {
    icon: "credit",
    title: "Simple credits",
    text: "Setting up is free. One credit is used only when an official race starts. Pay with PIX, card or boleto through Mercado Pago.",
  },
];

const STEPS = [
  ["Create an account", "Sign up with your email and confirm the link we send."],
  ["Buy credits", "Choose a package. One credit equals one official race."],
  ["Set up the race", "Add the names, choose the animal and the duration."],
  ["Start and share", "Run the race live and share the verification link with participants."],
];

export default function Home() {
  const { t } = useT();
  usePageTitle(t("Official animal races for prize draws"));

  return (
    <div className="pt-16">
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-1.5 text-sm font-semibold text-sky-600">
            <Icon className="h-4 w-4">{icons.shield}</Icon>
            {t("Verifiable result")}
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-white md:text-5xl">
            {t("Prize draws as an animal race")}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-gray-600">
            {t("{site} turns your list of participants into a live race. The winner is drawn on the server with a public commitment, so anyone can confirm the result was not changed.", { site: siteName })}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/race" className="rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white">
              {t("Start an official race")}
            </Link>
            <Link to="/verify" className="rounded-xl bg-gray-100 px-6 py-3 font-semibold">
              {t("Verify a result")}
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">{t("Setting up is free. One credit is used when the race starts.")}</p>
        </div>
        <DemoRace />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-center text-3xl font-bold">{t("Why use {site}", { site: siteName })}</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="rounded-2xl bg-gray-50 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500 text-white">
                <Icon className="h-5 w-5">{icons[feature.icon] || icons.sparkles}</Icon>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{t(feature.title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{t(feature.text)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-center text-3xl font-bold">{t("How it works")}</h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, text], index) => (
            <li key={title} className="relative rounded-2xl bg-gray-50 p-6">
              <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-sm font-bold text-white">{index + 1}</span>
              <h3 className="font-semibold">{t(title)}</h3>
              <p className="mt-2 text-sm text-gray-600">{t(text)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20 pt-6">
        <div className="rounded-3xl bg-gray-50 p-8 text-center">
          <h2 className="text-2xl font-bold">{t("How the draw stays honest")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-gray-600">
            {t("The order is computed from a secret server seed, the list of names, the race parameters and a seed chosen by your browser at start time. The server publishes the hash of its seed before the start and reveals the seed after the finish. Changing any name or parameter changes the published hashes.")}
          </p>
          <Link to="/verify" className="mt-6 inline-block font-semibold text-sky-600">
            {t("See how to verify a race")} →
          </Link>
        </div>
      </section>
    </div>
  );
}
