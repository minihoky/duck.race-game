import { Link } from "react-router-dom";
import { usePageTitle } from "../lib/usePageTitle";

export default function Subscription() {
  usePageTitle("Free Duck Race Game - Pricing");

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-3 text-4xl font-bold">Unlock Premium</h1>
      <p className="mb-10 text-lg text-gray-600">
        Free to play, with a Premium upgrade for much larger races. Checkout stays on the original Duck Race site.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <Plan
          name="Free"
          detail="No registration required"
          points={["Races for groups from 2 to 100+ people", "Wheel of Names", "Countdown Clock", "Name lists saved on this device"]}
        />
        <Plan
          name="Premium"
          detail="Up to 50,000 ducks"
          points={["Much larger classrooms and events", "Saved name lists for future races", "The same fair, random duck race"]}
          highlighted
        />
      </div>
      <p className="mt-8 text-sm text-gray-500">
        Pricing and payment are handled by{" "}
        <a className="text-sky-600 underline" href="https://duckrace-game.com/subscription" target="_blank" rel="noreferrer">
          duckrace-game.com
        </a>
        . This React copy does not process payments. See the <Link className="text-sky-600 underline" to="/terms">Terms of Service</Link> for subscription rules.
      </p>
    </div>
  );
}

function Plan({ name, detail, points, highlighted }) {
  return (
    <div className={`rounded-2xl border p-6 ${highlighted ? "border-sky-400 bg-sky-50" : "border-gray-100 bg-white"}`}>
      <h2 className="text-2xl font-bold">{name}</h2>
      <p className="mb-4 text-sky-600">{detail}</p>
      <ul className="space-y-2 text-gray-700">
        {points.map((point) => (
          <li key={point}>• {point}</li>
        ))}
      </ul>
    </div>
  );
}
