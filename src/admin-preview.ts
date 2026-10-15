import { categoryNames, initialEvents, originalPrices } from "./festival";
export const isAdminPreview =
  location.pathname === "/admin-preview" &&
  ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
let events: any[] = initialEvents().map((e) => ({
  ...e,
  sales_open: true,
  ticket_types: e.ticket_types.map((t) => ({ ...t, sales_open: true })),
}));
const logs: any[] = [];
export async function previewApi(route: string, method: string, body: any) {
  if (route.startsWith("/admin/customers"))
    return { customers: [], hasMore: false };
  if (route === "/me") return { email: "Admin preview", admin: true };
  if (route === "/config")
    return {
      accounts: false,
      payments: false,
      database: false,
      email: false,
      payment_mode: "unconfigured",
    };
  if (route === "/admin" && method === "GET")
    return structuredClone({ events, orders: [], logs, mail: { pending: 0 } });
  if (method === "PATCH") {
    const id = route.split("/").pop();
    const target = route.includes("/ticket-types/")
      ? events.flatMap((e) => e.ticket_types).find((t) => t.id === id)
      : events.find((e) => e.id === id);
    if (!target) throw new Error("Preview record not found.");
    const before = structuredClone(target);
    Object.assign(target, body);
    if (route.includes("/ticket-types/") && target.name === "GENERAL ACCESS") {
      const event = events.find((e) => e.id === target.event_id);
      if (event) event.price = target.price;
    }
    if (route.includes("/events/") && body.price !== undefined)
      target.ticket_types[0].price = body.price;
    logs.unshift({
      id: logs.length + 1,
      created_at: new Date().toISOString(),
      actor: "Preview admin",
      action: "UPDATE",
      entity: route.includes("/ticket-types/") ? "ticket_types" : "events",
      record_id: id,
      before_data: before,
      after_data: structuredClone(target),
    });
    return { ok: true };
  }
  if (route === "/admin/events" && method === "POST") {
    const id = crypto.randomUUID(),
      key = /mumbai/i.test(body.city) ? "mumbai" : "delhi";
    events.push({
      ...body,
      id,
      sold: "0",
      reserved: "0",
      sales_open: false,
      ticket_types: categoryNames.map((name, i) => ({
        id: `${id}-${i}`,
        event_id: id,
        name,
        price: i === 0 ? body.price : originalPrices[key][i],
        capacity: body.capacity,
        admissions: i === 5 ? 6 : 1,
        sales_open: false,
      })),
    });
    logs.unshift({
      id: logs.length + 1,
      created_at: new Date().toISOString(),
      actor: "Preview admin",
      action: "INSERT",
      entity: "events",
      record_id: id,
    });
    return { ok: true };
  }
  throw new Error(
    "This action requires the connected live dashboard. Preview changes last only until you reload.",
  );
}
