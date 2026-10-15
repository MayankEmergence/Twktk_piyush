import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
test("HTTP routes block source disclosure, invalid origins and unsigned webhooks", async () => {
  const port = 18149,
    base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["--import", "tsx", "server/app.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(port),
      APP_URL: base,
      DATABASE_URL: "",
      RAZORPAY_KEY_ID: "dummy",
      RAZORPAY_KEY_SECRET: "dummy",
      RAZORPAY_WEBHOOK_SECRET: "dummy",
    },
    stdio: "pipe",
  });
  let output = "";
  server.stderr.on("data", (chunk) => (output += chunk.toString()));
  server.stdout.on("data", (chunk) => (output += chunk.toString()));
  try {
    let ready = false;
    for (let i = 0; i < 300; i++) {
      try {
        if ((await fetch(base + "/healthz")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, "server starts: " + output);
    for (const route of ["/", "/login", "/signup", "/world"])
      assert.equal((await fetch(base + route)).status, 200);
    for (const route of [
      "/.env",
      "/server/schema.sql",
      "/server/app.ts",
      "/README.md",
      "/backups-pre-razorpay/world.html",
      "/assets/models/player.glb",
    ])
      assert.equal((await fetch(base + route)).status, 404);
    assert.equal(
      (
        await fetch(base + "/api/auth/request", {
          method: "POST",
          headers: {
            Origin: "https://evil.example",
            "Content-Type": "application/json",
          },
          body: '{"email":"a@example.com"}',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/api/webhooks/razorpay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      400,
    );
    assert.equal((await fetch(base + "/api/admin")).status, 503);
    for (const invalid of [
      {
        email: "not-an-email",
        password: "a long festival password",
        repeatPassword: "a long festival password",
        remember: false,
        acceptTerms: true,
      },
      {
        email: "guest@example.com",
        password: "short",
        repeatPassword: "short",
        remember: false,
        acceptTerms: true,
      },
      {
        email: "guest@example.com",
        password: "a long festival password",
        repeatPassword: "not the same password",
        remember: false,
        acceptTerms: true,
      },
      {
        email: "guest@example.com",
        password: "a long festival password",
        repeatPassword: "a long festival password",
        remember: false,
        acceptTerms: false,
      },
    ]) {
      assert.equal(
        (
          await fetch(base + "/api/auth/signup", {
            method: "POST",
            headers: { Origin: base, "Content-Type": "application/json" },
            body: JSON.stringify(invalid),
          })
        ).status,
        400,
      );
    }
    assert.equal((await fetch(base + "/api/admin/customers")).status, 503);
    assert.equal((await fetch(base + "/admin")).status, 503);
    assert.equal(
      (
        await fetch(base + "/api/auth/google", { redirect: "manual" })
      ).headers.get("location"),
      "/login?error=google_setup",
    );
    assert.equal(
      (
        await fetch(
          base + "/api/auth/google/callback?state=forged&code=forged",
          { redirect: "manual" },
        )
      ).headers.get("location"),
      "/login?error=google_failed",
    );
    assert.equal((await fetch(base + "/api/admin/export")).status, 503);
    assert.equal((await fetch(base + "/admin-preview")).status, 200);
    const catalog = await (await fetch(base + "/api/events")).json();
    assert.equal(catalog.length, 2);
    assert.equal(
      catalog[0].sales_open,
      false,
      "A catalog cannot sell without the hosted database",
    );
    assert.deepEqual(
      catalog[0].ticket_types.map((t: any) => t.price),
      [199900, 399900, 499900, 699900, 999900, 3000000],
    );
    const config = await (await fetch(base + "/api/config")).json();
    assert.equal(config.accounts, false);
    assert.equal(
      (await fetch(base + "/")).headers.get("x-content-type-options"),
      "nosniff",
    );
  } catch(error) {
    throw new Error('HTTP test server output: '+output,{cause:error});
  } finally {
    server.kill();
  }
});
