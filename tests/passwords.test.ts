import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../server/passwords";
import { createSession, setSessionCookie } from "../server/session";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
test("Passwords use unique salted hashes and reject incorrect or absent credentials", async () => {
  const value = "a long festival passphrase";
  const a = await hashPassword(value),
    b = await hashPassword(value);
  assert.notEqual(a, b);
  assert.ok(!a.includes(value));
  assert.equal(await verifyPassword(value, a), true);
  assert.equal(await verifyPassword("incorrect password", a), false);
  assert.equal(await verifyPassword(value, null), false);
  assert.equal(await verifyPassword(value, "corrupt"), false);
});
test("Session persistence follows remember-me and signup cannot overwrite an existing password", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"),
    );
    const existing = await hashPassword("the original password phrase");
    await createSession(db as any, "guest@example.com", "Guest", {
      passwordHash: existing,
      remember: false,
    });
    await createSession(db as any, "guest@example.com", "", {
      passwordHash: "different",
      remember: true,
    });
    const rows: any[] = (await db.query("SELECT password_hash FROM users"))
      .rows;
    assert.equal(rows[0].password_hash, existing);
    const sessions: any[] = (
      await db.query(
        "SELECT extract(epoch from (expires_at-now()))/3600 AS hours FROM sessions ORDER BY expires_at",
      )
    ).rows;
    assert.ok(
      Number(sessions[0].hours) <= 8 && Number(sessions[0].hours) > 7.9,
    );
    assert.ok(
      Number(sessions[1].hours) <= 720 && Number(sessions[1].hours) > 719.9,
    );
    const logs: any[] = (
      await db.query(
        "SELECT before_data,after_data FROM audit_logs WHERE entity='users'",
      )
    ).rows;
    assert.ok(
      logs.every((l) => !JSON.stringify(l).includes(existing)),
      "Password hashes stay out of audit/export snapshots",
    );
    const cookies: any[] = [];
    const response = {
      cookie: (name: any, value: any, options: any) =>
        cookies.push({ name, value, options }),
    };
    setSessionCookie(response as any, "token", true, false);
    setSessionCookie(response as any, "token", true, true);
    assert.equal(cookies[0].options.maxAge, undefined);
    assert.equal(cookies[1].options.maxAge, 30 * 86400000);
    assert.equal(cookies[0].options.httpOnly, true);
    assert.equal(cookies[0].options.secure, true);
  } finally {
    await db.close();
  }
});
