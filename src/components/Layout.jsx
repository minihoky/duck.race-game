import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Icon, icons } from "./Icons";
import { navItems, siteName, supportEmail } from "../content/site";
import { logout, me, publishAccount } from "../lib/auth";
import { useT } from "../lib/i18n";
import AuthDialog from "./AuthDialog";

export default function Layout({ children }) {
  const { t } = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let cancel = false;
    me().then((next) => {
      if (!cancel) setUser(next);
    });
    function openSignIn() {
      setSignInOpen(true);
    }
    function onAccount(event) {
      setUser(event.detail || null);
    }
    window.addEventListener("duck-open-signin", openSignIn);
    window.addEventListener("duck-account", onAccount);
    return () => {
      cancel = true;
      window.removeEventListener("duck-open-signin", openSignIn);
      window.removeEventListener("duck-account", onAccount);
    };
  }, []);

  function signedIn(next) {
    setUser(next);
    setSignInOpen(false);
    publishAccount(next);
  }

  async function signOut() {
    await logout().catch(() => {});
    setUser(null);
    publishAccount(null);
  }

  const items = user?.role === "admin" ? [...navItems, { to: "/admin", label: "Administrator", icon: "shield" }] : navItems;

  return (
    <div className="flex h-screen overflow-hidden bg-[#070d16]">
      <aside className="relative hidden w-72 shrink-0 flex-col overflow-hidden border-r border-[#d6b25e]/20 bg-[#070d16] md:flex">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-sky-400/25 to-transparent" />
        <Brand />
        <nav className="relative flex flex-1 flex-col gap-1.5 px-4 py-3">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{t("Menu")}</p>
          {items.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>
        <div className="relative px-6 pb-6">
          <LangSwitch />
        </div>
      </aside>

      <div className="arena relative flex min-w-0 flex-1 flex-col overflow-auto">
        <div className="pointer-events-none sticky top-0 z-30 flex items-center justify-between px-3 py-3 md:justify-end md:px-5">
          <div className="pointer-events-auto flex items-center gap-2 md:hidden">
            <button type="button" className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10" onClick={() => setMobileOpen(true)} aria-label={t("Open menu")}>
              <Icon className="h-5 w-5">{icons.menu}</Icon>
            </button>
            <Brand compact />
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <span className="md:hidden">
              <LangSwitch compact />
            </span>
            <SignInButton user={user} onSignIn={() => setSignInOpen(true)} onSignOut={signOut} />
          </div>
        </div>
        {user && user.status === "restricted" && (
          <div className="mx-3 mb-2 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800 md:mx-5">
            {t("This account is restricted. You can view your history, but you cannot start races or buy credits.")}
            {user.statusNote ? ` ${user.statusNote}` : ""}
          </div>
        )}
        <main className="-mt-16 flex-1 pb-16 md:pb-0">{children}</main>
        <Footer />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-10 flex h-14 items-center justify-around border-t border-[#d6b25e]/20 bg-[#070d16] md:hidden">
        <Link to="/" className="flex h-full w-full flex-col items-center justify-center text-slate-200">
          <Icon className="h-5 w-5">{icons.house}</Icon>
          <span className="mt-1 text-xs">{t("Home")}</span>
        </Link>
        <Link to="/race" className="flex h-full w-full flex-col items-center justify-center text-slate-200">
          <Icon className="h-5 w-5">{icons.trophy}</Icon>
          <span className="mt-1 text-xs">{t("Race")}</span>
        </Link>
        <button type="button" className="flex h-full w-full flex-col items-center justify-center text-slate-200" onClick={() => setMobileOpen(true)}>
          <Icon className="h-5 w-5">{icons.menu}</Icon>
          <span className="mt-1 text-xs">{t("Menu")}</span>
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-black/40" aria-label={t("Close menu")} onClick={() => setMobileOpen(false)} />
          <nav className="absolute bottom-0 left-0 right-0 space-y-1.5 rounded-t-3xl border-t border-[#d6b25e]/30 bg-[#070d16] p-4 pb-6 shadow-2xl">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{t("Menu")}</p>
            {items.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </nav>
        </div>
      )}

      {signInOpen && (
        <AuthDialog
          onClose={() => {
            setSignInOpen(false);
            window.dispatchEvent(new Event("duck-signin-closed"));
          }}
          onSignedIn={signedIn}
        />
      )}
    </div>
  );
}

function LangSwitch({ compact = false }) {
  const { lang, setLang, t } = useT();
  return (
    <div className={`inline-flex rounded-full border border-white/15 p-0.5 text-xs font-semibold ${compact ? "" : ""}`} role="group" aria-label={t("Language")}>
      {[
        ["pt", "PT"],
        ["en", "EN"],
      ].map(([code, label]) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          className={`rounded-full px-2.5 py-1 ${lang === code ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"}`}
          aria-pressed={lang === code}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Brand({ compact = false }) {
  const { t } = useT();
  return (
    <Link to="/" className={`relative flex select-none items-center gap-3 ${compact ? "" : "px-5 pb-3 pt-6"}`}>
      <img src="/logo.svg" alt="" className={`${compact ? "h-8 w-8" : "h-11 w-11"} shrink-0 rounded-2xl shadow-lg shadow-black/30`} />
      {!compact && (
        <span className="flex flex-col justify-center leading-none">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">{t("Verifiable draws")}</span>
          <span className="mt-1 text-[15px] font-bold tracking-tight text-white">{siteName}</span>
        </span>
      )}
    </Link>
  );
}

function SignInButton({ user, onSignIn, onSignOut }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (user) {
    return (
      <div className="relative">
        <button type="button" className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md" onClick={() => setOpen((value) => !value)}>
          <Icon className="h-4 w-4">{icons.user}</Icon>
          <span className="max-w-[9rem] truncate">{user.name}</span>
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[#d6b25e]/25 bg-[#121b2c] p-3 text-sm text-slate-100 shadow-xl">
            <p className="truncate text-slate-400">{user.email}</p>
            <p className="mt-1 font-semibold text-white">{t(user.credits === 1 ? "{n} credit" : "{n} credits", { n: user.credits ?? 0 })}</p>
            <Link to="/dashboard" className="mt-2 block rounded-lg px-2 py-1.5 font-semibold hover:bg-white/10" onClick={() => setOpen(false)}>
              {t("My account")}
            </Link>
            <button
              type="button"
              className="w-full rounded-lg px-2 py-1.5 text-left font-semibold text-slate-100 hover:bg-white/10"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
            >
              {t("Sign out")}
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <button type="button" className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md" onClick={onSignIn}>
      <Icon className="h-4 w-4">{icons.user}</Icon>
      {t("Sign in")}
    </button>
  );
}

function NavItem({ item }) {
  const { t } = useT();
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      title={t(item.label)}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-2xl px-2.5 py-2 text-sm font-semibold transition ${
          isActive ? "bg-white text-slate-900 shadow-lg shadow-black/25" : "text-slate-300 hover:bg-white/10 hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isActive ? "bg-sky-500 text-white" : "bg-white/10 text-slate-300"}`}>
            <Icon className="h-4 w-4">{icons[item.icon]}</Icon>
          </span>
          <span className="truncate">{t(item.label)}</span>
        </>
      )}
    </NavLink>
  );
}

function Footer() {
  const { t } = useT();
  return (
    <footer className="border-t border-[#d6b25e]/20 bg-transparent pb-16 md:pb-0">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <img src="/logo.svg" alt="" className="h-7 w-7 rounded-lg" />
            <span className="text-lg font-bold text-white">{siteName}</span>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-slate-400">
            {t("Animal races for prize draws. The server decides each result before the start, and anyone can verify it afterwards.")}
          </p>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-200">{t("Links")}</h3>
          <ul className="space-y-2.5 text-sm text-slate-400">
            {navItems.map((item) => (
              <li key={item.to}>
                <Link className="hover:text-sky-300" to={item.to}>
                  {t(item.label)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-[#d6b25e]/15">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {siteName}
          </p>
          <p className="flex gap-3">
            <Link className="hover:text-sky-300" to="/terms">
              {t("Terms")}
            </Link>
            <Link className="hover:text-sky-300" to="/privacy">
              {t("Privacy")}
            </Link>
            {supportEmail && (
              <a className="hover:text-sky-300" href={`mailto:${supportEmail}`}>
                {t("Support")}
              </a>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
