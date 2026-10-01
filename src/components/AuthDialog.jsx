import { useState } from "react";
import { forgotPassword, login, register, resend } from "../lib/auth";
import { useT } from "../lib/i18n";
import { siteName } from "../content/site";

const inputClass = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

export default function AuthDialog({ onClose, onSignedIn }) {
  const { t } = useT();
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [notice, setNotice] = useState("");

  function fail(err) {
    setError(err.message || t("Something went wrong."));
  }

  function go(next) {
    setMode(next);
    setError("");
  }

  async function onRegister(event) {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("Those passwords do not match."));
      return;
    }
    setPending(true);
    try {
      const result = await register({ name, email, password });
      setPreviewUrl(result.previewUrl || "");
      setMode("check");
    } catch (err) {
      fail(err);
    } finally {
      setPending(false);
    }
  }

  async function onLogin(event) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const result = await login({ email, password });
      onSignedIn(result.user);
    } catch (err) {
      fail(err);
      if (err.code === "unverified") setMode("unverified");
    } finally {
      setPending(false);
    }
  }

  async function onForgot(event) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const result = await forgotPassword(email);
      setPreviewUrl(result.previewUrl || "");
      setNotice(t("If an account exists for that email, a reset link is on its way."));
      setMode("forgot-sent");
    } catch (err) {
      fail(err);
    } finally {
      setPending(false);
    }
  }

  async function onResend() {
    setError("");
    setPending(true);
    try {
      const result = await resend(email);
      setPreviewUrl(result.previewUrl || "");
      setNotice(t("If the account still needs verification, another email is on its way."));
    } catch (err) {
      fail(err);
    } finally {
      setPending(false);
    }
  }

  const title = {
    signin: t("Sign in"),
    register: t("Create account"),
    forgot: t("Reset password"),
    "forgot-sent": t("Check your email"),
    check: t("Check your email"),
    unverified: t("Verify your email"),
  }[mode];

  return (
    <div className="arena fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4">
      <button className="absolute inset-0 bg-black/70" aria-label={t("Close")} onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-[#d6b25e]/25 bg-[#121b2c] p-6 text-slate-100 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" className="text-sm text-gray-500" onClick={onClose}>
            {t("Close")}
          </button>
        </div>

        {mode === "signin" && (
          <form className="space-y-3" onSubmit={onLogin}>
            <p className="text-sm text-gray-600">{t("Sign in with the email and password of your {site} account.", { site: siteName })}</p>
            <input className={inputClass} type="email" autoComplete="email" placeholder={t("Email")} value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
            <input className={inputClass} type="password" autoComplete="current-password" placeholder={t("Password")} value={password} onChange={(event) => setPassword(event.target.value)} required />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="w-full rounded-xl bg-sky-500 py-2 font-semibold text-white disabled:opacity-60" type="submit" disabled={pending}>
              {pending ? t("Signing in…") : t("Sign in")}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" className="text-sky-600" onClick={() => go("forgot")}>
                {t("Forgot password?")}
              </button>
              <button type="button" className="text-sky-600" onClick={() => go("register")}>
                {t("Create account")}
              </button>
            </div>
          </form>
        )}

        {mode === "register" && (
          <form className="space-y-3" onSubmit={onRegister}>
            <p className="text-sm text-gray-600">{t("Create an account with your email. You will confirm the address before signing in. No identity documents are required.")}</p>
            <input className={inputClass} placeholder={t("Name")} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
            <input className={inputClass} type="email" autoComplete="email" placeholder={t("Email")} value={email} onChange={(event) => setEmail(event.target.value)} required />
            <input className={inputClass} type="password" autoComplete="new-password" placeholder={t("Password")} value={password} onChange={(event) => setPassword(event.target.value)} required />
            <input className={inputClass} type="password" autoComplete="new-password" placeholder={t("Confirm password")} value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
            <p className="text-xs text-gray-500">{t("Use 8 or more characters, with at least one letter and one number.")}</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="w-full rounded-xl bg-sky-500 py-2 font-semibold text-white disabled:opacity-60" type="submit" disabled={pending}>
              {pending ? t("Creating account…") : t("Create account")}
            </button>
            <button type="button" className="text-sm text-sky-600" onClick={() => go("signin")}>
              {t("Already have an account? Sign in")}
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <form className="space-y-3" onSubmit={onForgot}>
            <p className="text-sm text-gray-600">{t("Enter your account email and we will send a link to choose a new password.")}</p>
            <input className={inputClass} type="email" autoComplete="email" placeholder={t("Email")} value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="w-full rounded-xl bg-sky-500 py-2 font-semibold text-white disabled:opacity-60" type="submit" disabled={pending}>
              {pending ? t("Sending…") : t("Send reset link")}
            </button>
            <button type="button" className="text-sm text-sky-600" onClick={() => go("signin")}>
              {t("Back to sign in")}
            </button>
          </form>
        )}

        {(mode === "check" || mode === "unverified" || mode === "forgot-sent") && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {mode === "forgot-sent" ? notice : t("We sent a verification link to {email}. Open it to activate your account, then sign in.", { email })}
            </p>
            {notice && mode !== "forgot-sent" && <p className="text-sm text-gray-600">{notice}</p>}
            <MailPreview url={previewUrl} />
            {mode !== "forgot-sent" && (
              <button type="button" className="w-full rounded-xl border border-gray-200 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60" onClick={onResend} disabled={pending}>
                {pending ? t("Sending…") : t("Resend verification email")}
              </button>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              className="text-sm text-sky-600"
              onClick={() => {
                go("signin");
                setNotice("");
              }}
            >
              {t("Back to sign in")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MailPreview({ url }) {
  const { t } = useT();
  if (!url) return null;
  return (
    <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-medium">{t("No mail server is configured, so the message is available here.")}</p>
      <a className="mt-2 block break-all text-sky-700 underline" href={url}>
        {url}
      </a>
    </div>
  );
}
