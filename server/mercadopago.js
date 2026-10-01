import { createHmac, timingSafeEqual } from "node:crypto";
import { siteName } from "./i18n.js";

const API = "https://api.mercadopago.com";

export function accessToken() {
  return String(process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
}

export function webhookSecret() {
  return String(process.env.MERCADOPAGO_WEBHOOK_SECRET || "").trim();
}

export function chargeCurrency() {
  return String(process.env.PAYMENT_CURRENCY || "BRL").trim().toUpperCase() || "BRL";
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function mpFetch(token, path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...authHeaders(token), ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text.slice(0, 300) };
    }
  }
  if (!response.ok) {
    const message = body.message || body.error || `Mercado Pago returned ${response.status}`;
    const error = new Error(typeof message === "string" ? message : "Mercado Pago rejected the request.");
    error.status = response.status;
    throw error;
  }
  return body;
}

export async function createPreference({ token, payment, origin, payerEmail }) {
  const back = `${origin}/checkout/${payment.id}`;
  const site = siteName();
  const payload = {
    items: [
      {
        id: payment.packageId,
        title: `${payment.credits} créditos ${site} (${payment.packageName})`,
        description: `Créditos de uso exclusivo no ${site}, sem conversão em dinheiro.`,
        quantity: 1,
        currency_id: payment.currency,
        unit_price: payment.amount / 100,
      },
    ],
    external_reference: payment.id,
    metadata: { payment_id: payment.id },
    notification_url: `${origin}/api/credits/webhook`,
    back_urls: { success: back, pending: back, failure: back },
  };
  if (payerEmail) payload.payer = { email: payerEmail };
  if (origin.startsWith("https://")) payload.auto_return = "approved";
  const data = await mpFetch(token, "/checkout/preferences", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const sandbox = token.startsWith("TEST-");
  const checkoutUrl = sandbox ? data.sandbox_init_point || data.init_point : data.init_point || data.sandbox_init_point;
  if (!checkoutUrl || !data.id) throw new Error("Mercado Pago did not return a checkout link.");
  return { preferenceId: data.id, checkoutUrl };
}

export async function fetchPayment(token, id) {
  return mpFetch(token, `/v1/payments/${encodeURIComponent(id)}`);
}

export async function fetchMerchantOrder(token, id) {
  return mpFetch(token, `/merchant_orders/${encodeURIComponent(id)}`);
}

export function signedDataId(url, body) {
  const fromQuery = url.searchParams.get("data.id");
  if (fromQuery) return fromQuery;
  if (body && body.data && body.data.id != null) return String(body.data.id);
  const topic = url.searchParams.get("topic") || url.searchParams.get("type") || "";
  const id = url.searchParams.get("id");
  if (id && (topic === "payment" || topic === "merchant_order")) return id;
  return "";
}

export function notificationKind(url, body) {
  return String((body && body.type) || url.searchParams.get("type") || url.searchParams.get("topic") || "").toLowerCase();
}

export function verifyWebhookSignature({ secret, signatureHeader, requestId, dataId }) {
  if (!secret) return { ok: false, error: "Mercado Pago webhook secret is not configured." };
  const parts = {};
  String(signatureHeader || "")
    .split(",")
    .forEach((part) => {
      const index = part.indexOf("=");
      if (index < 0) return;
      parts[part.slice(0, index).trim()] = part.slice(index + 1).trim();
    });
  const ts = parts.ts || "";
  const v1 = parts.v1 || "";
  if (!ts || !v1 || !dataId || !requestId) return { ok: false, error: "Mercado Pago webhook signature is missing." };
  const age = Math.abs(Date.now() - Number(ts) * 1000);
  if (!Number.isFinite(age) || age > 10 * 60 * 1000) return { ok: false, error: "Mercado Pago webhook signature expired." };
  const id = /[a-z]/i.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const actual = Buffer.from(v1);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    return { ok: false, error: "Mercado Pago webhook signature is invalid." };
  }
  return { ok: true };
}

export function assessCharge(local, remote) {
  const status = String(remote.status || "").toLowerCase();
  const mpId = remote.id == null ? "" : String(remote.id);
  const reference = String(remote.external_reference || "");
  if (!mpId || reference !== local.id) return { action: "ignore", reason: "reference" };
  const cents = Math.round(Number(remote.transaction_amount) * 100);
  const currency = String(remote.currency_id || "").toUpperCase();
  if (!Number.isFinite(cents) || cents !== local.amount || currency !== local.currency) return { action: "reject", reason: "amount" };
  if (status === "approved") return { action: "grant", mpId, status };
  if (status === "rejected" || status === "cancelled" || status === "canceled") return { action: "fail", mpId, status };
  return { action: "wait", mpId, status };
}
