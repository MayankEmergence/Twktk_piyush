import {
  createHash,
  createHmac,
  timingSafeEqual,
  randomBytes,
} from "node:crypto";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export function signatureValid(
  secret: string,
  body: string | Buffer,
  signature: string,
) {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(
    Buffer.from(createHmac("sha256", secret).update(body).digest("hex"), "hex"),
    Buffer.from(signature, "hex"),
  );
}
export function capturedPaymentMatches(
  payment: any,
  order: { razorpay_order_id: string; amount: number },
) {
  return (
    payment.status === "captured" &&
    payment.order_id === order.razorpay_order_id &&
    payment.amount === order.amount &&
    payment.currency === "INR"
  );
}
