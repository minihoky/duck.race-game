import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { me } from "../lib/auth";
import { formatMoney } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";

export default function Credits() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [gateway, setGateway] = useState("");
  const [user, setUser] = useState(undefined);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  usePageTitle("Credits - Duck Race");

  useEffect(() => {
    api("/api/credits/packages").then((data) => {
      setPackages(data.packages);
      setGateway(data.gateway);
    });
    me().then(setUser);
  }, []);

  async function buy(packageId) {
    if (!user) {
      window.dispatchEvent(new Event("duck-open-signin"));
      return;
    }
    setError("");
    setPending(packageId);
    try {
      const data = await api("/api/credits/checkout", { method: "POST", body: { packageId } });
      navigate(`/checkout/${data.payment.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending("");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-20">
      <h1 className="text-4xl font-bold">Credits</h1>
      <p className="mt-3 max-w-2xl text-lg text-gray-600">
        One credit is used automatically when an official race begins. Ten credits cover ten races. A saved result can be replayed without using another credit.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-gray-600">
        Credits are only for use inside Duck Race. They cannot be withdrawn, transferred, or refunded for cash.
      </p>
      {user && (
        <p className="mt-4 font-semibold">
          Your balance: {user.credits} credit{user.credits === 1 ? "" : "s"}
        </p>
      )}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {packages.map((pack) => (
          <article key={pack.id} className="flex flex-col rounded-2xl border border-gray-100 p-6">
            <h2 className="text-2xl font-bold">{pack.name}</h2>
            <p className="mt-1 text-sky-600">{pack.detail}</p>
            <p className="mt-4 text-3xl font-bold">{formatMoney(pack.amount, pack.currency)}</p>
            <button
              type="button"
              className="mt-6 rounded-xl bg-sky-500 py-2 font-semibold text-white disabled:opacity-50"
              onClick={() => buy(pack.id)}
              disabled={pending === pack.id}
            >
              {pending === pack.id ? "Starting checkout…" : user ? "Buy package" : "Sign in to buy"}
            </button>
          </article>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <p className="mt-8 text-sm text-gray-500">
        {gateway === "demo"
          ? "The live card processor is not connected yet. Checkout on this server is a test payment and does not charge a card. A payment gateway can confirm purchases through the webhook."
          : "Purchases stay pending until the payment gateway confirms them. The provider is still to be connected."}{" "}
        <Link className="text-sky-600 underline" to="/terms">
          Terms
        </Link>
      </p>
    </div>
  );
}
