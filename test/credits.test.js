import assert from "node:assert/strict";
import test from "node:test";
import { verifyChain } from "../server/audit.js";
import { applyRaceStart, applyRemoteCharge, grantPayment } from "../server/platform.js";
import { emptyState } from "../server/store.js";

function setup() {
  const state = emptyState();
  const user = { id: "a".repeat(24), email: "org@example.com", credits: 0 };
  state.users.push(user);
  const payment = {
    id: "pay_0000000001",
    userId: user.id,
    packageId: "pack-10",
    packageName: "Pacote 10",
    credits: 10,
    amount: 900,
    currency: "BRL",
    status: "pending",
    gateway: "mercadopago",
    gatewayRef: "",
    createdAt: Date.now(),
  };
  state.payments.push(payment);
  return { state, user, payment };
}

test("starting a race uses exactly one credit", () => {
  const user = { credits: 2 };
  const race = { status: "ready", creditUsed: false };
  assert.deepEqual(applyRaceStart(user, race, 1000), { charged: true });
  assert.equal(user.credits, 1);
  assert.equal(race.status, "racing");
  assert.deepEqual(applyRaceStart(user, race, 2000), { charged: false });
  race.status = "finished";
  assert.deepEqual(applyRaceStart(user, race, 3000), { charged: false });
  assert.equal(user.credits, 1);
  assert.equal(race.startedAt, 1000);
});

test("starting without credits is refused", () => {
  const user = { credits: 0 };
  const race = { status: "ready", creditUsed: false };
  const outcome = applyRaceStart(user, race);
  assert.equal(outcome.status, 402);
  assert.equal(race.status, "ready");
  assert.equal(user.credits, 0);
});

test("a payment adds credits only once", () => {
  const { state, user, payment } = setup();
  assert.equal(grantPayment(state, payment, "123"), true);
  assert.equal(grantPayment(state, payment, "123"), false);
  payment.status = "pending";
  assert.equal(grantPayment(state, payment, "123"), false, "the ledger already has a topup for this payment");
  assert.equal(user.credits, 10);
  assert.equal(state.ledger.filter((entry) => entry.type === "topup").length, 1);
  assert.equal(state.audit.length, 1);
  assert.equal(verifyChain(state.audit).ok, true);
});

test("Mercado Pago approvals are idempotent and checked against the order", () => {
  const { state, user, payment } = setup();
  const remote = { id: 555, status: "approved", external_reference: payment.id, transaction_amount: 9, currency_id: "BRL" };

  assert.equal(applyRemoteCharge(state, { ...remote, status: "pending" }), true);
  assert.equal(payment.status, "pending");
  assert.equal(user.credits, 0);

  assert.equal(applyRemoteCharge(state, remote), true);
  assert.equal(applyRemoteCharge(state, remote), false);
  assert.equal(user.credits, 10);
  assert.equal(payment.gatewayRef, "555");
});

test("a different amount or currency never grants credits", () => {
  const { state, user, payment } = setup();
  applyRemoteCharge(state, { id: 1, status: "approved", external_reference: payment.id, transaction_amount: 1, currency_id: "BRL" });
  applyRemoteCharge(state, { id: 2, status: "approved", external_reference: payment.id, transaction_amount: 9, currency_id: "USD" });
  assert.equal(user.credits, 0);
  assert.equal(payment.status, "pending");
  assert.equal(payment.gatewayStatus, "amount_mismatch");
});

test("one Mercado Pago payment cannot pay two checkouts", () => {
  const { state, user, payment } = setup();
  const second = { ...payment, id: "pay_0000000002" };
  state.payments.push(second);
  applyRemoteCharge(state, { id: 9, status: "approved", external_reference: payment.id, transaction_amount: 9, currency_id: "BRL" });
  second.gatewayRef = "";
  assert.equal(applyRemoteCharge(state, { id: 9, status: "approved", external_reference: second.id, transaction_amount: 9, currency_id: "BRL" }), false);
  assert.equal(user.credits, 10);
});

test("rejected payments are marked failed", () => {
  const { state, user, payment } = setup();
  applyRemoteCharge(state, { id: 3, status: "rejected", external_reference: payment.id, transaction_amount: 9, currency_id: "BRL" });
  assert.equal(payment.status, "failed");
  assert.equal(user.credits, 0);
});
