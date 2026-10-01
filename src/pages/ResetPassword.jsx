import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { resetPassword } from "../lib/auth";
import { useT } from "../lib/i18n";
import { usePageTitle } from "../lib/usePageTitle";
import { AuthPage, openSignIn } from "./VerifyEmail";

export default function ResetPassword() {
  const { t } = useT();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  usePageTitle(t("Choose a new password"));

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("Those passwords do not match."));
      return;
    }
    setPending(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthPage title={t("Choose a new password")}>
      {!token && <p className="text-sm text-gray-600">{t("This page needs the link from your password reset email.")}</p>}
      {token && done && (
        <>
          <p className="text-sm text-gray-600">{t("Your password is updated. Sign in with the new one.")}</p>
          <button type="button" className="mt-4 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white" onClick={openSignIn}>
            {t("Sign in")}
          </button>
        </>
      )}
      {token && !done && (
        <form className="space-y-3" onSubmit={onSubmit}>
          <p className="text-sm text-gray-600">{t("Use 8 or more characters, with at least one letter and one number.")}</p>
          <input className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" type="password" autoComplete="new-password" placeholder={t("New password")} value={password} onChange={(event) => setPassword(event.target.value)} required autoFocus />
          <input className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" type="password" autoComplete="new-password" placeholder={t("Confirm password")} value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="w-full rounded-xl bg-sky-500 py-2 font-semibold text-white disabled:opacity-60" type="submit" disabled={pending}>
            {pending ? t("Saving…") : t("Update password")}
          </button>
        </form>
      )}
    </AuthPage>
  );
}
