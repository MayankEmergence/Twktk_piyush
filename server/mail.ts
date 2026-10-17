import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { pool } from "./db";
import { renderLoginEmailHtml } from "./email-templates";

const logoPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/brand/logo.png",
);

export const hasSmtpConfig = () =>
  Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.MAIL_FROM,
  );

export const mailReady = () =>
  Boolean(
    hasSmtpConfig() ||
      (process.env.NODE_ENV !== "production" &&
        process.env.SMTP_DEV !== "false"),
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
  const origin = process.env.APP_URL || "https://www.thosewhoknowtheyknow.com";
  const { html, text } = renderLoginEmailHtml({ email, link, origin });
  const isSignup = link.includes("verify=signup");
  const subject = isSignup ? "Verify your TWKTK account" : "Your TWKTK sign-in link";

  const attachments = existsSync(logoPath)
    ? [
        {
          filename: "logo.png",
          path: logoPath,
          cid: "twktk-logo",
        },
      ]
    : undefined;

  if (hasSmtpConfig()) {
    await transport().sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject,
      text,
      html,
      attachments,
    });
  } else {
    console.log("\n========================================================");
    console.log(`✉️  [DEV EMAIL] ${subject} for ${email}:`);
    console.log(`🔗  ${link}`);
    console.log("========================================================\n");
  }
}

export async function queueMail(
  client: any,
  email: string,
  subject: string,
  body: string,
  html?: string,
) {
  const payload = html ? JSON.stringify({ text: body, html }) : body;
  await client.query(
    "INSERT INTO email_queue(id,recipient,subject,body) VALUES($1,$2,$3,$4)",
    [randomUUID(), email, subject, payload],
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
        let textBody = row.body;
        let htmlBody: string | undefined = undefined;
        try {
          if (row.body.startsWith("{") && row.body.endsWith("}")) {
            const parsed = JSON.parse(row.body);
            if (parsed.text || parsed.html) {
              textBody = parsed.text || row.body;
              htmlBody = parsed.html;
            }
          }
        } catch {}

        const attachments = existsSync(logoPath)
          ? [
              {
                filename: "logo.png",
                path: logoPath,
                cid: "twktk-logo",
              },
            ]
          : undefined;

        if (hasSmtpConfig()) {
          await transport().sendMail({
            from: process.env.MAIL_FROM,
            to: row.recipient,
            subject: row.subject,
            text: textBody,
            html: htmlBody,
            attachments,
          });
        } else {
          console.log("\n========================================================");
          console.log(`✉️  [DEV TICKET EMAIL] To: ${row.recipient}`);
          console.log(`📋  Subject: ${row.subject}`);
          console.log(textBody);
          console.log("========================================================\n");
        }
        await client.query("UPDATE email_queue SET sent_at=now() WHERE id=$1", [
          row.id,
        ]);
      } catch (err) {
        console.error("Failed to deliver email:", err);
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
