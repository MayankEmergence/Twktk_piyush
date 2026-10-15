import { useState } from "react";
import { api } from "./api";
export default function Reconcile({
  order,
  onDone,
}: {
  order: any;
  onDone: (message: string) => void;
}) {
  const [providerId, setProviderId] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div>
      <small>Booking: {order.id}</small>
      {!order.razorpay_order_id && (
        <input
          aria-label="Razorpay order ID"
          placeholder="order_… from Razorpay receipt"
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
        />
      )}
      <button
        className="text-link"
        disabled={busy}
        style={{ display: "block", marginTop: 10 }}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/admin/payments/reconcile", "POST", {
              bookingId: order.id,
              ...(providerId ? { providerOrderId: providerId } : {}),
            });
            onDone("Payment reconciled. Tickets confirmed.");
          } catch (e) {
            onDone((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        CHECK PAYMENT ↗
      </button>
    </div>
  );
}
