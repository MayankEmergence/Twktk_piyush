import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  signatureValid,
  capturedPaymentMatches,
  hash,
  token,
} from "../server/security";
test("reject forged, malformed and wrong-secret Razorpay signatures", () => {
  const body = "order_123|pay_456",
    sig = createHmac("sha256", "test-secret").update(body).digest("hex");
  assert.equal(signatureValid("test-secret", body, sig), true);
  for (const value of ["", "abc", "z".repeat(64), sig.slice(0, 63)])
    assert.equal(signatureValid("test-secret", body, value), false);
  assert.equal(signatureValid("other", body, sig), false);
  assert.equal(signatureValid("test-secret", body + "tampered", sig), false);
});
test("only matching captured INR payments issue tickets", () => {
  const p = {
      status: "captured",
      order_id: "order_123",
      amount: 199900,
      currency: "INR",
    },
    o = { razorpay_order_id: "order_123", amount: 199900 };
  assert.equal(capturedPaymentMatches(p, o), true);
  for (const change of [
    { status: "authorized" },
    { status: "failed" },
    { amount: 1 },
    { currency: "USD" },
    { order_id: "order_other" },
  ])
    assert.equal(capturedPaymentMatches({ ...p, ...change }, o), false);
});
test("session tokens have 256 bits of randomness and are stored as hashes", () => {
  const a = token(),
    b = token();
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, b);
  assert.notEqual(hash(a), a);
  assert.equal(hash(a), hash(a));
});
