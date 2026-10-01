export const siteName = import.meta.env.VITE_SITE_NAME || "Animal Race";

export const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "";

export const navItems = [
  { to: "/", label: "Home", icon: "house" },
  { to: "/race", label: "Official race", icon: "trophy" },
  { to: "/history", label: "Race history", icon: "list" },
  { to: "/verify", label: "Verify a result", icon: "shield" },
  { to: "/credits", label: "Credits", icon: "credit" },
  { to: "/dashboard", label: "My account", icon: "dashboard" },
];
