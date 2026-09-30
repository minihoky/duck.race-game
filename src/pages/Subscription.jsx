import { Link } from "react-router-dom";
import { usePageTitle } from "../lib/usePageTitle";

export default function Subscription() {
  usePageTitle("Free Duck Race Game - Pricing");

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-20">
      <h1 className="mb-3 text-4xl font-bold">Official races use credits</h1>
      <p className="mb-4 text-lg text-gray-600">
        The free name picker on the home page stays open. An official race stores its result on the server, and that result can be replayed without using another credit.
      </p>
      <ul className="mb-8 space-y-2 text-gray-700">
        <li>Setting up a race does not use a credit. One credit is used when the official race starts.</li>
        <li>Replaying a finished race does not use another credit.</li>
        <li>A package of 10 credits covers 10 official races.</li>
        <li>Credits stay inside Duck Race. They cannot be withdrawn, transferred, or refunded for cash.</li>
        <li>Each purchase opens a payment page. Credits are added after the payment is confirmed.</li>
      </ul>
      <Link to="/credits" className="inline-block rounded-xl bg-sky-500 px-5 py-3 font-semibold text-white">
        View credit packages
      </Link>
    </div>
  );
}
