export const siteName = import.meta.env.VITE_SITE_NAME || "ZooRacing";

// Link do botão "Entrar no grupo": abre o WhatsApp neste número.
// Para usar outro link (ex.: convite de grupo), defina VITE_GROUP_URL.
export const groupUrl = import.meta.env.VITE_GROUP_URL || "https://wa.me/5582999247882";

export const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "";

export const navItems = [
  { to: "/", label: "Home", icon: "house" },
  { to: "/race", label: "Official race", icon: "trophy" },
  { to: "/history", label: "Race history", icon: "list" },
  { to: "/verify", label: "Verify a result", icon: "shield" },
  { to: "/credits", label: "Credits", icon: "credit" },
  { to: "/dashboard", label: "My account", icon: "dashboard" },
];
