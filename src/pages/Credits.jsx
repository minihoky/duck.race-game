import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { me } from "../lib/auth";
import { formatMoney } from "../lib/format";
import { useT } from "../lib/i18n";
import { usePageTitle } from "../lib/usePageTitle";

export default function Credits() {
  const { t } = useT();
  const navigate = useNavigate();
  const [packages, setPackages] = useState(null);
  const [gateway, setGateway] = useState("");
  const [user, setUser] = useState(undefined);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const waitingPackage = useRef("");
  usePageTitle(t("Credits"));

  async function openPayment(packageId) {
    setError("");
    setPending(packageId);
    try {
      const data = await api("/api/credits/checkout", { method: "POST", body: { packageId } });
      navigate(`/checkout/${data.payment.id}`);
    } catch (err) {
      setError(err.message);
      setPending("");
    }
  }

  const openRef = useRef(openPayment);
  openRef.current = openPayment;

  useEffect(() => {
    api("/api/credits/packages")
      .then((data) => {
        setPackages(data.packages);
        setGateway(data.gateway);
      })
      .catch((err) => {
        setPackages([]);
        setError(err.message);
      });
    me().then(setUser);
    function onAccount(event) {
      const next = event.detail || null;
      setUser(next);
      const packageId = waitingPackage.current;
      if (next && packageId) {
        waitingPackage.current = "";
        openRef.current(packageId);
      }
    }
    function onClosed() {
      waitingPackage.current = "";
    }
    window.addEventListener("duck-account", onAccount);
    window.addEventListener("duck-signin-closed", onClosed);
    return () => {
      window.removeEventListener("duck-account", onAccount);
      window.removeEventListener("duck-signin-closed", onClosed);
    };
  }, []);

  function buy(packageId) {
    if (user === undefined) return;
    if (!user) {
      waitingPackage.current = packageId;
      window.dispatchEvent(new Event("duck-open-signin"));
      return;
    }
    openPayment(packageId);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-20">
      <h1 className="text-4xl font-bold">{t("Credits")}</h1>
      <p className="mt-3 max-w-2xl text-lg text-gray-600">
        {t("Setting up a race does not use a credit. One credit is used when that official race starts. Replaying a finished race does not use another credit. Ten credits cover ten races.")}
      </p>
      <p className="mt-3 max-w-2xl text-sm text-gray-600">{t("Credits are only for use on this platform. They cannot be withdrawn, transferred, or refunded for cash.")}</p>
      {user && <p className="mt-4 font-semibold">{t("Your balance: {n}", { n: user.credits })}</p>}
      {packages == null ? (
        <p className="mt-8 text-gray-500">{t("Loading…")}</p>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {packages.map((pack) => (
            <article key={pack.id} className="flex flex-col rounded-2xl border border-gray-100 p-6">
              <h2 className="text-2xl font-bold">{pack.name}</h2>
              <p className="mt-1 text-sky-600">{t("{n} official races", { n: pack.credits })}</p>
              <p className="mt-4 text-3xl font-bold">{formatMoney(pack.amount, pack.currency)}</p>
              <p className="text-xs text-gray-500">{t("{price} per race", { price: formatMoney(Math.round(pack.amount / pack.credits), pack.currency) })}</p>
              <button
                type="button"
                className="mt-6 rounded-xl bg-sky-500 py-2 font-semibold text-white disabled:opacity-50"
                onClick={() => buy(pack.id)}
                disabled={pending === pack.id || user === undefined || user?.status === "restricted"}
              >
                {pending === pack.id ? t("Opening payment…") : user === undefined ? t("Loading…") : user ? t("Continue to payment") : t("Sign in to pay")}
              </button>
            </article>
          ))}
        </div>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <p className="mt-8 text-sm text-gray-500">
        {gateway === "demo"
          ? t("Test mode: the live payment processor is not connected. Checkout on this server is a test payment and does not charge anything.")
          : gateway === "mercadopago"
            ? t("You pay on Mercado Pago with PIX, card or boleto. Credits are added automatically after Mercado Pago confirms the payment and this server checks that confirmation.")
            : t("The payment gateway is not configured yet.")}{" "}
        <Link className="text-sky-600 underline" to="/terms">
          {t("Terms")}
        </Link>
      </p>
    </div>
  );
}
