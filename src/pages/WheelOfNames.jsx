import { useEffect, useMemo, useRef, useState } from "react";
import { FaqList, RelatedTools } from "../components/Marketing";
import { loadJson, saveJson } from "../lib/storage";
import { usePageTitle } from "../lib/usePageTitle";

const COLORS = ["#0ea5e9", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#6366f1"];
const DEFAULT_NAMES = ["Emily", "Brian", "Winston", "Hanna", "Gabriel", "Paul", "Eric"];
const MAX_NAMES = 50;

export default function WheelOfNames() {
  usePageTitle("Wheel of Names - Online Random Name Picker | Free & Easy to Use");
  const canvasRef = useRef(null);
  const rotationRef = useRef(0);
  const [draft, setDraft] = useState(() => loadJson("duck-race-wheel", DEFAULT_NAMES).join("\n"));
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState("");
  const [history, setHistory] = useState([]);
  const [soundOn, setSoundOn] = useState(true);
  const [removeWinner, setRemoveWinner] = useState(false);

  const names = useMemo(
    () => draft.split("\n").map((name) => name.trim()).filter(Boolean).slice(0, MAX_NAMES),
    [draft]
  );

  useEffect(() => {
    saveJson("duck-race-wheel", names.length ? names : DEFAULT_NAMES);
  }, [names]);

  useEffect(() => {
    draw(rotationRef.current);
  }, [names]);

  useEffect(() => {
    function onKey(event) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        spin();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function draw(rotation) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    const cx = size / 2;
    const radius = size / 2 - 8;
    ctx.clearRect(0, 0, size, size);
    const count = Math.max(names.length, 1);
    const slice = (Math.PI * 2) / count;
    const labels = names.length ? names : ["Add names"];
    labels.forEach((name, index) => {
      const start = rotation + index * slice;
      ctx.beginPath();
      ctx.moveTo(cx, cx);
      ctx.arc(cx, cx, radius, start, start + slice);
      ctx.fillStyle = COLORS[index % COLORS.length];
      ctx.fill();
      ctx.save();
      ctx.translate(cx, cx);
      ctx.rotate(start + slice / 2);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px Segoe UI, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(name.slice(0, 16), radius - 16, 6);
      ctx.restore();
    });
    ctx.beginPath();
    ctx.arc(cx, cx, 28, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }

  function spin() {
    if (spinning || names.length < 2) return;
    setSpinning(true);
    setWinner("");
    if (soundOn) new Audio("/audio/tick.mp3").play().catch(() => {});
    const index = Math.floor(Math.random() * names.length);
    const slice = (Math.PI * 2) / names.length;
    const turns = 6 + Math.random() * 2;
    const target = turns * Math.PI * 2 + (Math.PI * 1.5 - (index + 0.5) * slice);
    const start = rotationRef.current;
    const delta = target - (start % (Math.PI * 2));
    const duration = 4200;
    const started = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const rotation = start + delta * eased;
      rotationRef.current = rotation;
      draw(rotation);
      if (t < 1) {
        requestAnimationFrame(frame);
        return;
      }
      const picked = names[index];
      setWinner(picked);
      setHistory((items) => [picked, ...items].slice(0, 12));
      setSpinning(false);
      if (soundOn) new Audio("/audio/cheer.mp3").play().catch(() => {});
      if (removeWinner) {
        const next = names.filter((name) => name !== picked);
        setDraft(next.join("\n"));
      }
    }
    requestAnimationFrame(frame);
  }

  return (
    <div>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-sky-50 p-6 text-center">
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 text-3xl text-sky-600">▼</div>
            <canvas ref={canvasRef} width={460} height={460} className="mx-auto h-auto w-full" />
          </div>
          <p className="mt-3 text-sm text-gray-500">Click OR Press (Ctrl + Enter) to spin</p>
          <button
            type="button"
            onClick={spin}
            disabled={spinning || names.length < 2}
            className="mt-4 rounded-full bg-sky-500 px-8 py-3 text-lg font-bold text-white disabled:opacity-50"
          >
            Spin the Wheel!
          </button>
          {winner && <p className="mt-4 text-2xl font-bold text-sky-700">Winner: {winner}</p>}
        </div>
        <div className="rounded-3xl border border-gray-100 p-6">
          <h3 className="text-lg font-bold">Manage Names {names.length} / {MAX_NAMES}</h3>
          <p className="mb-3 text-sm text-gray-500">{names.length} name{names.length === 1 ? "" : "s"} added</p>
          <textarea
            className="h-56 w-full rounded-xl border border-gray-200 px-3 py-2"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="rounded-lg bg-gray-100 px-3 py-2 text-sm" onClick={() => setDraft("")}>
              Clear All
            </button>
            <button type="button" className="rounded-lg bg-gray-100 px-3 py-2 text-sm" onClick={() => setSoundOn((value) => !value)}>
              Sound {soundOn ? "on" : "off"}
            </button>
            <button type="button" className="rounded-lg bg-gray-100 px-3 py-2 text-sm" onClick={() => setRemoveWinner((value) => !value)}>
              Remove winner: {removeWinner ? "on" : "off"}
            </button>
          </div>
          {history.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-2 font-semibold">Winner history</h4>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
                {history.map((name, index) => (
                  <li key={`${name}-${index}`}>{name}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-4 text-4xl font-bold">Wheel of Names: Random Name Picker</h1>
          <p className="text-lg text-gray-600">
            A fun, fair, and exciting way to randomly select names for giveaways, classroom activities, team selection, and decision making!
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            ["Instant Results", "Get random selections in seconds"],
            ["Truly Random", "Fair and unbiased selection every time"],
            ["For Any Group", "Works for classrooms, teams, and events"],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl bg-gray-50 p-6">
              <h3 className="mb-2 font-semibold">{title}</h3>
              <p className="text-sm text-gray-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 text-center text-3xl font-bold">How to Use the Wheel of Names</h2>
          <p className="mb-8 text-center text-gray-600">Using our random name picker is simple and intuitive. Follow these easy steps:</p>
          <ol className="space-y-4">
            {[
              ["1. Add Names", "Enter the names of participants in the list or paste them from a spreadsheet"],
              ["2. Spin the Wheel", 'Click the "Spin" button or use the keyboard shortcut (Ctrl+Enter)'],
              ["3. Get Your Winner", "The wheel stops on a random name and announces the winner"],
              ["4. Track History", "View previous winners and continue spinning for multiple selections"],
            ].map(([title, text]) => (
              <li key={title} className="rounded-2xl bg-white p-5">
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-gray-600">{text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
            Pro Tip: You can customize the wheel by adding as many names as you need. The wheel automatically adjusts to accommodate your list!
          </p>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-3 text-center text-3xl font-bold">Powerful Features</h2>
          <p className="mb-8 text-center text-gray-600">Our Wheel of Names comes packed with features to enhance your random selection experience:</p>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Animated Spinning", "Enjoy smooth, realistic wheel animations with exciting sound effects that build anticipation"],
              ["Sound Effects", "Toggle sound on/off with satisfying audio feedback when spinning and announcing winners"],
              ["Colorful Segments", "Visually distinct colored segments make it easy to track names on the wheel"],
              ["Winner History", "Keep track of previous winners to ensure fair distribution in multiple selections"],
              ["Bulk Name Import", "Easily add multiple names at once by pasting from spreadsheets or text files"],
              ["Mobile Friendly", "Works perfectly on smartphones and tablets for on-the-go random selections"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl bg-gray-50 p-5">
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-3xl font-bold">Frequently Asked Questions</h2>
          <FaqList
            items={[
              { q: "Is the Wheel of Names truly random?", a: "Yes. Each spin chooses one name from the current list with an even chance." },
              { q: "Can I save my list of names for future use?", a: "Yes. The list is saved in this browser so you can come back to the same names." },
              { q: "How many names can I add to the wheel?", a: "You can add up to 50 names. The wheel resizes its segments to fit the list." },
              { q: "Can I remove names after they've been selected?", a: "Yes. Turn on “Remove winner” and the chosen name leaves the list after the spin." },
              { q: "Does the Wheel of Names work on mobile devices?", a: "Yes. The wheel and name list work on phones and tablets." },
              { q: "Can I customize the appearance of the wheel?", a: "Each name gets its own color, and the wheel redraws as you edit the list." },
              { q: "Is there a way to share my wheel with others?", a: "Copy the names from the list and paste them into another browser. This local copy does not publish a shared link." },
            ]}
          />
        </div>
      </section>

      <RelatedTools
        items={[
          { title: "Duck Race Game", text: "Try our exciting Duck Race game for classrooms and events. Perfect for group activities and fun competitions!", to: "/", action: "Play Duck Race" },
          { title: "Countdown Clock", text: "Free online countdown clock with analog face, digital display, alarm sounds, and fullscreen mode.", to: "/countdown-clock", action: "Open Countdown Clock" },
        ]}
      />
    </div>
  );
}
