import { usePageTitle } from "../lib/usePageTitle";

export default function OfflineMode() {
  usePageTitle("Offline Mode - Duck Race Game");

  return (
    <article className="mx-auto my-8 max-w-3xl rounded-2xl border border-slate-200 bg-white px-6 py-10 sm:px-10">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-sky-500">PWA Support</p>
      <h1 className="mb-4 text-4xl font-bold">Offline Mode</h1>
      <p className="mb-8 text-lg text-gray-600">Play Duck Race anytime, anywhere — even without an internet connection.</p>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-bold">Play Duck Race Anytime, Anywhere</h2>
        <p className="leading-relaxed text-gray-600">
          Duck Race now works offline! We've implemented Progressive Web App (PWA) technology to ensure you can enjoy Duck Race even when you don't have an internet connection.
        </p>
      </section>

      <section className="mb-10">
        <h3 className="mb-3 text-xl font-semibold">How It Works</h3>
        <ul className="list-disc space-y-2 pl-5 text-gray-600">
          <li>Duck Race automatically saves essential game resources to your device</li>
          <li>When you're offline, the app uses these saved resources</li>
          <li>You'll see a notification when you're in offline mode</li>
          <li>Once you're back online, you'll automatically reconnect</li>
        </ul>
      </section>

      <section className="mb-10">
        <h3 className="mb-3 text-xl font-semibold">Benefits</h3>
        <ul className="list-disc space-y-2 pl-5 text-gray-600">
          <li>Play Duck Race without an internet connection</li>
          <li>Faster loading times for frequently used features</li>
          <li>Reduced data usage</li>
          <li>More reliable experience in areas with poor connectivity</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-bold">Installing Duck Race as an App</h2>
        <p className="mb-4 text-gray-600">For the best offline experience, you can install Duck Race as an app on your device:</p>
        <div className="grid gap-4 md:grid-cols-3">
          <InstallCard title="On Chrome (Desktop)" steps={['Click the install icon (⊕) in the address bar', 'Select "Install Duck Race"', "The app will open in its own window"]} />
          <InstallCard title="On Safari (iOS)" steps={["Tap the share button", 'Scroll down and tap "Add to Home Screen"', 'Tap "Add" in the top-right corner']} />
          <InstallCard title="On Chrome (Android)" steps={["Tap the menu button (three dots)", 'Tap "Add to Home screen"', 'Tap "Add" to confirm']} />
        </div>
      </section>

      <section className="rounded-2xl bg-sky-50 p-6">
        <h2 className="mb-3 text-2xl font-bold">Limitations in Offline Mode</h2>
        <p className="mb-3 text-gray-600">While most features work offline, there are some limitations:</p>
        <ul className="mb-4 list-disc space-y-2 pl-5 text-gray-600">
          <li>You cannot create or join online multiplayer rooms</li>
          <li>User profile and subscription information may not be up-to-date</li>
          <li>New content or updates won't be available until you reconnect</li>
        </ul>
        <p className="font-medium text-sky-700">Don't worry! The core Duck Race game works perfectly offline, so you can still enjoy racing ducks anytime!</p>
      </section>
    </article>
  );
}

function InstallCard({ title, steps }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-600">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
