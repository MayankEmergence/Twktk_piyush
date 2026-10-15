# Take TWKTK online

## Preview and original ticket prices

The local `/admin-preview` page is an interactive demonstration with sample records. Its edits reset on reload; it cannot call the real admin API or take payments. This page is unavailable when the server runs in production. Sign in at `/admin` for real hosted records.

Original prices are retained: Delhi/Bengaluru General ₹1,999, VIP ₹3,999, Fan Pit ₹4,999, On Stage ₹6,999, EM Lounge ₹9,999, table for six ₹30,000. Mumbai General ₹1,999, VIP ₹4,999, Fan Pit ₹6,999, On Stage ₹9,999, EM Lounge ₹9,999, table for six ₹50,000. Mumbai needs its date and a gathering created in the dashboard. Each category can be edited under **Ticket category prices & inventory**. The box office displays prices even while sales are closed. When hosting is unconfigured, the public catalog remains closed and cannot create bookings.

The connected admin dashboard displays database, email and Razorpay mode. Connect services, confirm the event details and inventory, open each category and then open the gathering. A test key takes test payments only; use a live key and a corresponding live webhook to accept real money. The 18:00 start time is a draft value for review. Inventory starts at 200 units per category, with 2,200 total admissions because each table holds six guests; all are editable. See HOSTINGER.md for the selected hosting provider.

## 1. Accounts

Create a Render account and connect the Git repository containing this project. Choose **New → Blueprint** and select this repository so Render reads `render.yaml`. Review the service and database charges before creating them. Use always-on hosting for payments and email retries. The database is a managed service; enable backups and review retention in its dashboard.

Create a transactional email provider account with SMTP support. Verify `thosewhoknowtheyknow.com` using that provider's DNS records. Set SPF and DKIM, then DMARC according to its instructions. Use a verified sender such as `tickets@thosewhoknowtheyknow.com`. Set SMTP host, port, user, password and `MAIL_FROM` in Render. Transactional email sends login/ticket messages; a mailbox such as `hello@...` requires a separate mailbox service and its MX records.

## 2. Host settings

The Blueprint sets the database URL, admin email and domain. In the host dashboard, enter **replacement** `RAZORPAY_KEY_SECRET`, a separately chosen `RAZORPAY_WEBHOOK_SECRET`, and the SMTP settings. Use the test key ID until testing finishes. Never paste secrets into source code, browser configuration or Git.

Run the migration as the configured pre-deploy step. The host builds the React app and runs the server. After deployment, check `/healthz`, the public page and `/world`. A healthy process does not prove email/database/payment availability; run the steps below too.

## 3. GoDaddy domain

Add `www.thosewhoknowtheyknow.com` as a custom domain in Render. Copy the **exact DNS target Render gives you**. In GoDaddy's DNS page, point the `www` CNAME to that target, resolving any existing conflicting `www` record. Follow Render's displayed records for the apex domain and redirect it to `www` so all sessions and login links use the canonical URL. Keep mailbox MX records and email verification TXT/CNAME records intact. Wait for Render to verify the domain and provision HTTPS. Do not invent an IP address or DNS target.

Set `APP_URL=https://www.thosewhoknowtheyknow.com`. If testing on a temporary Render hostname first, set `APP_URL` to that exact HTTPS hostname and restore the canonical URL after DNS is ready. Origin checks deliberately permit only the configured URL.

References: [Render custom domains](https://render.com/docs/custom-domains), [GoDaddy CNAME setup](https://www.godaddy.com/en-in/help/add-a-cname-record-19236), [Render Blueprint specification](https://render.com/docs/blueprint-spec).

## 4. Razorpay

Rotate the secret shared in chat. In the Razorpay dashboard, enable automatic capture. Add webhook URL `https://www.thosewhoknowtheyknow.com/api/webhooks/razorpay`, select `payment.captured` and `order.paid`, and enter the signing secret that matches the host setting. The URL alone is not a signing secret. Review [Razorpay's integration steps](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps).

Sign in as `Mayank@emergencenetwork.in`, open `/admin`, update both draft events with final time, venue and total capacity, then configure each ticket category price and inventory, and review the policy pages. Open the gathering and desired category sales in test mode, then perform a test payment. Verify: one booking, the right number of tickets, confirmation email, Excel export, and rejection of a duplicate check-in. Replay the payment webhook to verify no duplicate tickets or confirmation queue records. Test invalid signatures and another account's order as negative cases.

After provider live activation, close sales, switch to live key ID/secret, configure a live webhook, and reopen sales. Test one authorized real purchase and its refund through the provider dashboard before a public launch.

## 5. Ongoing operations

Use the admin to adjust prices and inventory. Existing paid bookings retain their original amounts. Capacity cannot be reduced below paid plus pending quantities. Every business change is audited, and audit/business entries have no delete action. Export records regularly. Database owners still have infrastructure-level control; protect that account and keep independently retained backups.

Review pending payments against Razorpay, pending email delivery, host logs and backups. Automatic email retries stop after ten attempts; correct SMTP settings and use RETRY FAILED EMAILS in the admin area; the original queue record is preserved and the retry is audited. Do not remove transaction logs.
