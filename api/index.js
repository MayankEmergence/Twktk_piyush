// server/app.ts
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID as randomUUID3, randomBytes as randomBytes3, createHash as createHash2 } from "node:crypto";
import path3 from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
import { existsSync as existsSync3 } from "node:fs";
import { z as z3 } from "zod";

// server/db.ts
import pg from "pg";
import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
try {
  if (typeof process.loadEnvFile === "function") {
    const envFile = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../.env"
    );
    if (existsSync(envFile)) {
      process.loadEnvFile(envFile);
    }
  }
} catch {
}
var dbUrl = (process.env.DATABASE_URL || "").trim();
var isLocalPglite = dbUrl === "local" || dbUrl === "pglite" || dbUrl.startsWith("pglite://");
var pgliteInstance = null;
var pgliteInitPromise = null;
async function getPglite() {
  if (pgliteInstance) return pgliteInstance;
  if (pgliteInitPromise) return pgliteInitPromise;
  pgliteInitPromise = (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const dataDir = process.env.VERCEL ? path.join("/tmp", ".data/db") : path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../.data/db"
    );
    mkdirSync(dataDir, { recursive: true });
    const db = new PGlite(dataDir);
    try {
      await db.query("SELECT 1 FROM events LIMIT 1");
    } catch {
      let sql = "";
      const candidates = [
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), "schema.sql"),
        path.resolve(process.cwd(), "server/schema.sql"),
        path.resolve(process.cwd(), "schema.sql")
      ];
      for (const p of candidates) {
        if (existsSync(p)) {
          sql = await readFile(p, "utf8");
          break;
        }
      }
      if (sql) {
        await db.exec(sql);
        console.log("Local PGlite database initialized with schema.sql");
      }
    }
    pgliteInstance = db;
    return db;
  })();
  return pgliteInitPromise;
}
var PGlitePool = class {
  async query(text, params) {
    const db = await getPglite();
    if (!params || params.length === 0) {
      if (text.includes(";")) {
        const res2 = await db.exec(text);
        const last = Array.isArray(res2) ? res2[res2.length - 1] : res2;
        return { rows: last?.rows || [], rowCount: last?.rows?.length ?? 0 };
      }
    }
    const res = await db.query(text, params);
    return { rows: res.rows || [], rowCount: res.rows?.length ?? 0 };
  }
  async connect() {
    const db = await getPglite();
    return {
      query: async (text, params) => {
        if (!params || params.length === 0) {
          if (text.includes(";")) {
            const res2 = await db.exec(text);
            const last = Array.isArray(res2) ? res2[res2.length - 1] : res2;
            return {
              rows: last?.rows || [],
              rowCount: last?.rows?.length ?? 0
            };
          }
        }
        const res = await db.query(text, params);
        return { rows: res.rows || [], rowCount: res.rows?.length ?? 0 };
      },
      release: () => {
      }
    };
  }
  async end() {
    if (pgliteInstance) {
      await pgliteInstance.close();
      pgliteInstance = null;
    }
  }
};
var pool = isLocalPglite ? new PGlitePool() : new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5e3,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : void 0
});
var databaseReady = () => Boolean(dbUrl);

// server/security.ts
import {
  createHash,
  createHmac,
  timingSafeEqual,
  randomBytes
} from "node:crypto";
var hash = (s) => createHash("sha256").update(s).digest("hex");
var token = () => randomBytes(32).toString("hex");
function signatureValid(secret, body, signature) {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(
    Buffer.from(createHmac("sha256", secret).update(body).digest("hex"), "hex"),
    Buffer.from(signature, "hex")
  );
}
function capturedPaymentMatches(payment, order) {
  return payment.status === "captured" && payment.order_id === order.razorpay_order_id && payment.amount === order.amount && payment.currency === "INR";
}

// server/mail.ts
import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
import path2 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { existsSync as existsSync2 } from "node:fs";

// server/email-templates.ts
function renderLoginEmailHtml({ email, link, origin: origin2 }) {
  const isSignup = link.includes("verify=signup");
  const isReset = link.includes("reset") || link.includes("forgot");
  const logoUrl = `${origin2}/assets/brand/logo.png`;
  let badge = "ACCESS LINK";
  let title = "Enter Your World";
  let subtitle = "Click the button below to sign in to your TWKTK account. This private access link is valid for 15 minutes.";
  let buttonText = "Enter TWKTK \u2192";
  if (isSignup) {
    badge = "VERIFICATION";
    title = "Confirm Your Account";
    subtitle = "Click below to confirm your email and set your access password. This link expires in 15 minutes.";
    buttonText = "Confirm Email \u2192";
  } else if (isReset) {
    badge = "PASSWORD RESET";
    title = "Reset Your Password";
    subtitle = "We received a request to reset your password. Use the link below to access your account and set a new password. If you didn't make this request, you can ignore this email.";
    buttonText = "Reset Password \u2192";
  }
  const plainText = `${title.toUpperCase()}

Those Who Know They Know

${subtitle}

Direct link:
${link}

This single-use link expires in 15 minutes.

19.0760\xB0N \xB7 72.8777\xB0E \xB7 EMERGENCE`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} \u2014 TWKTK</title>
</head>
<body style="margin:0;padding:0;background-color:#050507;color:#ffffff;font-family:'IBM Plex Mono',Menlo,Consolas,monospace;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#050507;width:100%;table-layout:fixed;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:500px;background-color:#09090d;border:1px solid #1a1a20;">
          
          <!-- TOP LOGO / LABEL -->
          <tr>
            <td style="padding:36px 36px 28px 36px;border-bottom:1px solid #14141a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <img src="cid:twktk-logo" onerror="this.onerror=null;this.src='${logoUrl}';" alt="TWKTK" width="36" height="36" style="display:block;border:0;width:36px;height:36px;border-radius:50%;" />
                  </td>
                  <td align="right" valign="middle">
                    <div style="font-size:10px;letter-spacing:2px;color:#737380;text-transform:uppercase;">${badge}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:36px 36px 32px 36px;">
              <div style="font-size:11px;letter-spacing:2px;color:#737380;text-transform:uppercase;margin-bottom:12px;">THOSE WHO KNOW THEY KNOW</div>
              <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;letter-spacing:1px;color:#ffffff;text-transform:uppercase;line-height:1.3;">
                ${title}
              </h1>
              <p style="margin:0 0 32px 0;font-size:13px;color:#8f8f9d;line-height:1.7;">
                ${subtitle}
              </p>

              <!-- BUTTON -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td>
                    <a href="${link}" target="_blank" style="display:inline-block;padding:14px 28px;background-color:#ffffff;color:#050507;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:1px;">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- URL FALLBACK -->
              <div style="border-top:1px solid #14141a;padding-top:24px;">
                <div style="font-size:10px;color:#50505e;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Direct link</div>
                <div style="word-break:break-all;font-size:11px;color:#737380;line-height:1.6;">
                  <a href="${link}" target="_blank" style="color:#8f8f9d;text-decoration:none;">${link}</a>
                </div>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #14141a;background-color:#07070a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:10px;color:#50505e;letter-spacing:1px;text-transform:uppercase;">
                    19.0760&deg;N &middot; 72.8777&deg;E
                  </td>
                  <td align="right" style="font-size:10px;color:#50505e;letter-spacing:1px;text-transform:uppercase;">
                    EMERGENCE
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { html, text: plainText };
}
function renderTicketEmailHtml(params) {
  const {
    email,
    eventTitle,
    city,
    venue,
    startsAt,
    category,
    totalGuests,
    amount,
    orderId,
    ticketIds,
    accountUrl,
    origin: origin2
  } = params;
  const logoUrl = `${origin2}/assets/brand/logo.png`;
  const formattedDate = new Date(startsAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  });
  const formattedAmount = (amount / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });
  const plainText = `CONFIRMED TICKETS \u2014 TWKTK

Event: ${eventTitle}
City: ${city.toUpperCase()}
Category: ${category}
Venue: ${venue}
Date & Time: ${formattedDate} IST
Guests: ${totalGuests} Admissions
Amount Paid: ${formattedAmount}
Booking ID: ${orderId}

Pass Codes:
${ticketIds.map((id, i) => `PASS 0${i + 1} \u2014 ${id}`).join("\n")}

View tickets in your account:
${accountUrl}

Present this confirmation and a government photo ID at the entrance. Keep pass codes confidential.

19.0760\xB0N \xB7 72.8777\xB0E \xB7 EMERGENCE`;
  const ticketRows = ticketIds.map(
    (id, idx) => `
      <div style="background-color:#060608;border:1px solid #14141a;padding:12px 14px;font-size:11px;color:#8f8f9d;letter-spacing:1px;margin-bottom:6px;">
        PASS 0${idx + 1} &mdash; ${id}
      </div>`
  ).join("");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmed Tickets \u2014 TWKTK</title>
</head>
<body style="margin:0;padding:0;background-color:#050507;color:#ffffff;font-family:'IBM Plex Mono',Menlo,Consolas,monospace;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#050507;width:100%;table-layout:fixed;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:500px;background-color:#09090d;border:1px solid #1a1a20;">
          
          <!-- TOP LOGO / LABEL -->
          <tr>
            <td style="padding:36px 36px 28px 36px;border-bottom:1px solid #14141a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <img src="cid:twktk-logo" onerror="this.onerror=null;this.src='${logoUrl}';" alt="TWKTK" width="36" height="36" style="display:block;border:0;width:36px;height:36px;border-radius:50%;" />
                  </td>
                  <td align="right" valign="middle">
                    <div style="font-size:10px;letter-spacing:2px;color:#737380;text-transform:uppercase;">CONFIRMATION</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HEADER -->
          <tr>
            <td style="padding:36px 36px 24px 36px;">
              <div style="font-size:11px;letter-spacing:2px;color:#737380;text-transform:uppercase;margin-bottom:12px;">TWKTK FESTIVAL</div>
              <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:600;letter-spacing:1px;color:#ffffff;text-transform:uppercase;line-height:1.3;">
                Tickets Confirmed
              </h1>
              <div style="font-size:12px;color:#737380;letter-spacing:1px;text-transform:uppercase;">
                ${city.toUpperCase()} &middot; ${eventTitle}
              </div>
            </td>
          </tr>

          <!-- DETAILS GRID -->
          <tr>
            <td style="padding:0 36px 28px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #14141a;">
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #14141a;font-size:11px;color:#737380;text-transform:uppercase;letter-spacing:1px;">Category</td>
                  <td align="right" style="padding:14px 0;border-bottom:1px solid #14141a;font-size:12px;color:#ffffff;font-weight:600;">${category}</td>
                </tr>
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #14141a;font-size:11px;color:#737380;text-transform:uppercase;letter-spacing:1px;">Venue</td>
                  <td align="right" style="padding:14px 0;border-bottom:1px solid #14141a;font-size:12px;color:#ffffff;">${venue}</td>
                </tr>
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #14141a;font-size:11px;color:#737380;text-transform:uppercase;letter-spacing:1px;">Date & Time</td>
                  <td align="right" style="padding:14px 0;border-bottom:1px solid #14141a;font-size:12px;color:#ffffff;">${formattedDate} IST</td>
                </tr>
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #14141a;font-size:11px;color:#737380;text-transform:uppercase;letter-spacing:1px;">Guests</td>
                  <td align="right" style="padding:14px 0;border-bottom:1px solid #14141a;font-size:12px;color:#ffffff;">${totalGuests} Admissions</td>
                </tr>
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #14141a;font-size:11px;color:#737380;text-transform:uppercase;letter-spacing:1px;">Amount Paid</td>
                  <td align="right" style="padding:14px 0;border-bottom:1px solid #14141a;font-size:12px;color:#ffffff;font-weight:600;">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #14141a;font-size:11px;color:#737380;text-transform:uppercase;letter-spacing:1px;">Booking ID</td>
                  <td align="right" style="padding:14px 0;border-bottom:1px solid #14141a;font-size:11px;color:#8f8f9d;letter-spacing:1px;">${orderId}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- PASS CODES -->
          <tr>
            <td style="padding:0 36px 32px 36px;">
              <div style="font-size:10px;color:#50505e;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Pass Codes</div>
              ${ticketRows}
            </td>
          </tr>

          <!-- BUTTON -->
          <tr>
            <td style="padding:0 36px 36px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td>
                    <a href="${accountUrl}" target="_blank" style="display:inline-block;padding:14px 28px;background-color:#ffffff;color:#050507;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:1px;">
                      View My Tickets &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <div style="font-size:11px;color:#50505e;line-height:1.6;">
                Present this confirmation and a government photo ID at the entrance. Keep pass codes confidential.
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #14141a;background-color:#07070a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:10px;color:#50505e;letter-spacing:1px;text-transform:uppercase;">
                    19.0760&deg;N &middot; 72.8777&deg;E
                  </td>
                  <td align="right" style="font-size:10px;color:#50505e;letter-spacing:1px;text-transform:uppercase;">
                    EMERGENCE
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { html, text: plainText };
}

// server/mail.ts
var logoPath = path2.resolve(
  path2.dirname(fileURLToPath2(import.meta.url)),
  "../assets/brand/logo.png"
);
var hasSmtpConfig = () => Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM
);
var mailReady = () => Boolean(
  hasSmtpConfig() || process.env.NODE_ENV !== "production" && process.env.SMTP_DEV !== "false"
);
var transport = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_PORT === "465",
  requireTLS: process.env.SMTP_PORT !== "465",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  connectionTimeout: 1e4,
  socketTimeout: 15e3
});
async function sendLogin(email, link) {
  const origin2 = process.env.APP_URL || "https://www.thosewhoknowtheyknow.com";
  const { html, text } = renderLoginEmailHtml({ email, link, origin: origin2 });
  const isSignup = link.includes("verify=signup");
  const isReset = link.includes("reset") || link.includes("forgot");
  const subject = isSignup ? "Verify your TWKTK account" : isReset ? "Reset your TWKTK access" : "Your TWKTK sign-in link";
  const attachments = existsSync2(logoPath) ? [
    {
      filename: "logo.png",
      path: logoPath,
      cid: "twktk-logo"
    }
  ] : void 0;
  if (hasSmtpConfig()) {
    await transport().sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject,
      text,
      html,
      attachments
    });
  } else {
    console.log("\n========================================================");
    console.log(`\u2709\uFE0F  [DEV EMAIL] ${subject} for ${email}:`);
    console.log(`\u{1F517}  ${link}`);
    console.log("========================================================\n");
  }
}
async function queueMail(client, email, subject, body, html) {
  const payload = html ? JSON.stringify({ text: body, html }) : body;
  await client.query(
    "INSERT INTO email_queue(id,recipient,subject,body) VALUES($1,$2,$3,$4)",
    [randomUUID(), email, subject, payload]
  );
}
async function flushMail() {
  if (!mailReady() || !process.env.DATABASE_URL) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT * FROM email_queue WHERE sent_at IS NULL AND attempts<10 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 5"
    );
    for (const row of rows) {
      try {
        let textBody = row.body;
        let htmlBody = void 0;
        try {
          if (row.body.startsWith("{") && row.body.endsWith("}")) {
            const parsed = JSON.parse(row.body);
            if (parsed.text || parsed.html) {
              textBody = parsed.text || row.body;
              htmlBody = parsed.html;
            }
          }
        } catch {
        }
        const attachments = existsSync2(logoPath) ? [
          {
            filename: "logo.png",
            path: logoPath,
            cid: "twktk-logo"
          }
        ] : void 0;
        if (hasSmtpConfig()) {
          await transport().sendMail({
            from: process.env.MAIL_FROM,
            to: row.recipient,
            subject: row.subject,
            text: textBody,
            html: htmlBody,
            attachments
          });
        } else {
          console.log("\n========================================================");
          console.log(`\u2709\uFE0F  [DEV TICKET EMAIL] To: ${row.recipient}`);
          console.log(`\u{1F4CB}  Subject: ${row.subject}`);
          console.log(textBody);
          console.log("========================================================\n");
        }
        await client.query("UPDATE email_queue SET sent_at=now() WHERE id=$1", [
          row.id
        ]);
      } catch (err) {
        console.error("Failed to deliver email:", err);
        await client.query(
          "UPDATE email_queue SET attempts=attempts+1 WHERE id=$1",
          [row.id]
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

// server/app.ts
import ExcelJS from "exceljs";

// server/export.ts
function addExportSheet(workbook, name, fields, rows) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }]
  });
  sheet.columns = fields.map((key) => ({
    header: key === "price" ? "Price (paise)" : key === "amount_inr" ? "Amount (INR)" : key.endsWith("_at") ? `${key} (UTC)` : key,
    key,
    width: key === "id" || key.endsWith("_id") ? 39 : key.includes("_data") ? 70 : 26,
    style: key === "amount_inr" ? { numFmt: '"INR" #,##0.00' } : key.endsWith("_at") ? { numFmt: "dd mmm yyyy hh:mm" } : {}
  }));
  for (const input of rows) {
    const row = { ...input };
    for (const key in row) {
      if (key === "amount_inr") row[key] = Number(row[key]);
      if (row[key] && typeof row[key] === "object" && !(row[key] instanceof Date))
        row[key] = JSON.stringify(row[key]);
    }
    sheet.addRow(row);
  }
  sheet.getRow(1).font = { bold: true, color: { argb: "FFF1F2DD" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF20271B" }
  };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount }
  };
  return sheet;
}

// server/app.ts
import compression from "compression";

// server/world-preferences.ts
import { z } from "zod";
var keys = z.enum([
  "twktk_guided",
  "twktk_name",
  "twktk_avatar",
  "twktk_lb",
  "twktk_g_runner",
  "twktk_g_rhythm",
  "twktk_g_simon",
  "twktk_g_maze"
]);
function validateWorldPrefs(value) {
  const incoming = z.partialRecord(keys, z.string().max(1e4)).parse(value), clean = {};
  for (const [key, text] of Object.entries(incoming)) {
    if (key === "twktk_guided") clean[key] = z.literal("1").parse(text);
    else if (key === "twktk_name") clean[key] = z.string().max(12).parse(text);
    else if (key.startsWith("twktk_g_"))
      clean[key] = String(
        z.number().int().min(0).max(1e7).parse(Number(text))
      );
    else if (key === "twktk_avatar")
      clean[key] = JSON.stringify(
        z.object({
          c: z.number().int().min(0).max(3),
          f: z.number().int().min(0).max(5)
        }).parse(JSON.parse(text))
      );
    else
      clean[key] = JSON.stringify(
        z.partialRecord(
          z.enum(["runner", "rhythm", "simon", "maze"]),
          z.array(
            z.object({
              n: z.string().max(12),
              s: z.number().int().min(0).max(1e7),
              t: z.number().int().min(0).max(864e13).optional()
            })
          ).max(5)
        ).parse(JSON.parse(text))
      );
  }
  return clean;
}

// src/festival.ts
var categoryNames = [
  "GENERAL ACCESS",
  "VIP",
  "FAN PIT",
  "ON STAGE",
  "EM LOUNGE",
  "TABLES STARTING"
];
var originalPrices = {
  mumbai: [199900, 499900, 699900, 999900, 999900, 5e6],
  delhi: [199900, 399900, 499900, 699900, 999900, 3e6],
  bangalore: [199900, 399900, 499900, 699900, 999900, 3e6]
};
function initialEvents() {
  return [
    {
      id: "33333333-3333-4333-8333-333333333331",
      city: "Delhi",
      key: "delhi",
      starts_at: "2026-10-31T18:00:00+05:30"
    },
    {
      id: "33333333-3333-4333-8333-333333333332",
      city: "Bengaluru",
      key: "bangalore",
      starts_at: "2026-11-01T18:00:00+05:30"
    }
  ].map((e) => ({
    ...e,
    title: `TWKTK \u2014 ${e.city}`,
    venue: "Venue to be announced",
    price: 199900,
    capacity: 2200,
    sales_open: false,
    sold: "0",
    reserved: "0",
    ticket_types: categoryNames.map((name, i) => ({
      id: `${e.key}-${i}`,
      event_id: e.id,
      name,
      price: originalPrices[e.key][i],
      capacity: 200,
      admissions: i === 5 ? 6 : 1,
      sales_open: false
    }))
  }));
}

// server/google-auth.ts
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z as z2 } from "zod";
var googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  { timeoutDuration: 1e4 }
);
function safeReturn(value, origin2) {
  if (typeof value !== "string") return "/account";
  try {
    const url = new URL(value, origin2);
    return url.origin === origin2 && ["/", "/world", "/account", "/admin"].includes(url.pathname) ? url.pathname + url.search : "/account";
  } catch {
    return "/account";
  }
}
async function verifyGoogleToken(idToken, clientId, nonceHash, keys2 = googleKeys) {
  const { payload } = await jwtVerify(idToken, keys2, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "sub", "nonce", "email", "email_verified"],
    maxTokenAge: "10 minutes"
  });
  if (payload.email_verified !== true || typeof payload.nonce !== "string" || hash(payload.nonce) !== nonceHash || !payload.sub || payload.azp !== void 0 && payload.azp !== clientId)
    throw new Error("Google identity verification failed");
  return {
    email: z2.email().max(254).parse(payload.email).toLowerCase(),
    name: typeof payload.name === "string" ? payload.name.slice(0, 60) : ""
  };
}

// server/session.ts
import { randomUUID as randomUUID2 } from "node:crypto";
async function createSession(client, email, name = "", options = {}) {
  const user = (await client.query(
    "INSERT INTO users(id,email,full_name,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET full_name=CASE WHEN users.full_name='' THEN EXCLUDED.full_name ELSE users.full_name END,password_hash=coalesce(users.password_hash,EXCLUDED.password_hash) RETURNING id",
    [randomUUID2(), email, name, options.passwordHash || null]
  )).rows[0];
  const sessionToken = token();
  await client.query(
    "INSERT INTO sessions(hash,user_id,expires_at) VALUES($1,$2,now()+($3::int*interval '1 hour'))",
    [hash(sessionToken), user.id, options.remember ? 720 : 8]
  );
  return sessionToken;
}
function setSessionCookie(response, value, production2, remember = false) {
  response.cookie(production2 ? "__Host-twktk" : "twktk", value, {
    httpOnly: true,
    secure: production2,
    sameSite: "lax",
    path: "/",
    ...remember ? { maxAge: 30 * 864e5 } : {}
  });
}

// server/passwords.ts
import { randomBytes as randomBytes2, scrypt, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
var derive = (password, salt) => new Promise(
  (resolve, reject) => scrypt(
    password,
    salt,
    64,
    { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
    (err, key) => err ? reject(err) : resolve(key)
  )
);
async function hashPassword(password) {
  const salt = randomBytes2(16).toString("hex");
  return `scrypt$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
var dummy;
async function verifyPassword(password, stored) {
  const valid = typeof stored === "string" && /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored);
  const encoded = valid ? stored : await (dummy ||= hashPassword(randomBytes2(32).toString("hex")));
  const [, salt, digest] = encoded.split("$");
  const key = await derive(password, salt);
  return valid && timingSafeEqual2(key, Buffer.from(digest, "hex"));
}

// server/app.ts
var app = express();
var root = path3.resolve(path3.dirname(fileURLToPath3(import.meta.url)), "..");
try {
  if (typeof process.loadEnvFile === "function") {
    const envFile = path3.resolve(root, ".env");
    if (existsSync3(envFile)) process.loadEnvFile(envFile);
  }
} catch {
}
var production = process.env.NODE_ENV === "production";
var googleReady = () => Boolean(
  databaseReady() && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);
var originUrl = new URL(process.env.APP_URL || "http://localhost:5173");
var origin = originUrl.origin;
var altOrigin = originUrl.hostname.startsWith("www.") ? `${originUrl.protocol}//${originUrl.hostname.slice(4)}${originUrl.port ? `:${originUrl.port}` : ""}` : `${originUrl.protocol}//www.${originUrl.hostname}${originUrl.port ? `:${originUrl.port}` : ""}`;
if (production && (!process.env.APP_URL?.startsWith("https://") || !databaseReady() || !mailReady() || !process.env.ADMIN_EMAILS))
  throw new Error(
    "Production requires HTTPS APP_URL, DATABASE_URL, SMTP settings and ADMIN_EMAILS."
  );
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 0));
app.disable("x-powered-by");
app.use(
  compression({
    filter: (q, s) => !q.path.startsWith("/api") && compression.filter(q, s)
  })
);
app.use(
  helmet({
    contentSecurityPolicy: production ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://checkout.razorpay.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.razorpay.com"],
        connectSrc: ["'self'", "https://*.razorpay.com"],
        frameSrc: ["https://*.razorpay.com"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    } : false,
    referrerPolicy: { policy: "no-referrer" }
  })
);
app.get("/healthz", (_q, s) => s.json({ ok: true }));
app.get("/sw.js", (_q, s) => {
  s.type("application/javascript").set("Cache-Control", "no-store").send(
    "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil(self.registration.unregister().then(()=>self.clients.claim())));"
  );
});
var payReady = () => Boolean(
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && (process.env.RAZORPAY_WEBHOOK_SECRET || !production) || !production && process.env.RAZORPAY_DEV_MOCK === "true"
);
async function razorpay(method, route, body) {
  const r = await fetch(`https://api.razorpay.com/v1${route}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : void 0,
    signal: AbortSignal.timeout(15e3)
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => "");
    console.error(`Razorpay API error [${r.status} ${r.statusText}]:`, errText);
    throw new Error("Payment provider unavailable");
  }
  return r.json();
}
async function finalize(orderId, paymentId) {
  const isMock = orderId.startsWith("order_mock_") && !production;
  let payment;
  if (isMock) {
    payment = {
      status: "captured",
      order_id: orderId,
      currency: "INR"
    };
  } else {
    payment = await razorpay("GET", `/payments/${paymentId}`);
    if (payment.status === "authorized") {
      try {
        payment = await razorpay("POST", `/payments/${paymentId}/capture`, {
          amount: payment.amount,
          currency: "INR"
        });
      } catch (err) {
        console.error("Auto-capture attempt failed:", err);
      }
    }
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = (await client.query(
      "SELECT * FROM orders WHERE razorpay_order_id=$1 FOR UPDATE",
      [orderId]
    )).rows[0];
    if (isMock && order) payment.amount = order.amount;
    if (!order || !capturedPaymentMatches(payment, order))
      throw new Error("Payment is not captured or does not match the booking");
    if (order.status !== "paid") {
      await client.query(
        "UPDATE orders SET status='paid',payment_id=$1 WHERE id=$2",
        [paymentId, order.id]
      );
      const ids = [];
      for (let i = 0; i < order.quantity * order.admissions; i++) {
        const id = randomUUID3();
        ids.push(id);
        await client.query(
          "INSERT INTO tickets(id,order_id,ordinal) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [id, order.id, i]
        );
      }
      const user = (await client.query("SELECT email FROM users WHERE id=$1", [
        order.user_id
      ])).rows[0];
      const event = (await client.query(
        "SELECT e.title,e.city,e.venue,e.starts_at,coalesce(t.name,'GENERAL ACCESS') AS category FROM events e LEFT JOIN ticket_types t ON t.id=$2 WHERE e.id=$1",
        [order.event_id, order.ticket_type_id]
      )).rows[0];
      const { html, text } = renderTicketEmailHtml({
        email: user.email,
        eventTitle: event.title,
        city: event.city,
        venue: event.venue,
        startsAt: event.starts_at,
        category: event.category,
        quantity: order.quantity,
        admissions: order.admissions,
        totalGuests: order.quantity * order.admissions,
        amount: order.amount,
        orderId: order.id,
        ticketIds: ids,
        accountUrl: `${origin}/account`,
        origin
      });
      await queueMail(
        client,
        user.email,
        `Your TWKTK tickets are confirmed \xB7 ${event.city.toUpperCase()}`,
        text,
        html
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
    if (!signatureValid(
      process.env.RAZORPAY_WEBHOOK_SECRET,
      q.body,
      q.get("X-Razorpay-Signature") || ""
    ))
      return s.sendStatus(400);
    const ev = JSON.parse(q.body.toString());
    if (["payment.captured", "order.paid"].includes(ev.event)) {
      const p = ev.payload?.payment?.entity;
      if (p?.id && p?.order_id) await finalize(p.order_id, p.id);
    }
    s.sendStatus(200);
  }
);
app.use(
  "/api",
  rateLimit({
    windowMs: 6e4,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false
  })
);
app.use(express.json({ limit: "16kb" }));
app.use("/api", (q, s, next) => {
  s.set("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(q.method)) {
    const reqOrigin = q.get("Origin");
    const host = q.get("x-forwarded-host") || q.get("host");
    const hostOrigin = host ? `https://${host}` : "";
    const allowedOrigins = /* @__PURE__ */ new Set([
      origin,
      altOrigin,
      ...hostOrigin ? [hostOrigin, `http://${host}`] : [],
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      `http://localhost:${process.env.PORT || 8140}`,
      `http://127.0.0.1:${process.env.PORT || 8140}`
    ]);
    let effectiveOrigin = reqOrigin;
    if (!effectiveOrigin && q.get("Referer")) {
      try {
        effectiveOrigin = new URL(q.get("Referer")).origin;
      } catch {
      }
    }
    if (effectiveOrigin) {
      if (!allowedOrigins.has(effectiveOrigin)) {
        return s.status(403).json({ error: "Request origin rejected" });
      }
    } else if (production && q.get("sec-fetch-site") === "cross-site") {
      return s.status(403).json({ error: "Request origin rejected" });
    }
  }
  next();
});
app.get(
  "/api/config",
  (_q, s) => s.json({
    accounts: databaseReady() && mailReady(),
    google: googleReady(),
    payments: payReady(),
    database: databaseReady(),
    email: mailReady(),
    payment_mode: !payReady() ? "unconfigured" : process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live_") ? "live" : "test",
    contact: process.env.CONTACT_EMAIL || null
  })
);
app.get("/api/events", async (_q, s) => {
  if (!databaseReady()) return s.json(initialEvents());
  s.json(
    (await pool.query(
      "SELECT e.id,e.title,e.city,e.venue,e.starts_at,e.price,e.capacity,e.sales_open,coalesce((SELECT jsonb_agg(t ORDER BY t.price,t.name) FROM ticket_types t WHERE t.event_id=e.id),'[]') AS ticket_types FROM events e WHERE e.starts_at>now() ORDER BY e.starts_at"
    )).rows
  );
});
var authLimit = rateLimit({
  windowMs: 15 * 6e4,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false
});
var googleCookie = () => production ? "__Host-twktk-google" : "twktk-google";
var googleLimit = rateLimit({
  windowMs: 15 * 6e4,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false
});
app.get("/api/auth/google", googleLimit, async (q, s) => {
  if (!googleReady()) return s.redirect("/login?error=google_setup");
  const state = token(), nonce = token(), verifier = token();
  await pool.query(
    "INSERT INTO oauth_states(hash,verifier,nonce_hash,return_to,expires_at,remember) VALUES($1,$2,$3,$4,now()+interval '10 minutes',$5)",
    [
      hash(state),
      verifier,
      hash(nonce),
      safeReturn(q.query.return, origin),
      q.query.remember === "true"
    ]
  );
  s.cookie(googleCookie(), state, {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge: 6e5
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: origin + "/api/auth/google/callback",
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: createHash2("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account"
  }).toString();
  s.redirect(url.toString());
});
app.get("/api/auth/google/callback", googleLimit, async (q, s) => {
  const state = typeof q.query.state === "string" ? q.query.state : "";
  const cookie = q.headers.cookie?.split(";").map((v) => v.trim()).find((v) => v.startsWith(googleCookie() + "="))?.slice(googleCookie().length + 1);
  s.clearCookie(googleCookie(), {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/"
  });
  if (!googleReady() || !state || !/^[a-f0-9]{64}$/.test(state) || cookie !== state)
    return s.redirect("/login?error=google_failed");
  const saved = (await pool.query(
    "DELETE FROM oauth_states WHERE hash=$1 AND expires_at>now() RETURNING *",
    [hash(state)]
  )).rows[0];
  if (!saved || typeof q.query.code !== "string" || q.query.code.length > 4096)
    return s.redirect("/login?error=google_failed");
  try {
    const exchange = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code: q.query.code,
        code_verifier: saved.verifier,
        redirect_uri: origin + "/api/auth/google/callback",
        grant_type: "authorization_code"
      }),
      signal: AbortSignal.timeout(1e4)
    });
    if (!exchange.ok) throw new Error("Google exchange failed");
    const identity = await exchange.json();
    const verified = await verifyGoogleToken(
      identity.id_token,
      process.env.GOOGLE_CLIENT_ID,
      saved.nonce_hash
    );
    const client = await pool.connect();
    let sessionToken = "";
    try {
      await client.query("BEGIN");
      sessionToken = await createSession(
        client,
        verified.email,
        verified.name,
        { remember: saved.remember }
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
    return s.status(503).json({ error: "Sign-in is waiting for email hosting configuration." });
  const email = z3.email().max(254).parse(q.body.email).toLowerCase();
  const t = token();
  await pool.query(
    "INSERT INTO login_tokens(hash,email,expires_at,remember) VALUES($1,$2,now()+interval '15 minutes',$3)",
    [hash(t), email, q.body.remember === true]
  );
  let returnTo = "/account";
  if (typeof q.body.returnTo === "string") {
    const url = new URL(q.body.returnTo, origin);
    if (url.origin === origin && ["/", "/world", "/account", "/admin"].includes(url.pathname))
      returnTo = url.pathname + url.search;
  }
  await sendLogin(
    email,
    `${origin}/login?return=${encodeURIComponent(returnTo)}#token=${t}`
  );
  s.json({ ok: true });
});
app.post("/api/auth/signup", authLimit, async (q, s) => {
  const b = z3.object({
    email: z3.email().max(254),
    password: z3.string().min(8).max(128),
    repeatPassword: z3.string().max(128),
    remember: z3.boolean(),
    acceptTerms: z3.literal(true),
    returnTo: z3.string().max(2048).optional()
  }).refine((v) => v.password === v.repeatPassword, {
    message: "Passwords must match.",
    path: ["repeatPassword"]
  }).parse(q.body);
  if (!databaseReady() || !mailReady())
    return s.status(503).json({
      error: "Account signup needs the hosted database and email service connected."
    });
  const t = token(), passwordHash = await hashPassword(b.password);
  await pool.query(
    "INSERT INTO login_tokens(hash,email,expires_at,password_hash,remember) VALUES($1,$2,now()+interval '15 minutes',$3,$4)",
    [hash(t), b.email.toLowerCase(), passwordHash, b.remember]
  );
  await sendLogin(
    b.email.toLowerCase(),
    `${origin}/login?verify=signup&return=${encodeURIComponent(safeReturn(b.returnTo, origin))}#token=${t}`
  );
  s.json({ ok: true });
});
app.post("/api/auth/password", authLimit, async (q, s) => {
  const b = z3.object({
    email: z3.email().max(254),
    password: z3.string().min(1).max(128),
    remember: z3.boolean()
  }).parse(q.body);
  if (!databaseReady())
    return s.status(503).json({ error: "Account hosting is not configured." });
  const user = (await pool.query("SELECT password_hash FROM users WHERE email=$1", [
    b.email.toLowerCase()
  ])).rows[0];
  if (!await verifyPassword(b.password, user?.password_hash))
    return s.status(401).json({
      error: "Email or password is incorrect. You can also use an email login link."
    });
  const client = await pool.connect();
  let st = "";
  try {
    await client.query("BEGIN");
    st = await createSession(client, b.email.toLowerCase(), "", {
      remember: b.remember
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
  const t = z3.string().regex(/^[a-f0-9]{64}$/).parse(q.body.token), client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = (await client.query(
      "DELETE FROM login_tokens WHERE hash=$1 AND expires_at>now() RETURNING email,password_hash,remember",
      [hash(t)]
    )).rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return s.status(401).json({ error: "This sign-in link has expired or already been used." });
    }
    if (row.password_hash && (!z3.string().min(8).max(128).safeParse(q.body.password).success || !await verifyPassword(q.body.password, row.password_hash))) {
      await client.query("ROLLBACK");
      return s.status(401).json({
        error: "Enter the password you chose during signup to confirm your account."
      });
    }
    const st = await createSession(client, row.email, "", {
      remember: row.remember,
      passwordHash: row.password_hash
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
async function auth(q, s, next) {
  if (!databaseReady())
    return s.status(503).json({ error: "Account hosting is not configured." });
  const name = production ? "__Host-twktk" : "twktk", value = q.headers.cookie?.split(";").map((x) => x.trim()).find((x) => x.startsWith(name + "="))?.slice(name.length + 1) || "";
  const user = (await pool.query(
    "SELECT u.id,u.email,u.full_name,u.phone FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=$1 AND s.expires_at>now()",
    [hash(value)]
  )).rows[0];
  if (!user)
    return q.path === "/admin" ? s.redirect("/login?return=%2Fadmin") : s.status(401).json({ error: "Sign in to continue." });
  q.user = {
    ...user,
    admin: (process.env.ADMIN_EMAILS || "").toLowerCase().split(",").map((x) => x.trim()).includes(user.email)
  };
  next();
}
function admin(q, s, next) {
  if (!q.user?.admin && q.path === "/admin") return s.sendStatus(404);
  if (!q.user?.admin)
    return s.status(403).json({ error: "Admin access required." });
  next();
}
app.get("/api/me", auth, (q, s) => s.json(q.user));
app.post("/api/auth/logout", auth, async (q, s) => {
  const name = production ? "__Host-twktk" : "twktk", v = q.headers.cookie?.split(";").map((x) => x.trim()).find((x) => x.startsWith(name + "="))?.slice(name.length + 1) || "";
  await pool.query("DELETE FROM sessions WHERE hash=$1", [hash(v)]);
  s.clearCookie(name, {
    path: "/",
    secure: production,
    httpOnly: true,
    sameSite: "lax"
  });
  s.json({ ok: true });
});
app.get(
  "/api/tickets",
  auth,
  async (q, s) => s.json(
    (await pool.query(
      "SELECT t.id,t.checked_in_at,e.title,e.city,e.venue,e.starts_at,o.id AS booking_id FROM tickets t JOIN orders o ON o.id=t.order_id JOIN events e ON e.id=o.event_id WHERE o.user_id=$1 AND o.status='paid' ORDER BY e.starts_at",
      [q.user.id]
    )).rows
  )
);
app.get("/api/world/profile", auth, async (q, s) => {
  const prefs = (await pool.query("SELECT prefs FROM world_profiles WHERE id=$1", [
    q.user.id
  ])).rows[0]?.prefs || {};
  s.json({ user: q.user, prefs });
});
app.put("/api/world/profile", auth, async (q, s) => {
  const clean = validateWorldPrefs(q.body.prefs);
  await pool.query(
    "INSERT INTO world_profiles(id,prefs) VALUES($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET prefs=world_profiles.prefs||EXCLUDED.prefs",
    [q.user.id, JSON.stringify(clean)]
  );
  s.json({ ok: true });
});
app.post("/api/payments/order", auth, async (q, s) => {
  if (!payReady())
    return s.status(503).json({ error: "Ticket sales are not enabled yet." });
  const b = z3.object({
    eventId: z3.uuid(),
    quantity: z3.number().int().min(1).max(6),
    requestId: z3.uuid(),
    ticketTypeId: z3.uuid(),
    name: z3.string().trim().min(2).max(60),
    phone: z3.string().max(20).regex(/^[+\d\s-]+$/).transform(
      (v) => v.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "").replace(/^0(?=\d{10}$)/, "")
    ).refine((v) => /^[6-9]\d{9}$/.test(v))
  }).parse(q.body);
  const client = await pool.connect();
  let order;
  try {
    await client.query("BEGIN");
    const event = (await client.query("SELECT * FROM events WHERE id=$1 FOR UPDATE", [
      b.eventId
    ])).rows[0];
    if (!event?.sales_open || new Date(event.starts_at) <= /* @__PURE__ */ new Date()) {
      await client.query("ROLLBACK");
      return s.status(409).json({ error: "Sales are closed for this gathering." });
    }
    const type = b.ticketTypeId ? (await client.query(
      "SELECT * FROM ticket_types WHERE id=$1 AND event_id=$2",
      [b.ticketTypeId, b.eventId]
    )).rows[0] : null;
    if (b.ticketTypeId && !type?.sales_open) {
      await client.query("ROLLBACK");
      return s.status(409).json({ error: "This ticket category is not available." });
    }
    const admissions = type?.admissions || 1;
    order = (await client.query(
      "SELECT * FROM orders WHERE id=$1 OR (user_id=$2 AND event_id=$3 AND status='pending') ORDER BY created_at LIMIT 1",
      [b.requestId, q.user.id, b.eventId]
    )).rows[0];
    if (order) {
      if (order.user_id !== q.user.id || order.event_id !== b.eventId || order.quantity !== b.quantity || order.ticket_type_id !== (b.ticketTypeId || null)) {
        await client.query("ROLLBACK");
        return s.status(409).json({
          error: "An existing reservation has different details. Resume with its original quantity or contact the organizer."
        });
      }
    } else {
      const count = Number(
        (await client.query(
          "SELECT coalesce(sum(quantity*admissions),0) AS n FROM orders WHERE event_id=$1 AND status IN ('pending','paid')",
          [b.eventId]
        )).rows[0].n
      );
      const typeHeld = type ? Number(
        (await client.query(
          "SELECT coalesce(sum(quantity),0) AS n FROM orders WHERE ticket_type_id=$1 AND status IN ('pending','paid')",
          [type.id]
        )).rows[0].n
      ) : 0;
      if (count + b.quantity * admissions > event.capacity || type && typeHeld + b.quantity > type.capacity) {
        await client.query("ROLLBACK");
        return s.status(409).json({
          error: "These tickets are currently reserved. Please try later."
        });
      }
      order = (await client.query(
        "INSERT INTO orders(id,user_id,event_id,quantity,amount,ticket_type_id,admissions,attendee_name,attendee_phone) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
        [
          b.requestId,
          q.user.id,
          b.eventId,
          b.quantity,
          (type?.price || event.price) * b.quantity,
          type?.id || null,
          admissions,
          b.name || "",
          b.phone || ""
        ]
      )).rows[0];
    }
    await client.query("UPDATE users SET full_name=$1,phone=$2 WHERE id=$3", [
      order.attendee_name,
      order.attendee_phone,
      q.user.id
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
      [order.id]
    );
    if (!claim.rows.length)
      return s.status(409).json({
        error: "Your payment order is being created or needs reconciliation. Please wait and contact the organizer before retrying."
      });
    let remoteId = "";
    if (process.env.RAZORPAY_DEV_MOCK === "true" && !production) {
      remoteId = "order_mock_" + randomBytes3(8).toString("hex");
    } else {
      const remote = await razorpay("POST", "/orders", {
        amount: order.amount,
        currency: "INR",
        receipt: order.id,
        notes: { booking_id: order.id }
      });
      remoteId = remote.id;
    }
    order = (await pool.query(
      "UPDATE orders SET razorpay_order_id=$1 WHERE id=$2 RETURNING *",
      [remoteId, order.id]
    )).rows[0];
  }
  s.json({
    orderId: order.razorpay_order_id,
    amount: order.amount,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID,
    email: q.user.email
  });
});
app.post("/api/payments/verify", auth, async (q, s) => {
  const b = z3.object({
    razorpay_order_id: z3.string().regex(/^order_\w+$/),
    razorpay_payment_id: z3.string().regex(/^pay_\w+$/),
    razorpay_signature: z3.string()
  }).parse(q.body);
  const order = (await pool.query(
    "SELECT * FROM orders WHERE razorpay_order_id=$1 AND user_id=$2",
    [b.razorpay_order_id, q.user.id]
  )).rows[0];
  if (!order) return s.sendStatus(404);
  const isMock = b.razorpay_order_id.startsWith("order_mock_") && !production;
  if (!isMock) {
    if (!signatureValid(
      process.env.RAZORPAY_KEY_SECRET || "",
      `${order.razorpay_order_id}|${b.razorpay_payment_id}`,
      b.razorpay_signature
    ))
      return s.status(400).json({ error: "Payment signature rejected." });
  }
  s.json({
    bookingId: await finalize(order.razorpay_order_id, b.razorpay_payment_id)
  });
});
app.get("/api/admin", auth, admin, async (_q, s) => {
  const events = (await pool.query(
    "SELECT e.*,coalesce(sum(o.quantity*o.admissions) FILTER(WHERE o.status='paid'),0) AS sold,coalesce(sum(o.quantity*o.admissions) FILTER(WHERE o.status='pending'),0) AS reserved,coalesce((SELECT jsonb_agg(t ORDER BY t.price,t.name) FROM ticket_types t WHERE t.event_id=e.id),'[]') AS ticket_types FROM events e LEFT JOIN orders o ON e.id=o.event_id GROUP BY e.id ORDER BY e.starts_at"
  )).rows;
  const orders = (await pool.query(
    "SELECT o.*,u.email,e.title FROM orders o JOIN users u ON u.id=o.user_id JOIN events e ON e.id=o.event_id ORDER BY o.created_at DESC LIMIT 100"
  )).rows;
  const logs = (await pool.query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100")).rows;
  const mail = (await pool.query(
    "SELECT count(*) AS pending FROM email_queue WHERE sent_at IS NULL"
  )).rows[0];
  s.json({ events, orders, logs, mail });
});
app.get("/api/admin/customers", auth, admin, async (q, s) => {
  const search = z3.string().max(120).parse(q.query.search || "");
  const offset = z3.coerce.number().int().min(0).max(1e6).parse(q.query.offset || 0);
  const customers = (await pool.query(
    `SELECT u.id,u.email,u.full_name,u.phone,u.created_at,count(o.id)::int AS bookings,
    count(o.id) FILTER(WHERE o.status='paid')::int AS paid_bookings,
    coalesce(sum(o.amount) FILTER(WHERE o.status='paid'),0) AS paid_amount,
    max(o.created_at) AS last_booking FROM users u LEFT JOIN orders o ON o.user_id=u.id
    WHERE u.email ILIKE $1 OR u.full_name ILIKE $1 OR u.phone ILIKE $1
    GROUP BY u.id ORDER BY u.created_at DESC,u.id LIMIT 101 OFFSET $2`,
    ["%" + search + "%", offset]
  )).rows;
  s.json({
    customers: customers.slice(0, 100),
    hasMore: customers.length > 100
  });
});
var eventSchema = z3.object({
  title: z3.string().trim().min(2).max(120),
  city: z3.string().trim().min(2).max(80),
  venue: z3.string().trim().min(2).max(160),
  starts_at: z3.iso.datetime({ offset: true }),
  price: z3.number().int().min(100).max(1e7),
  capacity: z3.number().int().min(1).max(1e5),
  sales_open: z3.boolean()
});
async function adminTransaction(q, action) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT set_config('twktk.actor',$1,true)", [q.user.email]);
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
app.post("/api/admin/events", auth, admin, async (q, s) => {
  const b = eventSchema.parse(q.body);
  b.sales_open = false;
  const id = randomUUID3();
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
        b.sales_open
      ]
    );
    const cityPrices = originalPrices[/mumbai/i.test(b.city) ? "mumbai" : /bangalore|bengaluru/i.test(b.city) ? "bangalore" : "delhi"];
    for (const [index, name] of categoryNames.entries())
      await c.query(
        "INSERT INTO ticket_types(event_id,name,price,capacity,admissions) VALUES($1,$2,$3,$4,$5)",
        [
          id,
          name,
          index === 0 ? b.price : cityPrices[index],
          name === "TABLES STARTING" ? Math.max(1, Math.floor(b.capacity / 6)) : b.capacity,
          name === "TABLES STARTING" ? 6 : 1
        ]
      );
  });
  s.json({ id });
});
app.patch("/api/admin/events/:id", auth, admin, async (q, s) => {
  const id = z3.uuid().parse(q.params.id), b = eventSchema.partial().parse(q.body);
  if (!Object.keys(b).length) return s.sendStatus(400);
  const result = await adminTransaction(q, async (c) => {
    const old = (await c.query("SELECT * FROM events WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!old) return { error: "Gathering not found." };
    const event = { ...old, ...b };
    const held = Number(
      (await c.query(
        "SELECT coalesce(sum(quantity*admissions),0) AS n FROM orders WHERE event_id=$1 AND status IN ('pending','paid')",
        [id]
      )).rows[0].n
    );
    if (event.capacity < held)
      return {
        error: "Capacity cannot be lower than sold and reserved tickets."
      };
    if (event.sales_open && (event.venue === "Venue to be announced" || !payReady()))
      return {
        error: "Confirm a venue and configure Razorpay before opening sales."
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
        id
      ]
    );
    if (b.sales_open === true) {
      const openCount = Number(
        (await c.query(
          "SELECT count(*) AS n FROM ticket_types WHERE event_id=$1 AND sales_open=true",
          [id]
        )).rows[0].n
      );
      if (openCount === 0) {
        await c.query(
          "UPDATE ticket_types SET sales_open=true WHERE event_id=$1",
          [id]
        );
      }
    }
    if (b.price !== void 0)
      await c.query(
        "UPDATE ticket_types SET price=$1 WHERE event_id=$2 AND name='GENERAL ACCESS'",
        [b.price, id]
      );
    return { ok: true };
  });
  s.status(result.error ? 409 : 200).json(result);
});
app.patch(
  "/api/admin/ticket-types/:id",
  auth,
  admin,
  async (q, s) => {
    const id = z3.uuid().parse(q.params.id), b = z3.object({
      price: z3.number().int().min(100).max(1e7),
      capacity: z3.number().int().min(1).max(1e5),
      sales_open: z3.boolean()
    }).parse(q.body);
    const result = await adminTransaction(q, async (c) => {
      const type = (await c.query("SELECT * FROM ticket_types WHERE id=$1", [id])).rows[0];
      if (!type) return { error: "Category not found." };
      await c.query("SELECT id FROM events WHERE id=$1 FOR UPDATE", [
        type.event_id
      ]);
      const held = Number(
        (await c.query(
          "SELECT coalesce(sum(quantity),0) AS n FROM orders WHERE ticket_type_id=$1 AND status IN ('pending','paid')",
          [id]
        )).rows[0].n
      );
      if (b.capacity < held)
        return {
          error: "Inventory cannot be lower than sold and reserved units."
        };
      await c.query(
        "UPDATE ticket_types SET price=$1,capacity=$2,sales_open=$3 WHERE id=$4",
        [b.price, b.capacity, b.sales_open, id]
      );
      if (type.name === "GENERAL ACCESS")
        await c.query("UPDATE events SET price=$1 WHERE id=$2", [
          b.price,
          type.event_id
        ]);
      return { ok: true };
    });
    s.status(result.error ? 409 : 200).json(result);
  }
);
app.post("/api/admin/check-in", auth, admin, async (q, s) => {
  const id = z3.uuid().parse(q.body.ticketId);
  const row = await adminTransaction(
    q,
    async (c) => (await c.query(
      "UPDATE tickets t SET checked_in_at=now() FROM orders o WHERE t.id=$1 AND t.order_id=o.id AND o.status='paid' AND t.checked_in_at IS NULL RETURNING t.id",
      [id]
    )).rows[0]
  );
  if (!row)
    return s.status(409).json({ error: "Ticket not found or already checked in." });
  s.json({ ok: true });
});
app.post("/api/admin/email/retry", auth, admin, async (q, s) => {
  await adminTransaction(
    q,
    (c) => c.query(
      "UPDATE email_queue SET attempts=0 WHERE sent_at IS NULL AND attempts>=10"
    )
  );
  s.json({ ok: true });
});
app.post(
  "/api/admin/payments/reconcile",
  auth,
  admin,
  async (q, s) => {
    const id = z3.uuid().parse(q.body.bookingId);
    let order = (await pool.query("SELECT * FROM orders WHERE id=$1", [id])).rows[0];
    if (!order) return s.sendStatus(404);
    if (!order.razorpay_order_id && q.body.providerOrderId) {
      const providerId = z3.string().regex(/^order_\w+$/).parse(q.body.providerOrderId), remote = await razorpay("GET", `/orders/${providerId}`);
      if (remote.receipt !== order.id || remote.amount !== order.amount || remote.currency !== "INR")
        return s.status(409).json({
          error: "Provider order receipt or amount does not match this booking."
        });
      await adminTransaction(
        q,
        (c) => c.query(
          "UPDATE orders SET razorpay_order_id=$1 WHERE id=$2 AND razorpay_order_id IS NULL",
          [providerId, id]
        )
      );
      order = (await pool.query("SELECT * FROM orders WHERE id=$1", [id])).rows[0];
    }
    if (!order.razorpay_order_id)
      return s.status(409).json({
        error: "Review the receipt in Razorpay and enter its order ID. Do not create a second charge."
      });
    const data = await razorpay(
      "GET",
      `/orders/${order.razorpay_order_id}/payments`
    ), captured = data.items?.find((p) => capturedPaymentMatches(p, order));
    if (!captured)
      return s.status(409).json({
        error: "Razorpay has not confirmed a captured payment for this order."
      });
    s.json({ bookingId: await finalize(order.razorpay_order_id, captured.id) });
  }
);
app.get("/api/admin/export", auth, admin, async (_q, s) => {
  const c = await pool.connect(), workbook = new ExcelJS.Workbook();
  workbook.creator = "TWKTK";
  workbook.created = /* @__PURE__ */ new Date();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    for (const [name, sql] of [
      [
        "Bookings",
        "SELECT o.id,u.email,o.attendee_name,o.attendee_phone,e.title,e.city,tt.name AS category,o.quantity,o.quantity*o.admissions AS guest_count,o.amount/100.0 AS amount_inr,o.status,o.razorpay_order_id,o.payment_id,o.created_at FROM orders o JOIN users u ON u.id=o.user_id JOIN events e ON e.id=o.event_id LEFT JOIN ticket_types tt ON o.ticket_type_id=tt.id ORDER BY o.created_at"
      ],
      [
        "Tickets",
        "SELECT t.*,o.user_id FROM tickets t JOIN orders o ON o.id=t.order_id ORDER BY t.order_id,t.ordinal"
      ],
      ["Gatherings", "SELECT * FROM events ORDER BY starts_at"],
      [
        "Customers",
        "SELECT u.id,u.email,u.full_name,u.phone,u.created_at,count(o.id)::int AS bookings,count(o.id) FILTER(WHERE o.status='paid')::int AS paid_bookings,coalesce(sum(o.amount) FILTER(WHERE o.status='paid'),0)/100.0 AS paid_amount_inr FROM users u LEFT JOIN orders o ON o.user_id=u.id GROUP BY u.id ORDER BY u.created_at"
      ],
      [
        "Ticket categories",
        "SELECT * FROM ticket_types ORDER BY event_id,price"
      ],
      ["Audit history", "SELECT * FROM audit_logs ORDER BY id"]
    ]) {
      const result = await c.query(sql);
      addExportSheet(
        workbook,
        name,
        result.fields.map((field) => field.name),
        result.rows
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
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  s.set(
    "Content-Disposition",
    `attachment; filename="TWKTK-records-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.xlsx"`
  );
  await workbook.xlsx.write(s);
  s.end();
});
app.use(
  "/api",
  (_q, s) => s.status(404).json({ error: "Endpoint not found." })
);
app.get(
  "/assets/models/player-web.glb",
  (_q, s) => s.sendFile(path3.join(root, "assets/models/player-web.glb"))
);
for (const folder of ["brand", "images", "audio"])
  app.use(
    `/assets/${folder}`,
    express.static(path3.join(root, "assets", folder), {
      dotfiles: "deny",
      maxAge: "1d",
      index: false
    })
  );
app.use(
  express.static(path3.join(root, "dist"), { dotfiles: "deny", index: false })
);
app.get(
  ["/world", "/world.html"],
  (_q, s) => s.sendFile(path3.join(root, "dist/index.html"))
);
app.get("/", (_q, s) => s.sendFile(path3.join(root, "dist/index.html")));
app.get(
  "/admin",
  (_q, s, next) => {
    s.set("Cache-Control", "no-store");
    next();
  },
  auth,
  admin,
  (_q, s) => s.sendFile(path3.join(root, "dist/portal.html"))
);
if (!production && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)) {
  app.get(
    "/admin-preview",
    (_q, s) => s.sendFile(path3.join(root, "dist/portal.html"))
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
    "/refunds"
  ],
  (_q, s) => s.sendFile(path3.join(root, "dist/portal.html"))
);
app.use((err, _q, s, _next) => {
  if (err instanceof z3.ZodError)
    return s.status(400).json({ error: "Please check the details you entered." });
  console.error("Request failed:", err instanceof Error ? err.name : "Unknown");
  s.status(503).json({
    error: "This service is temporarily unavailable. If you paid, do not pay again; your confirmation may be delayed."
  });
});
var sending = false;
var timer = setInterval(async () => {
  if (sending) return;
  sending = true;
  try {
    await flushMail();
    if (databaseReady())
      await pool.query(
        "DELETE FROM login_tokens WHERE expires_at<now(); DELETE FROM sessions WHERE expires_at<now(); DELETE FROM oauth_states WHERE expires_at<now()"
      );
  } catch {
  } finally {
    sending = false;
  }
}, 3e4);
timer.unref();
if (!process.env.VERCEL) {
  app.listen(
    Number(process.env.PORT || 8140),
    "0.0.0.0",
    () => console.log(`TWKTK server ready on port ${process.env.PORT || 8140}`)
  );
}
var app_default = app;

// server/vercel-entry.ts
function handler(req, res) {
  const matchedPath = req.headers["x-matched-path"] || req.url || "/";
  if (matchedPath && matchedPath !== "/api/index") {
    req.url = matchedPath;
  }
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/?")) {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }
  return app_default(req, res);
}
export {
  handler as default
};
