import { useState } from "react";
import { api } from "./api";
export default function EventEditor({
  event,
  onSave,
}: {
  event: any;
  onSave: () => void;
}) {
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const b = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(`/admin/events/${event.id}`, "PATCH", {
        title: b.title,
        city: b.city,
        venue: b.venue,
        price: Math.round(Number(b.price) * 100),
        capacity: Number(b.capacity),
        starts_at: new Date(String(b.starts_at)).toISOString(),
      });
      setOpen(false);
      onSave();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const dt = new Date(event.starts_at);
  const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  return (
    <div>
      <button className="text-link" onClick={() => setOpen(!open)}>
        {open ? "CANCEL" : "EDIT PRICE & INVENTORY ↗"}
      </button>
      {open && (
        <form className="panel" onSubmit={save}>
          <p className="muted">
            Changes are permanently recorded. Existing bookings keep their
            original price.
          </p>
          <div className="two">
            <label>
              Event
              <input name="title" defaultValue={event.title} required />
            </label>
            <label>
              City
              <input name="city" defaultValue={event.city} required />
            </label>
          </div>
          <label>
            Venue
            <input name="venue" defaultValue={event.venue} required />
          </label>
          <label>
            Date and time (your timezone)
            <input
              type="datetime-local"
              name="starts_at"
              defaultValue={local}
              required
            />
          </label>
          <div className="two">
            <label>
              Price in INR
              <input
                type="number"
                name="price"
                min="1"
                max="100000"
                step="0.01"
                defaultValue={event.price / 100}
                required
              />
            </label>
            <label>
              Total capacity
              <input
                type="number"
                name="capacity"
                min="1"
                max="100000"
                defaultValue={event.capacity}
                required
              />
            </label>
          </div>
          {message && (
            <p className="notice" role="alert">
              {message}
            </p>
          )}
          <button className="button lime" disabled={busy}>
            SAVE CHANGES ↗
          </button>
        </form>
      )}
    </div>
  );
}
