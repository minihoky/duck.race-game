import { localeOf } from "./i18n";

export function formatWhen(ms) {
  if (!ms) return "";
  return new Intl.DateTimeFormat(localeOf(), { dateStyle: "medium", timeStyle: "short" }).format(ms);
}

export function formatExact(ms) {
  if (!ms) return "";
  return new Intl.DateTimeFormat(localeOf(), { dateStyle: "short", timeStyle: "medium" }).format(ms) + ` (${new Date(ms).toISOString()})`;
}

export function formatMoney(cents, currency = "BRL") {
  return new Intl.NumberFormat(localeOf(), { style: "currency", currency }).format((Number(cents) || 0) / 100);
}

export function formatClock(ms) {
  const clamped = Math.max(0, Number(ms) || 0);
  const total = Math.floor(clamped / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const tenths = Math.floor((clamped % 1000) / 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}
