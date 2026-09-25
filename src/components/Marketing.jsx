import { Link } from "react-router-dom";
import { Icon, icons } from "./Icons";

export function FaqList({ items }) {
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {items.map((item) => (
        <details key={item.q} className="rounded-2xl bg-white p-5 shadow-sm">
          <summary className="cursor-pointer font-semibold text-gray-900">{item.q}</summary>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

export function RelatedTools({ items }) {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-12 text-center">
          <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-wider text-sky-500">Explore More</span>
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">Related Tools & Resources</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.title} className="rounded-2xl bg-gray-50 p-6 hover:bg-sky-50">
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{item.title}</h3>
              <p className="mb-4 text-sm leading-relaxed text-gray-600">{item.text}</p>
              {item.to ? (
                <Link className="inline-flex items-center gap-2 text-sm font-medium text-sky-500" to={item.to}>
                  {item.action || "Try Now"}
                  <Icon className="h-4 w-4">{icons.arrow}</Icon>
                </Link>
              ) : (
                <span className="text-sm font-medium text-gray-400">Coming Soon</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeatureGrid({ items }) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className="rounded-2xl bg-gray-50 p-8 hover:bg-sky-50">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-sky-100 text-sky-500">
            <Icon className="h-7 w-7">{icons[item.icon] || icons.sparkles}</Icon>
          </div>
          <h3 className="mb-2 text-xl font-semibold text-gray-900">{item.title}</h3>
          <p className="text-gray-600">{item.text}</p>
        </div>
      ))}
    </div>
  );
}
