import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { publishAccount } from "../lib/auth";
import { formatMoney } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";

export default function Checkout() {
  const { paymentId } = useParams();
  const [payment, setPayment] = useState(null);
  const [gateway, setGateway] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  usePageTitle("Checkout - Duck Race");

  async function load() {
    try {
      const data = await api(`/api/credits/payments/${paymentId}`);
      setPayment(data.payment);
      setGateway(data.gateway);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [paymentId]);

  async function confirm() {
    setPending(true);
    setError("");
    try {
      const data = await api("/api/credits/confirm", { method: "POST", body: { paymentId } });
      setPayment(data.payment);
      publishAccount(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  if (!payment && !error) return <p className="px-4 pb-16 pt-24 text-center text-gray-500">Loading checkout…</p>;

  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-24">
      <h1 className="text-3xl font-bold">Checkout</h1>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {payment && (
        <div className="mt-6 rounded-2xl border border-gray-100 p-6">
          <p className="text-sm text-gray-500">Payment {payment.id}</p>
          <h2 className="mt-1 text-2xl font-bold">{payment.packageName}</h2>
          <p className="mt-2 text-gray-700">
            {payment.credits} credits · {formatMoney(payment.amount, payment.currency)}
          </p>
          <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-sky-700">{payment.status}</p>
          {payment.status === "paid" ? (
            <p className="mt-4 text-sm">Credits are on your account. They stay inside Duck Race.</p>
          ) : payment.demo && gateway === "demo" ? (
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                This is a test payment. No card is charged. The live gateway provider is still to be connected, and it will confirm the same payment record.
              </p>
              <button type="button" className="mt-4 w-full rounded-xl bg-sky-500 py-2 font-semibold text-white disabled:opacity-50" onClick={confirm} disabled={pending}>
                {pending ? "Adding credits…" : "Complete test payment"}
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-600">
              This purchase is waiting for the payment gateway. Credits are added only after the provider confirms payment {payment.id}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}