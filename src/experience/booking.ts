import { api } from "../api";
import { session } from "./bridge";
import { originalPrices } from "../festival";
const $ = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const input = (selector: string) =>
  document.querySelector<HTMLInputElement>(selector)!;
const esc = (v: any) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const names = [
  "GENERAL ACCESS",
  "VIP",
  "FAN PIT",
  "ON STAGE",
  "EM LOUNGE",
  "TABLES STARTING",
];
const benefits: Record<string, string[]> = {
  "GENERAL ACCESS": [
    "All zones, all night",
    "Checkpoint shuttle included",
    "Food court & premium bars",
  ],
  VIP: [
    "VIP deck overlooking the stage",
    "Fast-track entry lane",
    "Premium bars & hosted seating",
  ],
  "FAN PIT": [
    "Front-of-stage pit",
    "Dedicated pit entry",
    "Inside the drop-zone radius",
  ],
  "ON STAGE": [
    "On-stage viewing platform",
    "Artist-eye view of the floor",
    "Strictly limited release",
  ],
  "EM LOUNGE": [
    "Elevated mezzanine lounge",
    "Hosted seating & bottle menu",
    "Private bar service",
  ],
  "TABLES STARTING": [
    "Hosted table for six",
    "Bottle service & concierge",
    "Best sightlines in the room",
  ],
};
export const PRICING: Record<
  string,
  { city: string; date: string; tiers: string[][] }
> = {
  mumbai: {
    city: "MUMBAI",
    date: "DATE TO BE ANNOUNCED",
    tiers: names.map((n, i) => [
      n,
      "₹" + (originalPrices.mumbai[i] / 100).toLocaleString("en-IN"),
    ]),
  },
  delhi: {
    city: "DELHI",
    date: "SAT · 31 OCTOBER 2026",
    tiers: names.map((n, i) => [
      n,
      "₹" + (originalPrices.delhi[i] / 100).toLocaleString("en-IN"),
    ]),
  },
  bangalore: {
    city: "BANGALORE",
    date: "SUN · 01 NOVEMBER 2026",
    tiers: names.map((n, i) => [
      n,
      "₹" + (originalPrices.bangalore[i] / 100).toLocaleString("en-IN"),
    ]),
  },
};
const cityKey = (city: string) =>
  /delhi/i.test(city)
    ? "delhi"
    : /bengaluru|bangalore/i.test(city)
      ? "bangalore"
      : /mumbai/i.test(city)
        ? "mumbai"
        : null;
const fmt = (n: number) =>
  "₹" + (n / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
let events: any[] = [],
  configured = false;
async function refresh() {
  const [list, config] = await Promise.all([api("/events"), api("/config")]);
  events = list;
  configured = config.payments;
  for (const event of events) {
    const key = cityKey(event.city);
    if (!key) continue;
    PRICING[key].date = new Date(event.starts_at)
      .toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
      .toUpperCase();
    PRICING[key].tiers = names.map((name) => {
      const type = event.ticket_types?.find((t: any) => t.name === name);
      return [
        name,
        type
          ? fmt(type.price)
          : PRICING[key].tiers.find((t) => t[0] === name)?.[1] ||
            "ANNOUNCING SOON",
      ];
    });
  }
}
refresh().catch(() => {});
export function setupBoxOffice(ctx: any) {
  const { State, AudioEngine, flash, buildWorld, triggerDrop, toast, rnd } =
    ctx;
  const bo = {
    city: "mumbai",
    type: null as any,
    event: null as any,
    qty: 1,
    step: 1,
    busy: false,
    ref: "",
    requestId: "",
  };
  function step(n: number) {
    bo.step = n;
    [1, 2, 3, 4].forEach((i) =>
      $("#boPane" + i).classList.toggle("on", i === n),
    );
    document
      .querySelectorAll(".bo-steps i")
      .forEach((el, i) => el.classList.toggle("on", i < n));
    if (n === 2) {
      total();
      if (session.user) {
        input("#boEmail").value = session.user.email;
        input("#boEmail").readOnly = true;
        if (!input("#boName").value)
          input("#boName").value = session.user.full_name || "";
        if (!input("#boPhone").value)
          input("#boPhone").value = session.user.phone || "";
      }
    }
    if (n === 3) {
      $("#rzpBox").style.display = "";
      $("#rzpAmt").textContent = fmt(bo.type.price * bo.qty);
      $("#rzpMsg").textContent = "";
    }
  }
  function total() {
    $("#qtyVal").textContent = String(bo.qty);
    $("#totLabel").textContent = `${bo.type.name} × ${bo.qty}`;
    $("#totVal").textContent = fmt(bo.type.price * bo.qty);
  }
  function renderBoxOffice(key: string) {
    bo.city = PRICING[key] ? key : "mumbai";
    bo.type = null;
    $("#boCity").textContent = PRICING[bo.city].city;
    $("#boDate").textContent = PRICING[bo.city].date;
    $("#boxMsg").textContent = "";
    document
      .querySelectorAll<HTMLElement>(".bo-chip")
      .forEach((c) => c.classList.toggle("on", c.dataset.bc === bo.city));
    bo.event = events.find((e) => cityKey(e.city) === bo.city);
    const types = names.map(
      (name) =>
        bo.event?.ticket_types?.find((t: any) => t.name === name) || {
          name,
          price: originalPrices[bo.city][names.indexOf(name)],
        },
    );
    $("#ticketGrid").innerHTML = types
      .map((t) => {
        const active = bo.event?.sales_open && t.sales_open && configured;
        return `<div class="tkt" data-type="${esc(t.id || "")}">${t.name === "FAN PIT" ? '<span class="tag">MOST WANTED</span>' : ""}<div class="t-name">${esc(t.name)}</div><div class="t-price">${fmt(t.price)}</div><ul>${(benefits[t.name] || []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul><button class="tkt-btn" ${active ? "" : "disabled"}>${active ? "Select" : "Sales closed"}</button></div>`;
      })
      .join("");
    step(1);
  }
  async function openBoxOffice() {
    renderBoxOffice(State.city || "mumbai");
    $("#entry").classList.add("hide");
    $("#boxOffice").classList.remove("hide");
    try {
      await refresh();
      if (bo.step === 1) renderBoxOffice(bo.city);
    } catch {
      $("#boxMsg").textContent =
        "Ticket sales are waiting for hosting configuration.";
    }
  }
  function chooseEntry(k: string) {
    if (State.phase !== "arrival") return;
    if (k === "enter") {
      $("#entry").classList.add("hide");
      $("#boxOffice").classList.add("hide");
      flash(1, 700);
      buildWorld();
    } else openBoxOffice();
  }
  $("#goEnter").addEventListener("click", () => chooseEntry("enter"));
  $("#goBox").addEventListener("click", () => chooseEntry("box"));
  $("#boxEnter").addEventListener("click", () => {
    if (State.phase === "arrival") chooseEntry("enter");
    else $("#boxOffice").classList.add("hide");
  });
  $("#boxBack").addEventListener("click", () => {
    $("#boxOffice").classList.add("hide");
    if (State.phase === "arrival") $("#entry").classList.remove("hide");
  });
  document.querySelectorAll<HTMLElement>(".bo-chip").forEach((c) =>
    c.addEventListener("click", () => {
      renderBoxOffice(c.dataset.bc!);
      AudioEngine.blip();
    }),
  );
  $("#ticketGrid").addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
      ".tkt-btn",
    );
    if (!button || button.disabled) return;
    const id = button.closest<HTMLElement>(".tkt")!.dataset.type;
    bo.type = bo.event.ticket_types.find((t: any) => t.id === id);
    bo.qty = 1;
    bo.requestId = crypto.randomUUID();
    if (!session.user) {
      location.assign(
        "/login?return=" +
          encodeURIComponent(`/?city=${bo.city}&phase=world&box=1`),
      );
      return;
    }
    step(2);
    AudioEngine.blip();
  });
  $("#qtyMinus").addEventListener("click", () => {
    bo.qty = Math.max(1, bo.qty - 1);
    total();
  });
  $("#qtyPlus").addEventListener("click", () => {
    bo.qty = Math.min(6, bo.qty + 1);
    total();
  });
  $("#boBack2").addEventListener("click", () => step(1));
  $("#boBack3r").addEventListener("click", () => step(2));
  $("#boPay").addEventListener("click", () => {
    const name = input("#boName").value.trim(),
      phone = input("#boPhone")
        .value.replace(/\D/g, "")
        .replace(/^91(?=\d{10}$)/, "")
        .replace(/^0(?=\d{10}$)/, "");
    if (name.length < 2)
      return ($("#boDetailMsg").textContent = "Please enter your full name.");
    if (!/^[6-9]\d{9}$/.test(phone))
      return ($("#boDetailMsg").textContent =
        "Please enter a valid Indian mobile number.");
    $("#boDetailMsg").textContent = "";
    step(3);
  });
  $("#rzpPay").addEventListener("click", async () => {
    if (bo.busy) return;
    const button = $("#rzpPay") as HTMLButtonElement;
    bo.busy = true;
    button.disabled = true;
    $("#rzpMsg").textContent = "Opening secure checkout…";
    let paid = false;
    try {
      if (!(window as any).Razorpay)
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => resolve();
          s.onerror = () =>
            reject(new Error("Secure checkout could not load."));
          document.head.appendChild(s);
        });
      const order = await api("/payments/order", "POST", {
        eventId: bo.event.id,
        ticketTypeId: bo.type.id,
        quantity: bo.qty,
        requestId: bo.requestId,
        name: input("#boName").value.trim(),
        phone: input("#boPhone").value,
      });
      if (order.orderId.startsWith("order_mock_")) {
        paid = true;
        $("#rzpMsg").textContent = "Confirming test payment…";
        const result = await api("/payments/verify", "POST", {
          razorpay_order_id: order.orderId,
          razorpay_payment_id:
            "pay_mock_" + Math.random().toString(36).slice(2, 12),
          razorpay_signature: "mock_signature",
        });
        bo.ref = result.bookingId;
      } else {
        await new Promise<void>((resolve, reject) => {
          const razorpay = new (window as any).Razorpay({
            key: order.keyId,
            order_id: order.orderId,
            amount: order.amount,
            currency: order.currency,
            name: "THOSE WHO KNOW THEY KNOW",
            description: `${bo.type.name} × ${bo.qty} / ${bo.event.city}`,
            prefill: {
              name: input("#boName").value,
              email: order.email,
              contact: input("#boPhone").value,
            },
            theme: { color: "#D81F26" },
            handler: async (response: any) => {
              paid = true;
              $("#rzpMsg").textContent = "Confirming your payment…";
              try {
                const result = await api("/payments/verify", "POST", response);
                bo.ref = result.bookingId;
                resolve();
              } catch (e) {
                reject(e);
              }
            },
            modal: {
              ondismiss: () => {
                if (!paid)
                  reject(
                    new Error(
                      "Checkout closed. Check your bank if payment was attempted before retrying.",
                    ),
                  );
              },
            },
          });
          razorpay.on("payment.failed", () =>
            reject(
              new Error(
                "Payment was not completed. Check your bank before trying again.",
              ),
            ),
          );
          razorpay.open();
        });
      }
      $("#bkDoneTitle").textContent = "Payment Successful — Booking Confirmed";
      $("#bkDoneMsg").textContent =
        "Your ticket purchase is confirmed. Your confirmation email is on its way. View your tickets in My Tickets.";
      $("#bkDoneId").textContent = "BOOKING ID — " + bo.ref;
      step(4);
      $("#cbId").textContent = bo.ref;
      $("#celebrate").classList.add("on");
      AudioEngine.fanfare();
      if (State.phase === "world") {
        triggerDrop();
        if (State.world.ticketCard) State.world.ticketCard.visible = true;
      }
      setTimeout(() => $("#celebrate").classList.remove("on"), 4600);
    } catch (e) {
      $("#rzpMsg").textContent = (e as Error).message;
    } finally {
      bo.busy = false;
      button.disabled = false;
    }
  });
  $("#boDone").addEventListener("click", () => {
    $("#boxOffice").classList.add("hide");
    if (State.phase === "arrival") $("#entry").classList.remove("hide");
  });
  if (new URLSearchParams(location.search).get("box") === "1") {
    const t = setInterval(() => {
      if (State.phase === "world") {
        clearInterval(t);
        openBoxOffice();
      }
    }, 400);
    setTimeout(() => clearInterval(t), 60000);
  }
  return { openBoxOffice, renderBoxOffice, chooseEntry };
}
export function setupAccount() {
  const close = () => $("#acctOv").classList.add("hide");
  $("#acctClose").addEventListener("click", close);
  $("#acctLogout").addEventListener("click", async () => {
    try {
      await api("/auth/logout", "POST", {});
    } catch {
      // The signed-out destination still opens if hosting is unavailable.
    } finally {
      session.user = null;
      close();
      location.assign("/login");
    }
  });
  return async () => {
    $("#acctOv").classList.remove("hide");
    $("#acctProfile").textContent =
      session.user?.email || "Sign in to view your tickets.";
    $("#acctBookings").textContent = "Loading…";
    try {
      const tickets = await api<any[]>("/tickets");
      $("#acctBookings").innerHTML = tickets.length
        ? tickets
            .map(
              (t) =>
                `<div style="border-bottom:1px solid var(--line);padding:10px 0"><b>${esc(t.title)} / ${esc(t.city)}</b><br>${esc(new Date(t.starts_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }))} IST<br>${esc(t.id)} · ${t.checked_in_at ? "CHECKED IN" : "CONFIRMED"}</div>`,
            )
            .join("")
        : "No confirmed tickets yet. Visit the box office when sales open.";
    } catch {
      $("#acctBookings").innerHTML = '<a href="/login">SIGN IN →</a>';
    }
  };
}
