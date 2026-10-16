import { useState } from "react";
import { api } from "./api";
export default function TicketTypes({
  types,
  onUpdate,
}: {
  types: any[];
  onUpdate: () => void;
}) {
  const [message, setMessage] = useState("");
  return (
    <details className="category-editor">
      <summary>Ticket category prices & inventory</summary>
      <p className="muted">
        Open the gathering and the desired categories to allow sales. Table
        inventory counts tables; each table issues six guest tickets.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          type="button"
          className="button"
          onClick={async () => {
            try {
              await Promise.all(
                types.map((t) =>
                  api(`/admin/ticket-types/${t.id}`, "PATCH", {
                    sales_open: true,
                  }),
                ),
              );
              setMessage("All categories opened for sales.");
              onUpdate();
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          OPEN ALL CATEGORIES
        </button>
        <button
          type="button"
          className="button"
          onClick={async () => {
            try {
              await Promise.all(
                types.map((t) =>
                  api(`/admin/ticket-types/${t.id}`, "PATCH", {
                    sales_open: false,
                  }),
                ),
              );
              setMessage("All categories closed for sales.");
              onUpdate();
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          CLOSE ALL CATEGORIES
        </button>
      </div>
      {types.map((t) => (
        <form
          key={t.id}
          className="category-row"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = Object.fromEntries(new FormData(e.currentTarget));
            try {
              await api(`/admin/ticket-types/${t.id}`, "PATCH", {
                price: Math.round(Number(v.price) * 100),
                capacity: Number(v.capacity),
                sales_open: v.sales_open === "on",
              });
              setMessage(t.name + " saved.");
              onUpdate();
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          <strong>{t.name}</strong>
          <label>
            Price (INR)
            <input
              name="price"
              type="number"
              min="1"
              max="100000"
              step="0.01"
              defaultValue={t.price / 100}
              required
            />
          </label>
          <label>
            Inventory (units)
            <input
              name="capacity"
              type="number"
              min="1"
              max="100000"
              defaultValue={t.capacity}
              required
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              name="sales_open"
              defaultChecked={t.sales_open}
            />{" "}
            Sales open
          </label>
          <button className="button">SAVE</button>
        </form>
      ))}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </details>
  );
}
