import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { publishAccount } from "../lib/auth";
import { formatMoney } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";

export default function Checkout() {
  const { paymentId } = useParams();
  const [payment, setPayment] = useState(null);
  const [account, setAccount] = useState(null);
  const [gateway, setGateway] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  usePageTitle("Payment - Duck Race");

  useEffect(() => {
    let stop = false;
    const clock = { id: 0 };
    async function refresh(mpPaymentId) {
      try {
        const data = mpPaymentId
          ? await api("/api/credits/sync", { method: "POST", body: { paymentId, mpPaymentId } })
          : await api(`/api/credits/payments/${paymentId}`);
        if (stop) return;
        setPayment(data.payment);
        setGateway(data.gateway);
        if (data.user) {
          setAccount(data.user);
          publishAccount(data.user);
        }
        setError("");
        if (data.payment.status === "pending" && (data.gateway === "mercadopago" || data.payment.gateway === "mercadopago")) {
          clock.id = window.setTimeout(() => refresh(mpPaymentId), 4000);
        }
      } catch (err) {
        if (stop) return;
        setError(err.message);
        if (mpPaymentId && err.status !== 400 && err.status !== 404) {
          clock.id = window.setTimeout(() => refresh(mpPaymentId), 4000);
        }
      }
    }
    const params = new URLSearchParams(window.location.search);
    refresh(params.get("payment_id") || params.get("collection_id") || "");
    return () => {
      stop = true;
      window.clearTimeout(clock.id);
    };
  }, [paymentId]);

  async function confirm() {
    setPending(true);
    setError("");
    try {
      const data = await api("/api/credits/confirm", { method: "POST", body: { paymentId } });
      setPayment(data.payment);
      setAccount(data.user);
      publishAccount(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  if (!payment && !error) return <p className="px-4 pb-16 pt-24 text-center text-slate-400">Opening the payment page…</p>;

  const price = payment ? formatMoney(payment.amount, payment.currency) : "";
  const mercado = Boolean(payment?.checkoutUrl) || gateway === "mercadopago" || payment?.gateway === "mercadopago";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-24">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Checkout</p>
      <h1 className="mt-2 text-4xl font-bold text-white">Payment</h1>
      <p className="mt-3 max-w-2xl text-slate-300">
        You are buying credits for your own official races. One credit starts one race. Credits stay in your account and cannot be withdrawn, transferred, or turned back into cash.
      </p>
      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      {payment && (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <section className="rounded-3xl border border-[#d6b25e]/25 bg-[#121b2c] p-6 sm:p-8">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Order</h2>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-2xl font-bold text-white">{payment.packageName}</p>
                <p className="mt-1 text-slate-300">{payment.credits} official races</p>
              </div>
              <p className="text-3xl font-bold text-white">{price}</p>
            </div>
            <dl className="mt-6 divide-y divide-white/10 text-sm">
              <Row label="Credits" value={String(payment.credits)} />
              <Row label="Used when" value="An official race starts" />
              <Row label="Replay" value="No extra credit" />
              <Row label="Payment" value={payment.id} />
              {account && <Row label="Account" value={account.email} />}
            </dl>
          </section>

          <section className="rounded-3xl border border-[#d6b25e]/25 bg-[#0c1524] p-6 sm:p-8">
            {payment.status === "paid" ? (
              <Paid price={price} credits={payment.credits} balance={account?.credits} />
            ) : payment.status === "failed" ? (
              <div>
                <h2 className="text-xl font-bold text-white">Payment was not completed</h2>
                <p className="mt-3 text-sm text-slate-300">No credits were added. You can choose a package and try again.</p>
                <Link to="/credits" className="mt-6 block rounded-xl bg-sky-500 py-3 text-center font-semibold text-white">
                  Back to packages
                </Link>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-white">Pay {price}</h2>
                <p className="mt-2 text-sm text-slate-300">
                  {mercado
                    ? "Mercado Pago collects the payment with PIX, card, or boleto. Credits are added on this account only after Mercado Pago confirms it."
                    : "This checkout adds the credits on this server. No card is charged while the live Mercado Pago account is not connected."}
                </p>
                {account && (
                  <p className="mt-4 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200">
                    Paying as <span className="font-semibold">{account.email}</span>
                  </p>
                )}
                {payment.checkoutUrl ? (
                  <a href={payment.checkoutUrl} className="mt-6 block rounded-xl bg-sky-500 py-3 text-center font-semibold text-white">
                    Pay {price} with Mercado Pago
                  </a>
                ) : payment.demo && gateway === "demo" ? (
                  <button type="button" className="mt-6 w-full rounded-xl bg-sky-500 py-3 font-semibold text-white disabled:opacity-50" onClick={confirm} disabled={pending}>
                    {pending ? "Processing payment…" : `Pay ${price}`}
                  </button>
                ) : (
                  <p className="mt-6 text-sm text-slate-300">Waiting for payment confirmation for {payment.id}.</p>
                )}
                <p className="mt-4 text-xs leading-5 text-slate-400">
                  The same payment cannot add credits twice. Setting up a race is free. The credit is used only when the official race starts.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="truncate text-right font-semibold text-slate-100">{value}</dd>
    </div>
  );
}

function Paid({ price, credits, balance }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-white">Payment received</h2>
      <p className="mt-3 text-sm text-slate-300">
        {price} is confirmed. {credits} credits are on your account.
        {Number.isFinite(balance) ? ` Balance: ${balance}.` : ""}
      </p>
      <Link to="/race" className="mt-6 block rounded-xl bg-sky-500 py-3 text-center font-semibold text-white">
        Start an official race
      </Link>
      <Link to="/dashboard" className="mt-3 block text-center text-sm font-semibold text-sky-300">
        View credit history
      </Link>
    </div>
  );
}
