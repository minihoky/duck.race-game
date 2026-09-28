export function formatWhen(ms) {
  if (!ms) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(ms);
}

export function formatMoney(cents, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format((Number(cents) || 0) / 100);
}

export function formatClock(ms) {
  const clamped = Math.max(0, Number(ms) || 0);
  const total = Math.floor(clamped / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const tenths = Math.floor((clamped % 1000) / 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}
