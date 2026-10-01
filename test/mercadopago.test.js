import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { assessCharge, signedDataId, verifyWebhookSignature } from "../server/mercadopago.js";

const secret = "test-secret";

function sign(dataId, requestId, ts = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

test("a correctly signed notification is accepted", () => {
  const check = verifyWebhookSignature({ secret, signatureHeader: sign("123", "req-1"), requestId: "req-1", dataId: "123" });
  assert.deepEqual(check, { ok: true });
});

test("wrong secret, other id, other request or old timestamp are rejected", () => {
  const header = sign("123", "req-1");
  assert.equal(verifyWebhookSignature({ secret: "other", signatureHeader: header, requestId: "req-1", dataId: "123" }).ok, false);
  assert.equal(verifyWebhookSignature({ secret, signatureHeader: header, requestId: "req-1", dataId: "124" }).ok, false);
  assert.equal(verifyWebhookSignature({ secret, signatureHeader: header, requestId: "req-2", dataId: "123" }).ok, false);
  const old = sign("123", "req-1", Math.floor(Date.now() / 1000) - 3600);
  assert.equal(verifyWebhookSignature({ secret, signatureHeader: old, requestId: "req-1", dataId: "123" }).ok, false);
  assert.equal(verifyWebhookSignature({ secret: "", signatureHeader: header, requestId: "req-1", dataId: "123" }).ok, false);
});

test("alphanumeric ids are signed in lower case", () => {
  const check = verifyWebhookSignature({ secret, signatureHeader: sign("abc", "r"), requestId: "r", dataId: "ABC" });
  assert.equal(check.ok, true);
});

test("the signed id comes from the query string first", () => {
  assert.equal(signedDataId(new URL("https://x/api/credits/webhook?data.id=77&type=payment"), { data: { id: 88 } }), "77");
  assert.equal(signedDataId(new URL("https://x/api/credits/webhook"), { data: { id: 88 } }), "88");
});

test("charges are compared with the local order", () => {
  const local = { id: "pay_1", amount: 1900, currency: "BRL" };
  assert.equal(assessCharge(local, { id: 1, status: "approved", external_reference: "pay_1", transaction_amount: 19, currency_id: "BRL" }).action, "grant");
  assert.equal(assessCharge(local, { id: 1, status: "approved", external_reference: "pay_2", transaction_amount: 19, currency_id: "BRL" }).action, "ignore");
  assert.equal(assessCharge(local, { id: 1, status: "approved", external_reference: "pay_1", transaction_amount: 18.99, currency_id: "BRL" }).action, "reject");
  assert.equal(assessCharge(local, { id: 1, status: "in_process", external_reference: "pay_1", transaction_amount: 19, currency_id: "BRL" }).action, "wait");
  assert.equal(assessCharge(local, { id: 1, status: "cancelled", external_reference: "pay_1", transaction_amount: 19, currency_id: "BRL" }).action, "fail");
});
