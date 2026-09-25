import { useEffect, useRef, useState } from "react";
import { FaqList, RelatedTools } from "../components/Marketing";
import { usePageTitle } from "../lib/usePageTitle";

const PRESETS = [
  ["5s", 5],
  ["10s", 10],
  ["15s", 15],
  ["30s", 30],
  ["45s", 45],
  ["1m", 60],
  ["5m", 300],
  ["10m", 600],
  ["15m", 900],
  ["30m", 1800],
  ["45m", 2700],
  ["60m", 3600],
];

const SOUNDS = [
  { id: "bell", label: "Bell", src: "/audio/countdown/bell.wav" },
  { id: "digital", label: "Digital Alarm", src: "/audio/countdown/digital-alarm.wav" },
  { id: "chime", label: "Chime", src: "/audio/countdown/chime.wav" },
  { id: "gentle", label: "Gentle", src: "/audio/countdown/gentle.wav" },
];

function pad(value) {
  return String(value).padStart(2, "0");
}

export default function CountdownClock() {
  usePageTitle("Countdown Clock - Free Online Countdown Timer | Duck Race");
  const panelRef = useRef(null);
  const audioRef = useRef(null);
  const [duration, setDuration] = useState(300);
  const [remaining, setRemaining] = useState(300);
  const [running, setRunning] = useState(false);
  const [soundId, setSoundId] = useState("bell");
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          setRunning(false);
          playAlarm();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, muted, loop, soundId]);

  useEffect(() => {
    function onKey(event) {
      if (event.target.matches("input, textarea, select")) return;
      if (event.code === "Space") {
        event.preventDefault();
        toggle();
      } else if (event.key.toLowerCase() === "c") {
        reset();
      } else if (event.key.toLowerCase() === "f") {
        toggleFullscreen();
      } else if (event.key.toLowerCase() === "m") {
        setMuted((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function playAlarm() {
    if (muted) return;
    const sound = SOUNDS.find((item) => item.id === soundId) || SOUNDS[0];
    const audio = audioRef.current || new Audio(sound.src);
    audio.src = sound.src;
    audio.loop = loop;
    audioRef.current = audio;
    audio.play().catch(() => {});
  }

  function stopAlarm() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }

  function applyDuration(seconds) {
    stopAlarm();
    setDuration(seconds);
    setRemaining(seconds);
    setRunning(false);
  }

  function toggle() {
    if (remaining === 0) applyDuration(duration);
    setRunning((value) => !value);
    if (running) stopAlarm();
  }

  function reset() {
    stopAlarm();
    setRemaining(duration);
    setRunning(false);
  }

  function toggleFullscreen() {
    const node = panelRef.current;
    if (!node) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else node.requestFullscreen?.();
  }

  function preview() {
    playAlarm();
  }

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const progress = duration === 0 ? 0 : remaining / duration;
  const status = remaining === 0 ? "Time's up" : running ? "Running" : "Ready";

  function editPart(part) {
    const current = part === "h" ? hours : part === "m" ? minutes : seconds;
    const next = Number(window.prompt(`Set ${part === "h" ? "hours" : part === "m" ? "minutes" : "seconds"}`, String(current)));
    if (!Number.isFinite(next) || next < 0) return;
    const nextHours = part === "h" ? next : hours;
    const nextMinutes = part === "m" ? next : minutes;
    const nextSeconds = part === "s" ? next : seconds;
    applyDuration(nextHours * 3600 + nextMinutes * 60 + nextSeconds);
  }

  return (
    <div>
      <div ref={panelRef} className="bg-sky-50 px-4 py-10">
        <div className="mx-auto flex max-w-xl flex-col items-center">
          <div className="mb-4 flex w-full justify-end">
            <button type="button" className="rounded-lg bg-white px-3 py-2 text-sm font-semibold" onClick={toggleFullscreen}>
              Fullscreen
            </button>
          </div>
          <svg viewBox="0 0 120 120" className="mb-6 h-56 w-56">
            <circle cx="60" cy="60" r="52" fill="white" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="#0ea5e9"
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress)}`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
            <line x1="60" y1="60" x2="60" y2="28" stroke="#0ea5e9" strokeWidth="3" transform={`rotate(${(1 - progress) * 360} 60 60)`} />
            <circle cx="60" cy="60" r="3" fill="#0ea5e9" />
          </svg>
          <div className="flex items-center gap-2 font-mono text-6xl font-bold text-gray-900">
            <button type="button" onClick={() => editPart("h")}>{pad(hours)}</button>
            <span>:</span>
            <button type="button" onClick={() => editPart("m")}>{pad(minutes)}</button>
            <span>:</span>
            <button type="button" onClick={() => editPart("s")}>{pad(seconds)}</button>
          </div>
          <p className="mt-3 text-lg font-semibold text-sky-700">{status}</p>
          <p className="text-sm text-gray-500">Click hours, minutes, or seconds to edit</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {PRESETS.map(([label, value]) => (
              <button key={label} type="button" className="rounded-full bg-white px-3 py-1 text-sm" onClick={() => applyDuration(value)}>
                {label}
              </button>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <button type="button" className="rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white" onClick={toggle}>
              {running ? "Pause" : "Start"}
            </button>
            <button type="button" className="rounded-xl bg-white px-6 py-3 font-semibold" onClick={reset}>
              Reset
            </button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
            <span>Alarm sound</span>
            <select className="rounded-lg border border-gray-200 bg-white px-2 py-1" value={soundId} onChange={(event) => setSoundId(event.target.value)}>
              {SOUNDS.map((sound) => (
                <option key={sound.id} value={sound.id}>{sound.label}</option>
              ))}
            </select>
            <button type="button" className="rounded-lg bg-white px-3 py-1" onClick={() => setLoop((value) => !value)}>
              Loop {loop ? "on" : "off"}
            </button>
            <button type="button" className="rounded-lg bg-white px-3 py-1" onClick={() => setMuted((value) => !value)}>
              {muted ? "Muted" : "Sound on"}
            </button>
            <button type="button" className="rounded-lg bg-white px-3 py-1" onClick={preview}>
              Preview
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-500">Shortcuts: Space start/pause · C reset · F fullscreen · M mute</p>
        </div>
      </div>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="mb-4 text-4xl font-bold">Countdown Clock: Free Online Analog Timer</h1>
        <p className="text-lg text-gray-600">
          A modern countdown clock with a clear analog face and large digital display. Set any duration, start the timer, go fullscreen, and get an audio alert when time is up — free for classrooms, meetings, exams, workouts, and presentations.
        </p>
        <div className="mt-10 grid gap-4 text-left md:grid-cols-3">
          {[
            ["Visual & simple", "Watch remaining time on both a clock face and a precise HH:MM:SS readout."],
            ["Built for focus", "Fullscreen mode and keyboard shortcuts keep the timer easy to run live."],
            ["Free forever", "No login, no paywall, and no account required. Open the page and start timing."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl bg-gray-50 p-5">
              <h2 className="mb-2 font-semibold">{title}</h2>
              <p className="text-sm text-gray-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-3 text-center text-3xl font-bold">How to Use the Countdown Clock</h2>
          <p className="mb-8 text-center text-gray-600">Get a reliable online countdown timer running in seconds. No downloads and no signup.</p>
          <ol className="space-y-4">
            {[
              ["1. Set the duration", "Choose hours, minutes, and seconds, or tap a quick preset like 5m, 10m, or 30m."],
              ["2. Pick an alarm sound", "Select Bell, Digital Alarm, Chime, or Gentle. Preview the sound and choose a loop mode."],
              ["3. Start the countdown", "Press Start or hit Space. Pause anytime, then resume without losing remaining time."],
              ["4. Go fullscreen if needed", "Use Fullscreen or press F to display a clean timer for projectors and classrooms."],
              ["5. Reset and repeat", "Press Reset or C to clear the timer back to your set duration and run it again."],
            ].map(([title, text]) => (
              <li key={title} className="rounded-2xl bg-white p-5">
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-gray-600">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-3xl font-bold">Countdown Clock FAQ</h2>
          <FaqList
            items={[
              { q: "Is the Countdown Clock free to use?", a: "Yes. There is no login and no paywall." },
              { q: "Does the timer play sound when time is up?", a: "Yes. Choose Bell, Digital Alarm, Chime, or Gentle, then preview it before you start." },
              { q: "Can I display the countdown in fullscreen?", a: "Yes. Use the Fullscreen button or press F." },
              { q: "What keyboard shortcuts are available?", a: "Space starts or pauses, C resets, F toggles fullscreen, and M mutes the alarm." },
              { q: "How accurate is the online countdown timer?", a: "It counts down one second at a time in the browser." },
              { q: "Does it work on phones and tablets?", a: "Yes. The clock, presets, and alarm work on phones, tablets, and desktops." },
              { q: "Can I set custom hours, minutes, and seconds?", a: "Yes. Click the hours, minutes, or seconds, or pick a preset." },
            ]}
          />
        </div>
      </section>

      <RelatedTools
        items={[
          { title: "Duck Race Game", text: "Pick random names with a fun duck race timer. Great for classrooms, parties, and team activities.", to: "/" },
          { title: "Wheel of Names", text: "Spin a colorful wheel to choose a random name for raffles, giveaways, and classroom selection.", to: "/wheel-of-names" },
        ]}
      />
    </div>
  );
}
