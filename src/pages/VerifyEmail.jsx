import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { verifyEmail } from "../lib/auth";
import { useT } from "../lib/i18n";
import { usePageTitle } from "../lib/usePageTitle";

export default function VerifyEmail() {
  const { t } = useT();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState(token ? "working" : "missing");
  const [error, setError] = useState("");
  usePageTitle(t("Verify email"));

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    verifyEmail(token)
      .then(() => {
        if (!cancel) setStatus("done");
      })
      .catch((err) => {
        if (!cancel) {
          setStatus("error");
          setError(err.message);
        }
      });
    return () => {
      cancel = true;
    };
  }, [token]);

  return (
    <AuthPage title={t("Verify email")}>
      {status === "working" && <p className="text-sm text-gray-600">{t("Confirming your email…")}</p>}
      {status === "done" && (
        <>
          <p className="text-sm text-gray-600">{t("Your email is verified. You can sign in now.")}</p>
          <button type="button" className="mt-4 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white" onClick={openSignIn}>
            {t("Sign in")}
          </button>
        </>
      )}
      {status === "missing" && <p className="text-sm text-gray-600">{t("This page needs the link from your verification email.")}</p>}
      {status === "error" && <p className="text-sm text-red-600">{error}</p>}
    </AuthPage>
  );
}

export function openSignIn() {
  window.dispatchEvent(new Event("duck-open-signin"));
}

export function AuthPage({ title, children }) {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-24">
      <div className="w-full rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <h1 className="mb-3 text-2xl font-bold text-gray-900">{title}</h1>
        {children}
      </div>
    </section>
  );
}
