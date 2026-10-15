import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("schema preserves permanent audit history and original purchased amounts", async () => {
  const db = new PGlite();
  try {
    const sql = await readFile(
      new URL("../server/schema.sql", import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    assert.equal((await db.query("SELECT * FROM events")).rows.length, 2);
    const u = "11111111-1111-4111-8111-111111111111",
      o = "22222222-2222-4222-8222-222222222222",
      t = "44444444-4444-4444-8444-444444444444",
      e = "33333333-3333-4333-8333-333333333331";
    await db.query("INSERT INTO users(id,email) VALUES($1,$2)", [
      u,
      "test@example.com",
    ]);
    await db.query(
      "INSERT INTO orders(id,user_id,event_id,quantity,amount) VALUES($1,$2,$3,2,399800)",
      [o, u, e],
    );
    await db.query(
      "UPDATE orders SET razorpay_order_id='order_test',status='paid',payment_id='pay_test' WHERE id=$1",
      [o],
    );
    await db.query("INSERT INTO tickets(id,order_id,ordinal) VALUES($1,$2,0)", [
      t,
      o,
    ]);
    for (const table of ["orders", "tickets", "events", "users"])
      await assert.rejects(
        db.exec(`DELETE FROM ${table}`),
        /cannot be deleted/,
      );
    await assert.rejects(
      db.exec("DELETE FROM audit_logs"),
      /cannot be deleted/,
    );
    await assert.rejects(
      db.exec("UPDATE audit_logs SET actor='forged'"),
      /cannot be deleted/,
    );
    await assert.rejects(
      db.query("UPDATE orders SET amount=1 WHERE id=$1", [o]),
      /cannot be rewritten/,
    );
    await assert.rejects(
      db.query("UPDATE orders SET status='pending' WHERE id=$1", [o]),
      /cannot be rewritten/,
    );
    await db.query("UPDATE events SET price=249900,capacity=700 WHERE id=$1", [
      e,
    ]);
    const order = (
      await db.query<{ amount: number }>(
        "SELECT amount FROM orders WHERE id=$1",
        [o],
      )
    ).rows[0];
    assert.equal(order.amount, 399800);
    const logs = (
      await db.query<{ before_data: any; after_data: any }>(
        "SELECT * FROM audit_logs WHERE entity='events' AND action='UPDATE'",
      )
    ).rows;
    assert.equal(logs[0].before_data.price, 199900);
    assert.equal(logs[0].after_data.price, 249900);
    const first = await db.query(
      "UPDATE tickets SET checked_in_at=now() WHERE id=$1 AND checked_in_at IS NULL RETURNING id",
      [t],
    );
    const second = await db.query(
      "UPDATE tickets SET checked_in_at=now() WHERE id=$1 AND checked_in_at IS NULL RETURNING id",
      [t],
    );
    assert.equal(first.rows.length, 1);
    assert.equal(second.rows.length, 0);
  } finally {
    await db.close();
  }
});
