import { api } from "../api";
export const config = {
  MODEL_URL: "/assets/models/player-web.glb",
  MODEL_HEIGHT: 1.75,
  MODEL_SCALE: 1,
  MODEL_YAW: 0,
  SOCIAL_ENABLED: false,
};
export const session: { user: any } = { user: null };
const values = new Map<string, string>();
const changes = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | undefined;
export const worldStore = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem(key: string, value: string) {
    values.set(key, String(value));
    if (session.user) {
      changes.set(key, String(value));
      clearTimeout(timer);
      timer = setTimeout(flush, 300);
    }
  },
  removeItem(key: string) {
    values.delete(key);
  },
};
async function flush() {
  const prefs = Object.fromEntries(changes);
  changes.clear();
  if (!Object.keys(prefs).length) return;
  try {
    await api("/world/profile", "PUT", { prefs });
  } catch {
    for (const [k, v] of Object.entries(prefs))
      if (!changes.has(k)) changes.set(k, v);
  }
}
addEventListener("pagehide", () => {
  if (session.user && changes.size) {
    fetch("/api/world/profile", {
      method: "PUT",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefs: Object.fromEntries(changes) }),
    }).catch(() => {});
  }
});
api("/world/profile")
  .then((data) => {
    session.user = data.user;
    const adminLink = document.querySelector<HTMLElement>("#worldAdmin");
    if (adminLink && data.user?.admin) adminLink.style.display = "";
    for (const [key, value] of Object.entries(data.prefs || {}))
      if (!values.has(key)) values.set(key, String(value));
  })
  .catch(() => {});
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
          .filter((n) => n.startsWith("twktk-"))
          .map((n) => caches.delete(n)),
      ),
    )
    .catch(() => {});
