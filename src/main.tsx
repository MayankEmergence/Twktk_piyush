import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import "./portal.css";
import EventEditor from "./event-editor";
import Reconcile from "./reconcile";
import TicketTypes from "./ticket-types";
import { isAdminPreview } from "./admin-preview";
import Customers from "./customers";
type Event = {
  id: string;
  title: string;
  city: string;
  venue: string;
  starts_at: string;
  price: number;
  capacity: number;
  sales_open: boolean;
  sold?: string;
  reserved?: string;
  ticket_types?: any[];
};
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n / 100);
const date = (s: string) =>
  new Date(s).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
const photo = "/assets/images/museum/editions/e09.jpg";
function App() {
  const [user, setUser] = useState<any>(null),
    [config, setConfig] = useState<any>({}),
    [page, setPage] = useState(location.pathname);
  const [returnTo] = useState(() => {
    const candidate =
      new URLSearchParams(location.search).get("return") || "/account";
    const url = new URL(candidate, location.origin);
    return url.origin === location.origin &&
      ["/", "/world", "/account", "/admin"].includes(url.pathname)
      ? url.pathname + url.search
      : "/account";
  });
  const navigate = (p: string) => {
    history.pushState({}, "", p);
    setPage(p);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    api("/me")
      .then(setUser)
      .catch(() => {});
    api("/config")
      .then(setConfig)
      .catch(() => {});
    const f = () => setPage(location.pathname);
    addEventListener("popstate", f);
    return () => removeEventListener("popstate", f);
  }, []);
  return (
    <>
      <header className="nav">
        <a className="wordmark" href="/">
          THOSE WHO KNOW<span>THEY KNOW</span>
        </a>
        <nav>
          <a href="/">BACK TO THE WORLD →</a>
          <a href="/account">MY TICKETS</a>
          {user?.admin && <a href="/admin">ADMIN</a>}
          <a
            className="nav-pill"
            href={
              "/login?return=" +
              encodeURIComponent(page === "/admin" ? "/admin" : returnTo)
            }
          >
            {user ? user.email : "SIGN IN"}
          </a>
        </nav>
      </header>
      {page === "/login" || page === "/signup" ? (
        <Login
          onSignedIn={() => location.assign(returnTo)}
          returnTo={returnTo}
          googleEnabled={Boolean(config.google)}
        />
      ) : page === "/account" ? (
        <Account
          user={user}
          signIn={() => navigate("/login")}
          onLogout={async () => {
            await api("/auth/logout", "POST", {});
            setUser(null);
            navigate("/login");
          }}
        />
      ) : page === "/admin" || isAdminPreview ? (
        <Admin user={user} onUpdate={() => {}} />
      ) : (
        <Policy
          page={
            page in { "/privacy": 1, "/terms": 1, "/refunds": 1 }
              ? page
              : "/terms"
          }
          contact={config.contact}
        />
      )}
      <footer>
        <a href="/">THOSE WHO KNOW THEY KNOW</a>
        <div>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/refunds">Refunds</a>
          {config.contact && <a href={"mailto:" + config.contact}>Contact</a>}
        </div>
        <span>© 2026 TWKTK · BEYOND SOUND</span>
      </footer>
    </>
  );
}
function Login({
  onSignedIn,
  returnTo,
  googleEnabled,
}: {
  onSignedIn: () => void;
  returnTo: string;
  googleEnabled: boolean;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [repeatPassword, setRepeatPassword] = useState(""),
    [remember, setRemember] = useState(false),
    [acceptTerms, setAcceptTerms] = useState(false),
    [emailLink, setEmailLink] = useState(false),
    [mode, setMode] = useState(
      location.pathname === "/signup" ? "signup" : "login",
    ),
    [message, setMessage] = useState(() =>
      new URLSearchParams(location.search).has("error")
        ? "Google sign-in could not complete. Try again or use your email link."
        : "",
    ),
    [busy, setBusy] = useState(false),
    [loginToken] = useState(() =>
      new URLSearchParams(location.hash.slice(1)).get("token"),
    );
  useEffect(() => {
    if (loginToken)
      history.replaceState({}, "", location.pathname + location.search);
  }, [loginToken]);
  const verifySignup =
    new URLSearchParams(location.search).get("verify") === "signup";
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!loginToken && mode === "signup") {
      if (password.length < 8 || password.length > 128)
        return setMessage("Use a password with 8–128 characters.");
      if (password !== repeatPassword)
        return setMessage("The two passwords must match.");
      if (!acceptTerms)
        return setMessage("Please accept the terms and privacy policy.");
    }
    setBusy(true);
    try {
      if (loginToken) {
        await api("/auth/consume", "POST", {
          token: loginToken,
          ...(verifySignup ? { password } : {}),
        });
        onSignedIn();
      } else {
        if (mode === "signup") {
          await api("/auth/signup", "POST", {
            email,
            password,
            repeatPassword,
            remember,
            acceptTerms,
            returnTo,
          });
          setMessage(
            "Check your email to verify your account. You’ll confirm with the password you chose here.",
          );
        } else if (emailLink) {
          await api("/auth/request", "POST", { email, returnTo, remember });
          setMessage("Check your inbox for your private login link.");
        } else {
          await api("/auth/password", "POST", { email, password, remember });
          onSignedIn();
        }
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-art">
        <img src={photo} alt="Festival crowd" />
        <h2>
          Your people.
          <br />
          <em>Your world.</em>
        </h2>
      </div>
      <form onSubmit={submit} className="auth-form">
        <span className="eyebrow">WELCOME TO THE INNER CIRCLE</span>
        <h1>
          {mode === "signup" ? "Join the inner circle." : "Welcome back."}
        </h1>
        {!loginToken && (
          <>
            <div
              className="auth-tabs"
              role="group"
              aria-label="Account options"
            >
              <button
                type="button"
                aria-pressed={mode === "login"}
                onClick={() => {
                  setMode("login");
                  setMessage("");
                  setPassword("");
                  setRepeatPassword("");
                }}
              >
                LOG IN
              </button>
              <button
                type="button"
                aria-pressed={mode === "signup"}
                onClick={() => {
                  setMode("signup");
                  setMessage("");
                  setPassword("");
                  setRepeatPassword("");
                }}
              >
                SIGN UP
              </button>
            </div>
            <button
              className="button google-button full"
              type="button"
              disabled={!googleEnabled}
              onClick={() =>
                location.assign(
                  "/api/auth/google?remember=" +
                    remember +
                    "&return=" +
                    encodeURIComponent(returnTo),
                )
              }
            >
              <img src="/assets/brand/google-g.png" alt="" aria-hidden="true" />
              Continue with Google
            </button>
            {!googleEnabled && (
              <p className="muted">
                Google sign-in will be available when the hosting account is
                connected.
              </p>
            )}
            <div className="auth-divider">OR USE YOUR EMAIL</div>
          </>
        )}
        <p>
          {loginToken
            ? "Your private link is ready. Confirm below to sign in."
            : mode === "signup"
              ? "Create your account. Verify your email, then step into the world."
              : emailLink
                ? "Get a private login link in your email."
                : "Log in with your email and password, or continue with Google."}
        </p>
        {!loginToken && (
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              value={email}
              required
              maxLength={254}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        {((!loginToken && (mode === "signup" || !emailLink)) ||
          (loginToken && verifySignup)) && (
          <label>
            Password
            <input
              type="password"
              autoComplete={
                mode === "signup" || verifySignup
                  ? "new-password"
                  : "current-password"
              }
              minLength={mode === "signup" || verifySignup ? 8 : 1}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "signup" ? "Choose a password" : "Enter your password"
              }
            />
            {(mode === "signup" || verifySignup) && (
              <small className="muted">
                8–128 characters. Spaces and passphrases are welcome.
              </small>
            )}
          </label>
        )}
        {!loginToken && mode === "signup" && (
          <label>
            Repeat password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              placeholder="Repeat your password"
              aria-invalid={
                repeatPassword.length > 0 && repeatPassword !== password
              }
            />
          </label>
        )}
        {!loginToken && (
          <label className="auth-check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />{" "}
            Remember me
          </label>
        )}
        {!loginToken && mode === "signup" && (
          <label className="auth-check">
            <input
              type="checkbox"
              required
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />{" "}
            I agree to the{" "}
            <a href="/terms" target="_blank" rel="noopener">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" rel="noopener">
              Privacy policy
            </a>
            .
          </label>
        )}
        <button className="button primary full" disabled={busy}>
          {busy
            ? "PLEASE WAIT…"
            : loginToken
              ? "CONFIRM SIGN IN ↗"
              : mode === "signup"
                ? "SIGN UP ↗"
                : emailLink
                  ? "SEND MY LOGIN LINK ↗"
                  : "LOG IN ↗"}
        </button>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        {!loginToken && mode === "login" && (
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setEmailLink(!emailLink);
              setMessage("");
            }}
          >
            {emailLink
              ? "USE MY PASSWORD →"
              : "FORGOT PASSWORD? USE AN EMAIL LINK →"}
          </button>
        )}
        {!loginToken && mode === "signup" && (
          <a className="text-link auth-cancel" href="/">
            CANCEL →
          </a>
        )}
      </form>
    </main>
  );
}
function Account({
  user,
  signIn,
  onLogout,
}: {
  user: any;
  signIn: () => void;
  onLogout: () => void;
}) {
  const [tickets, setTickets] = useState<any[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    if (user)
      api<any[]>("/tickets")
        .then(setTickets)
        .catch((e) => setError(e.message));
  }, [user]);
  return (
    <main className="section dashboard">
      <span className="eyebrow">YOUR INNER CIRCLE</span>
      <h1>My tickets.</h1>
      {!user ? (
        <>
          <p>Sign in to see your confirmed tickets.</p>
          <button className="button primary" onClick={signIn}>
            SIGN IN ↗
          </button>
        </>
      ) : (
        <>
          <div className="section-head">
            <p>{user.email}</p>
            <button className="text-link" onClick={onLogout}>
              SIGN OUT ↗
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
          {tickets.length ? (
            tickets.map((t) => (
              <article className="ticket" key={t.id}>
                <span className="eyebrow">
                  {t.checked_in_at ? "CHECKED IN" : "CONFIRMED ENTRY"}
                </span>
                <h3>
                  {t.title} / {t.city}
                </h3>
                <p>
                  {date(t.starts_at)} IST · {t.venue}
                </p>
                <code>{t.id}</code>
                <p className="muted">
                  Show this ticket ID and photo identification at entry. Keep
                  your ticket ID private.
                </p>
              </article>
            ))
          ) : (
            <div className="announcement">
              <h3>Your next story starts here.</h3>
              <p>Confirmed tickets will appear here after payment.</p>
            </div>
          )}
        </>
      )}
    </main>
  );
}
function Admin({ user, onUpdate }: { user: any; onUpdate: () => void }) {
  const [data, setData] = useState<any>(null),
    [services, setServices] = useState<any>({}),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [ticket, setTicket] = useState("");
  const refresh = () =>
    api("/admin")
      .then(setData)
      .catch((e) => setMessage(e.message));
  useEffect(() => {
    if (user?.admin) {
      refresh();
      api("/config")
        .then(setServices)
        .catch(() => {});
    }
  }, [user]);
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try {
      await api("/admin/events", "POST", {
        ...values,
        price: Math.round(Number(values.price) * 100),
        capacity: Number(values.capacity),
        starts_at: new Date(String(values.starts_at)).toISOString(),
        sales_open: false,
      });
      form.reset();
      await refresh();
      onUpdate();
      setMessage(
        "Gathering created with sales closed. Review it before opening sales.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function check(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/admin/check-in", "POST", { ticketId: ticket });
      setTicket("");
      setMessage("Ticket checked in successfully.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <main className="section dashboard">
      <span className="eyebrow">FESTIVAL OPERATIONS</span>
      <h1>The control room.</h1>
      {isAdminPreview && (
        <p className="notice preview-banner">
          <strong>INTERACTIVE ADMIN PREVIEW</strong>
          <br />
          Try editing prices, inventory and sales switches below. These are
          sample records; changes reset when you reload. No payments, emails or
          real records are changed.{" "}
          <a href="/admin">Open connected dashboard →</a>
        </p>
      )}
      {!user?.admin ? (
        <p>Sign in with an authorized admin email to manage the festival.</p>
      ) : (
        <>
          <div className="launch-status">
            <div>
              <span>DATABASE</span>
              <strong>
                {isAdminPreview
                  ? "Sample records"
                  : services.database
                    ? "Connected"
                    : "Connect hosting"}
              </strong>
            </div>
            <div>
              <span>EMAIL</span>
              <strong>
                {isAdminPreview
                  ? "Preview only"
                  : services.email
                    ? "Configured"
                    : "Connect email"}
              </strong>
            </div>
            <div>
              <span>RAZORPAY</span>
              <strong>
                {isAdminPreview
                  ? "No payments"
                  : services.payment_mode === "live"
                    ? "Live mode"
                    : services.payment_mode === "test"
                      ? "Test mode"
                      : "Configure keys"}
              </strong>
            </div>
            <div>
              <span>SALES</span>
              <strong>
                {data?.events.filter((e: Event) => e.sales_open).length || 0}{" "}
                gatherings open
              </strong>
            </div>
          </div>
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          <div className="admin-grid">
            <form className="panel" onSubmit={create}>
              <h3>Create a gathering</h3>
              <label>
                Event name
                <input name="title" required maxLength={120} />
              </label>
              <div className="two">
                <label>
                  City
                  <input name="city" required maxLength={80} />
                </label>
                <label>
                  Venue
                  <input name="venue" required maxLength={160} />
                </label>
              </div>
              <label>
                Date and time (your current timezone)
                <input name="starts_at" type="datetime-local" required />
              </label>
              <div className="two">
                <label>
                  Price in INR
                  <input
                    name="price"
                    type="number"
                    min="1"
                    max="100000"
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Capacity
                  <input
                    name="capacity"
                    type="number"
                    min="1"
                    max="100000"
                    required
                  />
                </label>
              </div>
              <button className="button primary" disabled={busy}>
                CREATE GATHERING ↗
              </button>
            </form>
            <div>
              <form className="panel" onSubmit={check}>
                <h3>Guest check-in</h3>
                <label>
                  Ticket ID
                  <input
                    value={ticket}
                    onChange={(e) => setTicket(e.target.value)}
                    required
                    placeholder="Paste the guest’s ticket ID"
                  />
                </label>
                <button className="button">CHECK IN ↗</button>
              </form>
              <div className="panel">
                <h3>Email delivery</h3>
                <p>
                  {data?.mail?.pending ?? "…"} confirmation emails awaiting
                  delivery.
                </p>
                <p className="muted">
                  Email delivery retries automatically. Check SMTP configuration
                  if the queue stays pending.
                </p>
                <button className="text-link" onClick={refresh}>
                  REFRESH ↻
                </button>
                <button
                  className="text-link"
                  style={{ marginLeft: 20 }}
                  onClick={async () => {
                    try {
                      await api("/admin/email/retry", "POST", {});
                      refresh();
                      setMessage("Failed email deliveries requeued.");
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  RETRY FAILED EMAILS ↗
                </button>
              </div>
            </div>
          </div>
          <div className="section-head">
            <h3>Gatherings</h3>
            <a
              className="button primary"
              href={isAdminPreview ? undefined : "/api/admin/export"}
              aria-disabled={isAdminPreview}
              onClick={
                isAdminPreview
                  ? () =>
                      setMessage(
                        "Excel export is available in the connected dashboard.",
                      )
                  : undefined
              }
            >
              EXPORT EXCEL ↗
            </a>
          </div>
          {data?.events.map((event: Event) => (
            <article className="event-row" key={event.id}>
              <div>
                <h3>
                  {event.city} / {event.title}
                </h3>
                <p>
                  {date(event.starts_at)} IST · {money(event.price)}
                </p>
                <p>
                  {event.sold} sold · {event.reserved} reserved ·{" "}
                  {event.capacity} capacity
                </p>
                <EventEditor
                  event={event}
                  onSave={() => {
                    refresh();
                    onUpdate();
                  }}
                />
                <TicketTypes
                  types={event.ticket_types || []}
                  onUpdate={() => {
                    refresh();
                    onUpdate();
                  }}
                />
              </div>
              <button
                className="button"
                onClick={async () => {
                  try {
                    await api(`/admin/events/${event.id}`, "PATCH", {
                      sales_open: !event.sales_open,
                    });
                    await refresh();
                    onUpdate();
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                {event.sales_open ? "CLOSE SALES" : "OPEN SALES"}
              </button>
            </article>
          ))}
          <h3>Recent bookings</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Event</th>
                  <th>Quantity</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.orders.map((o: any) => (
                  <tr key={o.id}>
                    <td>{o.attendee_name || "Not provided"}</td>
                    <td>{o.email}</td>
                    <td>{o.attendee_phone || "Not provided"}</td>
                    <td>{o.title}</td>
                    <td>{o.quantity}</td>
                    <td>{money(o.amount)}</td>
                    <td>
                      {o.status}
                      {o.status === "pending" && (
                        <Reconcile
                          order={o}
                          onDone={(message) => {
                            refresh();
                            setMessage(message);
                          }}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Customers />
          <h3>Permanent audit history</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {data?.logs.map((log: any) => (
                  <tr key={log.id}>
                    <td>{date(log.created_at)}</td>
                    <td>{log.actor}</td>
                    <td>
                      {log.action} / {log.entity}
                    </td>
                    <td>{log.record_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">
            Pending reservations remain held to protect capacity. Review
            unresolved orders in Razorpay before issuing refunds or changing
            inventory.
          </p>
        </>
      )}
    </main>
  );
}
function Policy({ page, contact }: { page: string; contact: string | null }) {
  const content: Record<string, { title: string; paragraphs: string[] }> = {
    "/privacy": {
      title: "Privacy",
      paragraphs: [
        "We collect your email address to sign you in, and booking details to deliver and manage your tickets. Razorpay processes payment information; this website does not store card numbers or banking credentials.",
        "When you choose Google sign-in, we receive your verified email and profile name from Google. We ask for your name and phone number at checkout and use them for booking and event entry. Only authorized festival admins can view customer records.",
        "We use a secure session cookie to keep you signed in. We do not include advertising trackers. Your email and booking data are stored in the hosted database and used by the email delivery provider for sign-in and ticket confirmations.",
        "Contact the organizer to request access, correction, or deletion of your personal information. Some transaction records may need to be retained for accounting or dispute resolution.",
      ],
    },
    "/terms": {
      title: "Terms of entry",
      paragraphs: [
        "Ticket sales apply only to the gathering, date, and venue listed at checkout. A ticket is confirmed once the payment provider confirms capture. Keep your ticket ID private; it can be checked in only once.",
        "Bring your ticket and valid photo identification. Age restrictions, accessibility information, event rules, and organizer details must be confirmed before ticket sales open.",
        "These launch policies require review and completion by the organizer before live ticket sales.",
      ],
    },
    "/refunds": {
      title: "Refunds & cancellations",
      paragraphs: [
        "The organizer must publish the final cancellation, refund eligibility, and refund timeline before accepting live payments. Contact the organizer with your booking ID for payment or refund questions.",
        "If payment was debited and your confirmation is delayed, do not pay again. Payment confirmation may arrive through the server notification after you leave checkout.",
        "Test-mode transactions do not purchase entry to a real event.",
      ],
    },
  };
  const c = content[page];
  return (
    <main className="section policy">
      <span className="eyebrow">TWKTK / INFORMATION</span>
      <h1>{c.title}</h1>
      {c.paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {contact ? (
        <a className="text-link" href={`mailto:${contact}`}>
          {contact} ↗
        </a>
      ) : (
        <p className="notice">
          Organizer contact details will be published before live ticket sales.
        </p>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
// Retire the previous offline worker on returning visitors' devices.
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(
        registrations
          .filter((r) => r.active?.scriptURL.endsWith("/sw.js"))
          .map((r) => r.unregister()),
      ),
    )
    .catch(() => {});
if ("caches" in window)
  caches
    .keys()
    .then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith("twktk-"))
          .map((name) => caches.delete(name)),
      ),
    )
    .catch(() => {});
