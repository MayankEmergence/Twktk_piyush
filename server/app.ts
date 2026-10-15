import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { pool, databaseReady } from "./db";
import {
  hash,
  token,
  signatureValid,
  capturedPaymentMatches,
} from "./security";
import { mailReady, sendLogin, queueMail, flushMail } from "./mail";
import ExcelJS from "exceljs";
import { addExportSheet } from "./export";
import compression from "compression";
import { validateWorldPrefs } from "./world-preferences";
import { initialEvents, categoryNames, originalPrices } from "../src/festival";
import { safeReturn, verifyGoogleToken } from "./google-auth";
import { createSession, setSessionCookie } from "./session";
import { createHash } from "node:crypto";
import { hashPassword, verifyPassword } from "./passwords";
const app = express(),
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const production = process.env.NODE_ENV === "production";
const googleReady = () =>
  Boolean(
    databaseReady() &&
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET,
  );
const origin = new URL(process.env.APP_URL || "http://localhost:5173").origin;
if (
  production &&
  (!process.env.APP_URL?.startsWith("https://") ||
    !databaseReady() ||
    !mailReady() ||
    !process.env.ADMIN_EMAILS)
)
  throw new Error(
    "Production requires HTTPS APP_URL, DATABASE_URL, SMTP settings and ADMIN_EMAILS.",
  );
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 0));
app.disable("x-powered-by");
app.use(
  compression({
    filter: (q, s) => !q.path.startsWith("/api") && compression.filter(q, s),
  }),
);
app.use(
  helmet({
    contentSecurityPolicy: production
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://checkout.razorpay.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https://*.razorpay.com"],
            connectSrc: ["'self'", "https://*.razorpay.com"],
            frameSrc: ["https://*.razorpay.com"],
            workerSrc: ["'self'", "blob:"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
          },
        }
      : false,
    referrerPolicy: { policy: "no-referrer" },
  }),
);
app.get("/healthz", (_q, s) => s.json({ ok: true }));
app.get("/sw.js", (_q, s) => {
  s.type("application/javascript")
    .set("Cache-Control", "no-store")
    .send(
      "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil(self.registration.unregister().then(()=>self.clients.claim())));",
    );
});
const payReady = () =>
  Boolean(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_WEBHOOK_SECRET,
  );
async function razorpay(method: string, route: string, body?: unknown) {
  const r = await fetch(`https://api.razorpay.com/v1${route}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("Payment provider unavailable");
  return r.json();
}
async function finalize(orderId: string, paymentId: string) {
  const payment = await razorpay("GET", `/payments/${paymentId}`),
    client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = (
      await client.query(
        "SELECT * FROM orders WHERE razorpay_order_id=$1 FOR UPDATE",
        [orderId],
      )
    ).rows[0];
    if (!order || !capturedPaymentMatches(payment, order))
      throw new Error("Payment is not captured or does not match the booking");
    if (order.status !== "paid") {
      await client.query(
        "UPDATE orders SET status='paid',payment_id=$1 WHERE id=$2",
        [paymentId, order.id],
      );
      const ids = [];
      for (let i = 0; i < order.quantity * order.admissions; i++) {
        const id = randomUUID();
        ids.push(id);
        await client.query(
          "INSERT INTO tickets(id,order_id,ordinal) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [id, order.id, i],
        );
      }
      const user = (
        await client.query("SELECT email FROM users WHERE id=$1", [
          order.user_id,
        ])
      ).rows[0];
      const event = (
        await client.query(
          "SELECT e.title,e.city,e.venue,e.starts_at,coalesce(t.name,'GENERAL ACCESS') AS category FROM events e LEFT JOIN ticket_types t ON t.id=$2 WHERE e.id=$1",
          [order.event_id, order.ticket_type_id],
        )
      ).rows[0];
      await queueMail(
        client,
        user.email,
        "Your TWKTK tickets are confirmed",
        `Your TWKTK tickets are confirmed.\n\n${event.title} / ${event.city}\n${new Date(event.starts_at).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST\nVenue: ${event.venue}\nCategory: ${event.category}\nGuest tickets: ${order.quantity * order.admissions}\nPayment confirmed: INR ${(order.amount / 100).toFixed(2)}\n\nBooking: ${order.id}\nTicket IDs: ${ids.join(", ")}\nView your tickets: ${origin}/account\nBring your ticket and photo ID. Keep these IDs private.`,
      );
    }
    await client.query("COMMIT");
    return order.id;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
app.post(
  ["/api/webhooks/razorpay", "/api/payments/webhook"],
  express.raw({ type: "application/json", limit: "64kb" }),
  async (q, s) => {
    if (!payReady()) return s.sendStatus(503);
    if (!Buffer.isBuffer(q.body)) return s.sendStatus(400);
    if (
      !signatureValid(
        process.env.RAZORPAY_WEBHOOK_SECRET!,
        q.body,
        q.get("X-Razorpay-Signature") || "",
      )
    )
      return s.sendStatus(400);
    const ev = JSON.parse(q.body.toString());
    if (["payment.captured", "order.paid"].includes(ev.event)) {
      const p = ev.payload?.payment?.entity;
      if (p?.id && p?.order_id) await finalize(p.order_id, p.id);
    }
    s.sendStatus(200);
  },
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "16kb" }));
app.use("/api", (q, s, next) => {
  s.set("Cache-Control", "no-store");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(q.method) &&
    q.get("Origin") !== origin
  )
    return s.status(403).json({ error: "Request origin rejected" });
  next();
});
app.get("/api/config", (_q, s) =>
  s.json({
    accounts: databaseReady() && mailReady(),
    google: googleReady(),
    payments: payReady(),
    database: databaseReady(),
    email: mailReady(),
    payment_mode: !payReady()
      ? "unconfigured"
      : process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live_")
        ? "live"
        : "test",
    contact: process.env.CONTACT_EMAIL || null,
  }),
);
app.get("/api/events", async (_q, s) => {
  if (!databaseReady()) return s.json(initialEvents());
  s.json(
    (
      await pool.query(
        "SELECT e.id,e.title,e.city,e.venue,e.starts_at,e.price,e.capacity,e.sales_open,coalesce((SELECT jsonb_agg(t ORDER BY t.price,t.name) FROM ticket_types t WHERE t.event_id=e.id),'[]') AS ticket_types FROM events e WHERE e.starts_at>now() ORDER BY e.starts_at",
      )
    ).rows,
  );
});
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const googleCookie = () =>
  production ? "__Host-twktk-google" : "twktk-google";
const googleLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
app.get("/api/auth/google", googleLimit, async (q, s) => {
  if (!googleReady()) return s.redirect("/login?error=google_setup");
  const state = token(),
    nonce = token(),
    verifier = token();
  await pool.query(
    "INSERT INTO oauth_states(hash,verifier,nonce_hash,return_to,expires_at,remember) VALUES($1,$2,$3,$4,now()+interval '10 minutes',$5)",
    [
      hash(state),
      verifier,
      hash(nonce),
      safeReturn(q.query.return, origin),
      q.query.remember === "true",
    ],
  );
  s.cookie(googleCookie(), state, {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge: 600000,
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: origin + "/api/auth/google/callback",
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  s.redirect(url.toString());
});
app.get("/api/auth/google/callback", googleLimit, async (q, s) => {
  const state = typeof q.query.state === "string" ? q.query.state : "";
  const cookie = q.headers.cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(googleCookie() + "="))
    ?.slice(googleCookie().length + 1);
  s.clearCookie(googleCookie(), {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
  });
  if (
    !googleReady() ||
    !state ||
    !/^[a-f0-9]{64}$/.test(state) ||
    cookie !== state
  )
    return s.redirect("/login?error=google_failed");
  const saved = (
    await pool.query(
      "DELETE FROM oauth_states WHERE hash=$1 AND expires_at>now() RETURNING *",
      [hash(state)],
    )
  ).rows[0];
  if (!saved || typeof q.query.code !== "string" || q.query.code.length > 4096)
    return s.redirect("/login?error=google_failed");
  try {
    const exchange = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code: q.query.code,
        code_verifier: saved.verifier,
        redirect_uri: origin + "/api/auth/google/callback",
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!exchange.ok) throw new Error("Google exchange failed");
    const identity = await exchange.json();
    const verified = await verifyGoogleToken(
      identity.id_token,
      process.env.GOOGLE_CLIENT_ID!,
      saved.nonce_hash,
    );
    const client = await pool.connect();
    let sessionToken = "";
    try {
      await client.query("BEGIN");
      sessionToken = await createSession(
        client,
        verified.email,
        verified.name,
        { remember: saved.remember },
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    setSessionCookie(s, sessionToken, production, saved.remember);
    s.redirect(safeReturn(saved.return_to, origin));
  } catch {
    s.redirect("/login?error=google_failed");
  }
});
app.post("/api/auth/request", authLimit, async (q, s) => {
  if (!databaseReady() || !mailReady())
    return s
      .status(503)
      .json({ error: "Sign-in is waiting for email hosting configuration." });
  const email = z.email().max(254).parse(q.body.email).toLowerCase();
  const t = token();
  await pool.query(
    "INSERT INTO login_tokens(hash,email,expires_at,remember) VALUES($1,$2,now()+interval '15 minutes',$3)",
    [hash(t), email, q.body.remember === true],
  );
  let returnTo = "/account";
  if (typeof q.body.returnTo === "string") {
    const url = new URL(q.body.returnTo, origin);
    if (
      url.origin === origin &&
      ["/", "/world", "/account", "/admin"].includes(url.pathname)
    )
      returnTo = url.pathname + url.search;
  }
  await sendLogin(
    email,
    `${origin}/login?return=${encodeURIComponent(returnTo)}#token=${t}`,
  );
  s.json({ ok: true });
});
app.post("/api/auth/signup", authLimit, async (q, s) => {
  const b = z
    .object({
      email: z.email().max(254),
      password: z.string().min(15).max(128),
      repeatPassword: z.string().max(128),
      remember: z.boolean(),
      acceptTerms: z.literal(true),
      returnTo: z.string().max(2048).optional(),
    })
    .refine((v) => v.password === v.repeatPassword, {
      message: "Passwords must match.",
      path: ["repeatPassword"],
    })
    .parse(q.body);
  if (!databaseReady() || !mailReady())
    return s
      .status(503)
      .json({
        error:
          "Account signup needs the hosted database and email service connected.",
      });
  const t = token(),
    passwordHash = await hashPassword(b.password);
  await pool.query(
    "INSERT INTO login_tokens(hash,email,expires_at,password_hash,remember) VALUES($1,$2,now()+interval '15 minutes',$3,$4)",
    [hash(t), b.email.toLowerCase(), passwordHash, b.remember],
  );
  await sendLogin(
    b.email.toLowerCase(),
    `${origin}/login?verify=signup&return=${encodeURIComponent(safeReturn(b.returnTo, origin))}#token=${t}`,
  );
  s.json({ ok: true });
});
app.post("/api/auth/password", authLimit, async (q, s) => {
  const b = z
    .object({
      email: z.email().max(254),
      password: z.string().min(1).max(128),
      remember: z.boolean(),
    })
    .parse(q.body);
  if (!databaseReady())
    return s.status(503).json({ error: "Account hosting is not configured." });
  const user = (
    await pool.query("SELECT password_hash FROM users WHERE email=$1", [
      b.email.toLowerCase(),
    ])
  ).rows[0];
  if (!(await verifyPassword(b.password, user?.password_hash)))
    return s
      .status(401)
      .json({
        error:
          "Email or password is incorrect. You can also use an email login link.",
      });
  const client = await pool.connect();
  let st = "";
  try {
    await client.query("BEGIN");
    st = await createSession(client, b.email.toLowerCase(), "", {
      remember: b.remember,
    });
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  setSessionCookie(s, st, production, b.remember);
  s.json({ ok: true });
});
app.post("/api/auth/consume", authLimit, async (q, s) => {
  const t = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(q.body.token),
    client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = (
      await client.query(
        "DELETE FROM login_tokens WHERE hash=$1 AND expires_at>now() RETURNING email,password_hash,remember",
        [hash(t)],
      )
    ).rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return s
        .status(401)
        .json({ error: "This sign-in link has expired or already been used." });
    }
    if (
      row.password_hash &&
      (!z.string().min(15).max(128).safeParse(q.body.password).success ||
        !(await verifyPassword(q.body.password, row.password_hash)))
    ) {
      await client.query("ROLLBACK");
      return s
        .status(401)
        .json({
          error:
            "Enter the password you chose during signup to confirm your account.",
        });
    }
    const st = await createSession(client, row.email, "", {
      remember: row.remember,
      passwordHash: row.password_hash,
    });
    await client.query("COMMIT");
    setSessionCookie(s, st, production, row.remember);
    s.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});
type AuthedRequest = Request & {
  user?: { id: string; email: string; admin: boolean };
};
async function auth(q: AuthedRequest, s: Response, next: NextFunction) {
  if (!databaseReady())
    return s.status(503).json({ error: "Account hosting is not configured." });
  const name = production ? "__Host-twktk" : "twktk",
    value =
      q.headers.cookie
        ?.split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith(name + "="))
        ?.slice(name.length + 1) || "";
  const user = (
    await pool.query(
      "SELECT u.id,u.email,u.full_name,u.phone FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=$1 AND s.expires_at>now()",
      [hash(value)],
    )
  ).rows[0];
  if (!user)
    return q.path === "/admin"
      ? s.redirect("/login?return=%2Fadmin")
      : s.status(401).json({ error: "Sign in to continue." });
  q.user = {
    ...user,
    admin: (process.env.ADMIN_EMAILS || "")
      .toLowerCase()
      .split(",")
      .map((x) => x.trim())
      .includes(user.email),
  };
  next();
}
function admin(q: AuthedRequest, s: Response, next: NextFunction) {
  if (!q.user?.admin && q.path === "/admin") return s.sendStatus(404);
  if (!q.user?.admin)
    return s.status(403).json({ error: "Admin access required." });
  next();
}
app.get("/api/me", auth, (q: AuthedRequest, s) => s.json(q.user));
app.post("/api/auth/logout", auth, async (q, s) => {
  const name = production ? "__Host-twktk" : "twktk",
    v =
      q.headers.cookie
        ?.split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith(name + "="))
        ?.slice(name.length + 1) || "";
  await pool.query("DELETE FROM sessions WHERE hash=$1", [hash(v)]);
  s.clearCookie(name, {
    path: "/",
    secure: production,
    httpOnly: true,
    sameSite: "lax",
  });
  s.json({ ok: true });
});
app.get("/api/tickets", auth, async (q: AuthedRequest, s) =>
  s.json(
    (
      await pool.query(
        "SELECT t.id,t.checked_in_at,e.title,e.city,e.venue,e.starts_at,o.id AS booking_id FROM tickets t JOIN orders o ON o.id=t.order_id JOIN events e ON e.id=o.event_id WHERE o.user_id=$1 AND o.status='paid' ORDER BY e.starts_at",
        [q.user!.id],
      )
    ).rows,
  ),
);
app.get("/api/world/profile", auth, async (q: AuthedRequest, s) => {
  const prefs =
    (
      await pool.query("SELECT prefs FROM world_profiles WHERE id=$1", [
        q.user!.id,
      ])
    ).rows[0]?.prefs || {};
  s.json({ user: q.user, prefs });
});
app.put("/api/world/profile", auth, async (q: AuthedRequest, s) => {
  const clean = validateWorldPrefs(q.body.prefs);
  await pool.query(
    "INSERT INTO world_profiles(id,prefs) VALUES($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET prefs=world_profiles.prefs||EXCLUDED.prefs",
    [q.user!.id, JSON.stringify(clean)],
  );
  s.json({ ok: true });
});
app.post("/api/payments/order", auth, async (q: AuthedRequest, s) => {
  if (!payReady())
    return s.status(503).json({ error: "Ticket sales are not enabled yet." });
  const b = z
    .object({
      eventId: z.uuid(),
      quantity: z.number().int().min(1).max(6),
      requestId: z.uuid(),
      ticketTypeId: z.uuid(),
      name: z.string().trim().min(2).max(60),
      phone: z
        .string()
        .max(20)
        .regex(/^[+\d\s-]+$/)
        .transform((v) =>
          v
            .replace(/\D/g, "")
            .replace(/^91(?=\d{10}$)/, "")
            .replace(/^0(?=\d{10}$)/, ""),
        )
        .refine((v) => /^[6-9]\d{9}$/.test(v)),
    })
    .parse(q.body);
  const client = await pool.connect();
  let order;
  try {
    await client.query("BEGIN");
    const event = (
      await client.query("SELECT * FROM events WHERE id=$1 FOR UPDATE", [
        b.eventId,
      ])
    ).rows[0];
    if (!event?.sales_open || new Date(event.starts_at) <= new Date()) {
      await client.query("ROLLBACK");
      return s
        .status(409)
        .json({ error: "Sales are closed for this gathering." });
    }
    const type = b.ticketTypeId
      ? (
          await client.query(
            "SELECT * FROM ticket_types WHERE id=$1 AND event_id=$2",
            [b.ticketTypeId, b.eventId],
          )
        ).rows[0]
      : null;
    if (b.ticketTypeId && !type?.sales_open) {
      await client.query("ROLLBACK");
      return s
        .status(409)
        .json({ error: "This ticket category is not available." });
    }
    const admissions = type?.admissions || 1;
    order = (
      await client.query(
        "SELECT * FROM orders WHERE id=$1 OR (user_id=$2 AND event_id=$3 AND status='pending') ORDER BY created_at LIMIT 1",
        [b.requestId, q.user!.id, b.eventId],
      )
    ).rows[0];
    if (order) {
      if (
        order.user_id !== q.user!.id ||
        order.event_id !== b.eventId ||
        order.quantity !== b.quantity ||
        order.ticket_type_id !== (b.ticketTypeId || null)
      ) {
        await client.query("ROLLBACK");
        return s.status(409).json({
          error:
            "An existing reservation has different details. Resume with its original quantity or contact the organizer.",
        });
      }
    } else {
      const count = Number(
        (
          await client.query(
            "SELECT coalesce(sum(quantity*admissions),0) AS n FROM orders WHERE event_id=$1 AND status IN ('pending','paid')",
            [b.eventId],
          )
        ).rows[0].n,
      );
      const typeHeld = type
        ? Number(
            (
              await client.query(
                "SELECT coalesce(sum(quantity),0) AS n FROM orders WHERE ticket_type_id=$1 AND status IN ('pending','paid')",
                [type.id],
              )
            ).rows[0].n,
          )
        : 0;
      if (
        count + b.quantity * admissions > event.capacity ||
        (type && typeHeld + b.quantity > type.capacity)
      ) {
        await client.query("ROLLBACK");
        return s.status(409).json({
          error: "These tickets are currently reserved. Please try later.",
        });
      }
      order = (
        await client.query(
          "INSERT INTO orders(id,user_id,event_id,quantity,amount,ticket_type_id,admissions,attendee_name,attendee_phone) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
          [
            b.requestId,
            q.user!.id,
            b.eventId,
            b.quantity,
            (type?.price || event.price) * b.quantity,
            type?.id || null,
            admissions,
            b.name || "",
            b.phone || "",
          ],
        )
      ).rows[0];
    }
    await client.query("UPDATE users SET full_name=$1,phone=$2 WHERE id=$3", [
      order.attendee_name,
      order.attendee_phone,
      q.user!.id,
    ]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  if (order.status === "paid")
    return s.status(409).json({ error: "This booking has already been paid." });
  if (!order.razorpay_order_id) {
    const claim = await pool.query(
      "UPDATE orders SET provider_attempted=true WHERE id=$1 AND provider_attempted=false RETURNING id",
      [order.id],
    );
    if (!claim.rows.length)
      return s.status(409).json({
        error:
          "Your payment order is being created or needs reconciliation. Please wait and contact the organizer before retrying.",
      });
    const remote = await razorpay("POST", "/orders", {
      amount: order.amount,
      currency: "INR",
      receipt: order.id,
      notes: { booking_id: order.id },
    });
    order = (
      await pool.query(
        "UPDATE orders SET razorpay_order_id=$1 WHERE id=$2 RETURNING *",
        [remote.id, order.id],
      )
    ).rows[0];
  }
  s.json({
    orderId: order.razorpay_order_id,
    amount: order.amount,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID,
    email: q.user!.email,
  });
});
app.post("/api/payments/verify", auth, async (q: AuthedRequest, s) => {
  const b = z
    .object({
      razorpay_order_id: z.string().regex(/^order_\w+$/),
      razorpay_payment_id: z.string().regex(/^pay_\w+$/),
      razorpay_signature: z.string(),
    })
    .parse(q.body);
  const order = (
    await pool.query(
      "SELECT * FROM orders WHERE razorpay_order_id=$1 AND user_id=$2",
      [b.razorpay_order_id, q.user!.id],
    )
  ).rows[0];
  if (!order) return s.sendStatus(404);
  if (
    !signatureValid(
      process.env.RAZORPAY_KEY_SECRET || "",
      `${order.razorpay_order_id}|${b.razorpay_payment_id}`,
      b.razorpay_signature,
    )
  )
    return s.status(400).json({ error: "Payment signature rejected." });
  s.json({
    bookingId: await finalize(order.razorpay_order_id, b.razorpay_payment_id),
  });
});
app.get("/api/admin", auth, admin, async (_q, s) => {
  const events = (
    await pool.query(
      "SELECT e.*,coalesce(sum(o.quantity*o.admissions) FILTER(WHERE o.status='paid'),0) AS sold,coalesce(sum(o.quantity*o.admissions) FILTER(WHERE o.status='pending'),0) AS reserved,coalesce((SELECT jsonb_agg(t ORDER BY t.price,t.name) FROM ticket_types t WHERE t.event_id=e.id),'[]') AS ticket_types FROM events e LEFT JOIN orders o ON e.id=o.event_id GROUP BY e.id ORDER BY e.starts_at",
    )
  ).rows;
  const orders = (
    await pool.query(
      "SELECT o.*,u.email,e.title FROM orders o JOIN users u ON u.id=o.user_id JOIN events e ON e.id=o.event_id ORDER BY o.created_at DESC LIMIT 100",
    )
  ).rows;
  const logs = (
    await pool.query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100")
  ).rows;
  const mail = (
    await pool.query(
      "SELECT count(*) AS pending FROM email_queue WHERE sent_at IS NULL",
    )
  ).rows[0];
  s.json({ events, orders, logs, mail });
});
app.get("/api/admin/customers", auth, admin, async (q, s) => {
  const search = z
    .string()
    .max(120)
    .parse(q.query.search || "");
  const offset = z.coerce
    .number()
    .int()
    .min(0)
    .max(1000000)
    .parse(q.query.offset || 0);
  const customers = (
    await pool.query(
      `SELECT u.id,u.email,u.full_name,u.phone,u.created_at,count(o.id)::int AS bookings,
    count(o.id) FILTER(WHERE o.status='paid')::int AS paid_bookings,
    coalesce(sum(o.amount) FILTER(WHERE o.status='paid'),0) AS paid_amount,
    max(o.created_at) AS last_booking FROM users u LEFT JOIN orders o ON o.user_id=u.id
    WHERE u.email ILIKE $1 OR u.full_name ILIKE $1 OR u.phone ILIKE $1
    GROUP BY u.id ORDER BY u.created_at DESC,u.id LIMIT 101 OFFSET $2`,
      ["%" + search + "%", offset],
    )
  ).rows;
  s.json({
    customers: customers.slice(0, 100),
    hasMore: customers.length > 100,
  });
});
const eventSchema = z.object({
  title: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80),
  venue: z.string().trim().min(2).max(160),
  starts_at: z.iso.datetime({ offset: true }),
  price: z.number().int().min(100).max(10000000),
  capacity: z.number().int().min(1).max(100000),
  sales_open: z.boolean(),
});
async function adminTransaction(
  q: AuthedRequest,
  action: (client: any) => Promise<any>,
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT set_config('twktk.actor',$1,true)", [q.user!.email]);
    const result = await action(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
app.post("/api/admin/events", auth, admin, async (q: AuthedRequest, s) => {
  const b = eventSchema.parse(q.body);
  b.sales_open = false;
  const id = randomUUID();
  await adminTransaction(q, async (c) => {
    await c.query(
      "INSERT INTO events(id,title,city,venue,starts_at,price,capacity,sales_open) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        id,
        b.title,
        b.city,
        b.venue,
        b.starts_at,
        b.price,
        b.capacity,
        b.sales_open,
      ],
    );
    const cityPrices =
      originalPrices[
        /mumbai/i.test(b.city)
          ? "mumbai"
          : /bangalore|bengaluru/i.test(b.city)
            ? "bangalore"
            : "delhi"
      ];
    for (const [index, name] of categoryNames.entries())
      await c.query(
        "INSERT INTO ticket_types(event_id,name,price,capacity,admissions) VALUES($1,$2,$3,$4,$5)",
        [
          id,
          name,
          index === 0 ? b.price : cityPrices[index],
          name === "TABLES STARTING"
            ? Math.max(1, Math.floor(b.capacity / 6))
            : b.capacity,
          name === "TABLES STARTING" ? 6 : 1,
        ],
      );
  });
  s.json({ id });
});
app.patch("/api/admin/events/:id", auth, admin, async (q: AuthedRequest, s) => {
  const id = z.uuid().parse(q.params.id),
    b = eventSchema.partial().parse(q.body);
  if (!Object.keys(b).length) return s.sendStatus(400);
  const result = await adminTransaction(q, async (c) => {
    const old = (
      await c.query("SELECT * FROM events WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (!old) return { error: "Gathering not found." };
    const event = { ...old, ...b };
    const held = Number(
      (
        await c.query(
          "SELECT coalesce(sum(quantity*admissions),0) AS n FROM orders WHERE event_id=$1 AND status IN ('pending','paid')",
          [id],
        )
      ).rows[0].n,
    );
    if (event.capacity < held)
      return {
        error: "Capacity cannot be lower than sold and reserved tickets.",
      };
    if (
      event.sales_open &&
      (event.venue === "Venue to be announced" || !payReady())
    )
      return {
        error: "Confirm a venue and configure Razorpay before opening sales.",
      };
    await c.query(
      "UPDATE events SET title=$1,city=$2,venue=$3,starts_at=$4,price=$5,capacity=$6,sales_open=$7 WHERE id=$8",
      [
        event.title,
        event.city,
        event.venue,
        event.starts_at,
        event.price,
        event.capacity,
        event.sales_open,
        id,
      ],
    );
    if (b.price !== undefined)
      await c.query(
        "UPDATE ticket_types SET price=$1 WHERE event_id=$2 AND name='GENERAL ACCESS'",
        [b.price, id],
      );
    return { ok: true };
  });
  s.status(result.error ? 409 : 200).json(result);
});
app.patch(
  "/api/admin/ticket-types/:id",
  auth,
  admin,
  async (q: AuthedRequest, s) => {
    const id = z.uuid().parse(q.params.id),
      b = z
        .object({
          price: z.number().int().min(100).max(10000000),
          capacity: z.number().int().min(1).max(100000),
          sales_open: z.boolean(),
        })
        .parse(q.body);
    const result = await adminTransaction(q, async (c) => {
      const type = (
        await c.query("SELECT * FROM ticket_types WHERE id=$1", [id])
      ).rows[0];
      if (!type) return { error: "Category not found." };
      await c.query("SELECT id FROM events WHERE id=$1 FOR UPDATE", [
        type.event_id,
      ]);
      const held = Number(
        (
          await c.query(
            "SELECT coalesce(sum(quantity),0) AS n FROM orders WHERE ticket_type_id=$1 AND status IN ('pending','paid')",
            [id],
          )
        ).rows[0].n,
      );
      if (b.capacity < held)
        return {
          error: "Inventory cannot be lower than sold and reserved units.",
        };
      await c.query(
        "UPDATE ticket_types SET price=$1,capacity=$2,sales_open=$3 WHERE id=$4",
        [b.price, b.capacity, b.sales_open, id],
      );
      if (type.name === "GENERAL ACCESS")
        await c.query("UPDATE events SET price=$1 WHERE id=$2", [
          b.price,
          type.event_id,
        ]);
      return { ok: true };
    });
    s.status(result.error ? 409 : 200).json(result);
  },
);
app.post("/api/admin/check-in", auth, admin, async (q: AuthedRequest, s) => {
  const id = z.uuid().parse(q.body.ticketId);
  const row = await adminTransaction(
    q,
    async (c) =>
      (
        await c.query(
          "UPDATE tickets t SET checked_in_at=now() FROM orders o WHERE t.id=$1 AND t.order_id=o.id AND o.status='paid' AND t.checked_in_at IS NULL RETURNING t.id",
          [id],
        )
      ).rows[0],
  );
  if (!row)
    return s
      .status(409)
      .json({ error: "Ticket not found or already checked in." });
  s.json({ ok: true });
});
app.post("/api/admin/email/retry", auth, admin, async (q: AuthedRequest, s) => {
  await adminTransaction(q, (c) =>
    c.query(
      "UPDATE email_queue SET attempts=0 WHERE sent_at IS NULL AND attempts>=10",
    ),
  );
  s.json({ ok: true });
});
app.post(
  "/api/admin/payments/reconcile",
  auth,
  admin,
  async (q: AuthedRequest, s) => {
    const id = z.uuid().parse(q.body.bookingId);
    let order = (await pool.query("SELECT * FROM orders WHERE id=$1", [id]))
      .rows[0];
    if (!order) return s.sendStatus(404);
    if (!order.razorpay_order_id && q.body.providerOrderId) {
      const providerId = z
          .string()
          .regex(/^order_\w+$/)
          .parse(q.body.providerOrderId),
        remote = await razorpay("GET", `/orders/${providerId}`);
      if (
        remote.receipt !== order.id ||
        remote.amount !== order.amount ||
        remote.currency !== "INR"
      )
        return s.status(409).json({
          error:
            "Provider order receipt or amount does not match this booking.",
        });
      await adminTransaction(q, (c) =>
        c.query(
          "UPDATE orders SET razorpay_order_id=$1 WHERE id=$2 AND razorpay_order_id IS NULL",
          [providerId, id],
        ),
      );
      order = (await pool.query("SELECT * FROM orders WHERE id=$1", [id]))
        .rows[0];
    }
    if (!order.razorpay_order_id)
      return s.status(409).json({
        error:
          "Review the receipt in Razorpay and enter its order ID. Do not create a second charge.",
      });
    const data = await razorpay(
        "GET",
        `/orders/${order.razorpay_order_id}/payments`,
      ),
      captured = data.items?.find((p: any) => capturedPaymentMatches(p, order));
    if (!captured)
      return s.status(409).json({
        error: "Razorpay has not confirmed a captured payment for this order.",
      });
    s.json({ bookingId: await finalize(order.razorpay_order_id, captured.id) });
  },
);
app.get("/api/admin/export", auth, admin, async (_q, s) => {
  const c = await pool.connect(),
    workbook = new ExcelJS.Workbook();
  workbook.creator = "TWKTK";
  workbook.created = new Date();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    for (const [name, sql] of [
      [
        "Bookings",
        "SELECT o.id,u.email,o.attendee_name,o.attendee_phone,e.title,e.city,tt.name AS category,o.quantity,o.quantity*o.admissions AS guest_count,o.amount/100.0 AS amount_inr,o.status,o.razorpay_order_id,o.payment_id,o.created_at FROM orders o JOIN users u ON u.id=o.user_id JOIN events e ON e.id=o.event_id LEFT JOIN ticket_types tt ON o.ticket_type_id=tt.id ORDER BY o.created_at",
      ],
      [
        "Tickets",
        "SELECT t.*,o.user_id FROM tickets t JOIN orders o ON o.id=t.order_id ORDER BY t.order_id,t.ordinal",
      ],
      ["Gatherings", "SELECT * FROM events ORDER BY starts_at"],
      [
        "Customers",
        "SELECT u.id,u.email,u.full_name,u.phone,u.created_at,count(o.id)::int AS bookings,count(o.id) FILTER(WHERE o.status='paid')::int AS paid_bookings,coalesce(sum(o.amount) FILTER(WHERE o.status='paid'),0)/100.0 AS paid_amount_inr FROM users u LEFT JOIN orders o ON o.user_id=u.id GROUP BY u.id ORDER BY u.created_at",
      ],
      [
        "Ticket categories",
        "SELECT * FROM ticket_types ORDER BY event_id,price",
      ],
      ["Audit history", "SELECT * FROM audit_logs ORDER BY id"],
    ] as const) {
      const result = await c.query(sql);
      addExportSheet(
        workbook,
        name,
        result.fields.map((field: any) => field.name),
        result.rows,
      );
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
  s.set(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  s.set(
    "Content-Disposition",
    `attachment; filename="TWKTK-records-${new Date().toISOString().slice(0, 10)}.xlsx"`,
  );
  await workbook.xlsx.write(s);
  s.end();
});
app.use("/api", (_q, s) =>
  s.status(404).json({ error: "Endpoint not found." }),
);
// Only explicitly selected public assets and compiled files are served.
app.get("/assets/models/player-web.glb", (_q, s) =>
  s.sendFile(path.join(root, "assets/models/player-web.glb")),
);
for (const folder of ["brand", "images", "audio"])
  app.use(
    `/assets/${folder}`,
    express.static(path.join(root, "assets", folder), {
      dotfiles: "deny",
      maxAge: "1d",
      index: false,
    }),
  );
app.use(
  express.static(path.join(root, "dist"), { dotfiles: "deny", index: false }),
);
app.get(["/world", "/world.html"], (_q, s) =>
  s.sendFile(path.join(root, "dist/index.html")),
);
app.get("/", (_q, s) => s.sendFile(path.join(root, "dist/index.html")));
app.get(
  "/admin",
  (_q, s, next) => {
    s.set("Cache-Control", "no-store");
    next();
  },
  auth,
  admin,
  (_q, s) => s.sendFile(path.join(root, "dist/portal.html")),
);
if (
  !production &&
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)
) {
  app.get("/admin-preview", (_q, s) =>
    s.sendFile(path.join(root, "dist/portal.html")),
  );
}
app.get(
  [
    "/",
    "/world",
    "/login",
    "/signup",
    "/account",
    "/privacy",
    "/terms",
    "/refunds",
  ],
  (_q, s) => s.sendFile(path.join(root, "dist/portal.html")),
);
app.use((err: any, _q: Request, s: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError)
    return s
      .status(400)
      .json({ error: "Please check the details you entered." });
  console.error("Request failed:", err instanceof Error ? err.name : "Unknown");
  s.status(503).json({
    error:
      "This service is temporarily unavailable. If you paid, do not pay again; your confirmation may be delayed.",
  });
});
let sending = false;
const timer = setInterval(async () => {
  if (sending) return;
  sending = true;
  try {
    await flushMail();
    if (databaseReady())
      await pool.query(
        "DELETE FROM login_tokens WHERE expires_at<now(); DELETE FROM sessions WHERE expires_at<now(); DELETE FROM oauth_states WHERE expires_at<now()",
      );
  } catch {
  } finally {
    sending = false;
  }
}, 30000);
timer.unref();
app.listen(Number(process.env.PORT || 8140), "0.0.0.0", () =>
  console.log(`TWKTK server ready on port ${process.env.PORT || 8140}`),
);
