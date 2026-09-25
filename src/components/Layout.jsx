import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Icon, icons } from "./Icons";
import { navItems, socials, supportEmail } from "../content/site";
import { loadJson, saveJson } from "../lib/storage";

const USER_KEY = "duck-race-user";

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(() => loadJson(USER_KEY, null));
  const [signInOpen, setSignInOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  function saveUser(next) {
    setUser(next);
    saveJson(USER_KEY, next);
    setSignInOpen(false);
  }

  return (
    <div className="flex h-screen flex-col overflow-x-hidden bg-white">
      <header className="z-40 flex h-[60px] items-center justify-between bg-white px-3 shadow-sm md:px-5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-sky-500/10 hover:text-sky-500 md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Icon className="h-5 w-5">{icons.menu}</Icon>
          </button>
          <Link to="/" className="group flex select-none items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-100 bg-white shadow-sm">
              <img src="/logo.webp" alt="Duckrace Logo" className="h-8 w-8 object-contain" />
            </div>
            <div className="hidden flex-col justify-center gap-0.5 leading-none sm:flex">
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-500">Free to Play</span>
              <span className="text-[15px] font-bold tracking-tight text-gray-800">
                Duck Race <span className="text-sky-500">Name Picker</span>
              </span>
            </div>
            <span className="text-[15px] font-bold tracking-tight text-gray-800 sm:hidden">Duck Race</span>
          </Link>
        </div>
        {user ? (
          <button
            type="button"
            className="rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-600"
            onClick={() => saveUser(null)}
          >
            {user.name}
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            onClick={() => setSignInOpen(true)}
          >
            <Icon className="h-4 w-4">{icons.login}</Icon>
            Sign in
          </button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`hidden border-r border-gray-100 md:flex md:flex-col ${collapsed ? "w-16" : "w-64"}`}
        >
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
            {navItems.map((item) => (
              <NavItem key={item.to} item={item} collapsed={collapsed} />
            ))}
          </nav>
          <div className="border-t border-gray-100 p-2">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
              onClick={() => setCollapsed((value) => !value)}
            >
              <Icon className="h-4 w-4">{icons.close}</Icon>
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </aside>

        <div className="flex flex-1 flex-col overflow-auto">
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
          <Footer />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-10 flex h-14 items-center justify-around border-t border-gray-200 bg-white md:hidden">
        <Link to="/" className="flex h-full w-full flex-col items-center justify-center text-gray-800">
          <Icon className="h-5 w-5">{icons.house}</Icon>
          <span className="mt-1 text-xs">Home</span>
        </Link>
        <button
          type="button"
          className="flex h-full w-full flex-col items-center justify-center text-gray-800"
          onClick={() => setMobileOpen(true)}
        >
          <Icon className="h-5 w-5">{icons.menu}</Icon>
          <span className="mt-1 text-xs">Menu</span>
        </button>
      </div>

      <button
        type="button"
        className="fixed bottom-20 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-purple-700 md:bottom-5"
        onClick={() => setFeedbackOpen(true)}
      >
        <Icon className="h-4 w-4">{icons.message}</Icon>
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
          <nav className="absolute bottom-0 left-0 right-0 space-y-1 rounded-t-2xl bg-white p-4">
            {navItems.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </nav>
        </div>
      )}

      {signInOpen && <SignInDialog onClose={() => setSignInOpen(false)} onSave={saveUser} />}
      {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}

function NavItem({ item, collapsed = false }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ${
          isActive ? "bg-sky-50 text-sky-500" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }`
      }
      title={item.label}
    >
      <Icon className="h-4 w-4 shrink-0">{icons[item.icon]}</Icon>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.badge && (
        <span className={`ml-auto rounded-full px-1.5 py-0.5 text-xs font-medium ${item.badgeClass}`}>{item.badge}</span>
      )}
    </NavLink>
  );
}

function Footer() {
  return (
    <footer className="border-t-2 border-gray-200 bg-white pb-16 md:pb-0">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <img src="/logo.webp" alt="Duck Race" className="h-7 w-7 object-contain" />
            <span className="text-lg font-bold text-gray-900">
              Duck Race <span className="text-sky-500">Name Picker</span>
            </span>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-gray-500">
            The ultimate free-to-play duck race name picker. Create rooms, spin wheels, and pick winners with style. Fun, fast, and fair random selections for everyone.
          </p>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-900">Quick Links</h3>
          <ul className="space-y-2.5 text-sm text-gray-500">
            <li><Link className="hover:text-sky-500" to="/">Home</Link></li>
            <li><Link className="hover:text-sky-500" to="/subscription">Pricing</Link></li>
            <li><Link className="hover:text-sky-500" to="/terms">Terms of Service</Link></li>
            <li><Link className="hover:text-sky-500" to="/privacy">Privacy Policy</Link></li>
            <li>
              <a className="inline-flex items-center gap-1.5 hover:text-sky-500" href={`mailto:${supportEmail}`}>
                <Icon className="h-3.5 w-3.5">{icons.mail}</Icon>
                Support
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-900">Connect With Us</h3>
          <div className="flex gap-2.5">
            {socials.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 items-center rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-600 hover:border-sky-500 hover:text-sky-500"
              >
                {item.label}
              </a>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-400">Follow us for updates, new features, and duck race fun!</p>
        </div>
      </div>
      <div className="border-t border-gray-100">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-gray-400 sm:flex-row">
          <p>© 2026 Duck Race Game Dot Com. All rights reserved.</p>
          <p>Made with care for the community</p>
        </div>
      </div>
    </footer>
  );
}

function SignInDialog({ onClose, onSave }) {
  const [name, setName] = useState("");

  return (
    <Modal title="Sign in" onClose={onClose}>
      <p className="mb-4 text-sm text-gray-600">
        This local copy keeps your display name on this device. It does not connect to the original Duck Race account system.
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) onSave({ name: name.trim() });
        }}
      >
        <input
          className="w-full rounded-xl border border-gray-200 px-3 py-2"
          placeholder="Your name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
        <button className="w-full rounded-xl bg-sky-500 py-2 font-semibold text-white" type="submit">
          Continue
        </button>
      </form>
    </Modal>
  );
}

function FeedbackDialog({ onClose }) {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <Modal title="Feedback" onClose={onClose}>
      {sent ? (
        <p className="text-sm text-gray-600">Saved on this device. Thank you.</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const notes = loadJson("duck-race-feedback", []);
            notes.push({ message: message.trim(), at: Date.now() });
            saveJson("duck-race-feedback", notes);
            setSent(true);
          }}
        >
          <textarea
            className="h-28 w-full rounded-xl border border-gray-200 px-3 py-2"
            placeholder="Tell us what you think"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
          />
          <button className="w-full rounded-xl bg-purple-600 py-2 font-semibold text-white" type="submit">
            Send feedback
          </button>
        </form>
      )}
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" className="text-sm text-gray-500" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
