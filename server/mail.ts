import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
import { pool } from "./db";
export const mailReady = () =>
  Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.MAIL_FROM,
  );
const transport = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === "465",
    requireTLS: process.env.SMTP_PORT !== "465",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
export async function sendLogin(email: string, link: string) {
  await transport().sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Your TWKTK sign-in link",
    text: `Enter your world.\n\n${link}\n\nThis link expires in 15 minutes and works once. If you did not request it, ignore this email.`,
  });
}
export async function queueMail(
  client: any,
  email: string,
  subject: string,
  body: string,
) {
  await client.query(
    "INSERT INTO email_queue(id,recipient,subject,body) VALUES($1,$2,$3,$4)",
    [randomUUID(), email, subject, body],
  );
}
export async function flushMail() {
  if (!mailReady() || !process.env.DATABASE_URL) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT * FROM email_queue WHERE sent_at IS NULL AND attempts<10 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 5",
    );
    for (const row of rows) {
      try {
        await transport().sendMail({
          from: process.env.MAIL_FROM,
          to: row.recipient,
          subject: row.subject,
          text: row.body,
        });
        await client.query("UPDATE email_queue SET sent_at=now() WHERE id=$1", [
          row.id,
        ]);
      } catch {
        await client.query(
          "UPDATE email_queue SET attempts=attempts+1 WHERE id=$1",
          [row.id],
        );
      }
    }
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
}
