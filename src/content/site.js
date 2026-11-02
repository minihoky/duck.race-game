export const siteName = import.meta.env.VITE_SITE_NAME || "ZooRacing";

// Link do botão "Entrar no grupo": convite do grupo no WhatsApp.
// Para usar outro link, defina VITE_GROUP_URL.
export const groupUrl = import.meta.env.VITE_GROUP_URL || "https://chat.whatsapp.com/KMqvFX7J3vqEmNcRldpCKQ?mode=gi_t";

export const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "";

export const navItems = [
  { to: "/", label: "Home", icon: "house" },
  { to: "/race", label: "Official race", icon: "trophy" },
  { to: "/history", label: "Race history", icon: "list" },
  { to: "/verify", label: "Verify a result", icon: "shield" },
  { to: "/credits", label: "Credits", icon: "credit" },
  { to: "/dashboard", label: "My account", icon: "dashboard" },
];
