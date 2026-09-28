import { Link, useSearchParams } from "react-router-dom";
import { loadJson } from "../lib/storage";
import { FeatureGrid, RelatedTools } from "../components/Marketing";
import { Icon, icons } from "../components/Icons";
import { usePageTitle } from "../lib/usePageTitle";

const steps = [
  { title: "Set Up Ducks", text: "Add names or set the number of participants for your race" },
  { title: "Set Race Time", text: "Choose how long you want the duck race to last" },
  { title: "Start Racing", text: "Press start and watch the ducks compete!" },
  { title: "View Results", text: "See the winner and full race leaderboard" },
];

const searches = [
  "duck race game",
  "classroom race game",
  "online duck competition",
  "virtual racing game",
  "fun classroom activity",
  "what is a duck race",
];

export default function Home() {
  usePageTitle("Online Duck Race Name Picker - Free Duck Racing Game");
  const [params] = useSearchParams();
  const room = loadJson("duck-race-rooms", []).find((item) => item.id === params.get("room"));

  return (
    <div>
      {room && (
        <div className="border-b border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <span className="font-semibold">{room.title}:</span> {room.names.join(", ")}
        </div>
      )}
      <div id="game" className="relative p-1 md:p-4" style={{ height: "100dvh" }}>
        <iframe
          title="duck race timers game"
          src="/game/index.html"
          className="h-full w-full rounded-xl border border-gray-100 bg-sky-50"
        />
      </div>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mx-auto mb-16 max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2">
              <span className="text-xl">🦆</span>
              <span className="text-sm font-medium text-sky-500">The #1 Name Picker Game</span>
            </div>
            <h1 className="mb-6 text-4xl font-bold leading-tight text-gray-900 md:text-6xl">
              Free Duck Race
              <span className="block text-sky-500">Name Picker</span>
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-gray-600 md:text-xl">
              Ready, set, quack! Join the most exciting duck racing adventure that's perfect for classrooms, parties, and fun gatherings!
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <a href="#game" className="rounded-xl bg-sky-500 px-8 py-4 text-lg font-semibold text-white hover:bg-sky-600">
                Play Now — It's Free
              </a>
              <a href="#how-to-play" className="rounded-xl bg-gray-100 px-8 py-4 text-lg font-semibold text-gray-700 hover:bg-gray-200">
                Learn More
              </a>
            </div>
          </div>
          <FeatureGrid
            items={[
              { icon: "timer", title: "Quick Setup", text: "Ready to race in under 60 seconds. No registration required." },
              { icon: "users", title: "Any Group Size", text: "Perfect for classrooms, teams, or any gathering from 2 to 100+ people." },
              { icon: "sparkles", title: "Fun & Engaging", text: "Make random selection exciting with animated duck races." },
            ]}
          />
          <div className="mt-20 text-center">
            <div className="inline-flex flex-col items-center gap-8 rounded-2xl bg-gradient-to-r from-sky-50 to-cyan-50 p-8 sm:flex-row">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500 text-white">
                  <Icon className="h-6 w-6">{icons.trophy}</Icon>
                </div>
                <div className="text-left">
                  <p className="text-lg font-semibold text-gray-900">Trusted Worldwide</p>
                  <p className="text-sm text-gray-500">by educators and teams</p>
                </div>
              </div>
              <div className="flex gap-8">
                {[
                  ["500K+", "Users"],
                  ["5M+", "Races"],
                  ["4.9★", "Rating"],
                ].map(([value, label]) => (
                  <div key={label} className="text-center">
                    <p className="text-3xl font-bold text-sky-500">{value}</p>
                    <p className="text-sm text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-to-play" className="bg-gray-50 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-16 text-center">
            <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-wider text-sky-500">Getting Started</span>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">How to Play</h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">Get started in just a few simple steps. No account needed!</p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.title} className="relative rounded-2xl bg-white p-8 text-center shadow-sm">
                <div className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-sm font-bold text-white">
                  {index + 1}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{step.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-16 text-center">
            <div className="inline-flex items-center gap-3 rounded-xl bg-sky-50 px-6 py-4 text-sky-600">
              <span className="text-2xl">💡</span>
              <p>
                <span className="font-semibold">Pro tip:</span> You can save your name lists for future races!
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-wider text-sky-500">Our Story</span>
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">About Us</h2>
          <div className="rounded-3xl bg-white p-8 shadow-sm md:p-12">
            <p className="mb-10 text-lg leading-relaxed text-gray-600 md:text-xl">
              We are a passionate team of developers dedicated to creating fun and engaging online games. Duck Race is our latest project designed to bring joy and excitement to classrooms, offices, and gatherings worldwide.
            </p>
            <div className="grid grid-cols-1 gap-6 text-left md:grid-cols-3">
              {[
                ["Modern Tech", "Built with latest web technologies"],
                ["Fun First", "Designed for engagement"],
                ["Always Improving", "Regular updates & features"],
              ].map(([title, text]) => (
                <div key={title} className="rounded-xl bg-gray-50 p-4">
                  <h4 className="font-semibold">{title}</h4>
                  <p className="text-sm text-gray-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <RelatedTools
        items={[
          { title: "Wheel of Names", text: "Need a random name picker? Try our Wheel of Names tool for fair and exciting selections in classrooms and events.", to: "/wheel-of-names" },
          { title: "Countdown Clock", text: "Need a free online countdown timer? Use our analog countdown clock with alarm sounds and fullscreen mode.", to: "/countdown-clock" },
          { title: "Random Team Generator", text: "Need to create balanced teams? Our team generator helps you divide participants into fair and random groups." },
          { title: "Random Question Picker", text: "Randomly select questions for quizzes, icebreakers, or classroom activities with our question picker tool." },
        ]}
      />

      <section className="bg-white pb-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h3 className="mb-6 text-lg font-semibold">Popular Search Terms</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {searches.map((term) => (
              <Link key={term} to="/" className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-sky-100 hover:text-sky-600">
                {term}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
