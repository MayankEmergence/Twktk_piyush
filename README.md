# TWKTK — festival platform

The original TWKTK globe-to-city-to-bus-to-venue experience, bundled with Vite and Three.js, plus React/TypeScript account and admin pages and a TypeScript/Express backend, managed PostgreSQL, SMTP email sign-in and Razorpay Standard Checkout. Runtime business data is stored in the hosted database. There is no JSON store, Apps Script backend, browser session storage, offline mode, service worker or exposed project-root file server.

## Included

- Sign up/log in with a password, verified email link or Google (requires a Google OAuth client configured in hosting). Checkout locks the verified account email, collects name/phone and reuses customer profile details. Admins have a searchable, paginated customer list and a full customer sheet in Excel exports. The admin page and APIs require admin authorization; public visitors see no admin link.

- The original black, red and white branding, globe city selection, orbital descent, TWKTK-branded bus journey past the landmarks of Mumbai, Delhi and Bengaluru, warehouse arrival, museum and festival floor.
- All original map locations, 22 zones, interactive stalls, mini/full maps, teleport points, galleries, arcade games, wardrobe and lounge interactions are retained in src/experience/world.js. Fixes include bus cabin look rotation, audio scheduler backlog, quality resize handling, lost movement keys, touch cancellation, custom-model walking/seating and a VIP floor height correction. The Earth now has a real surface texture. The supplied character is optimized from 98.4 MB to 5.7 MB; the original remains a source asset and is not served publicly.
- Password signup/login with salted scrypt hashes, verified email activation, matching password validation and terms acceptance. Google and single-use email links remain available. Sessions use secure HTTP-only cookies: browser-session/eight hours normally, or 30 days with Remember me.
- Delhi on **31 October 2026** and Bengaluru on **1 November 2026**. Both start with sales closed until hosting and event details are configured. Category prices match the original website, with 200 editable inventory units per category (2,200 total admissions including tables for six). The 18:00 start time remains a draft. Public pages display prices while checkout stays closed when services are unconfigured.
- Admin account: **mayank@emergencenetwork.in**. `/admin` lets that signed-in account create events, edit dates/venues/prices/capacity, open/close sales, check in tickets, review bookings, retry failed email deliveries, reconcile delayed payments and export a multi-sheet Excel workbook.
- The original six ticket categories are managed in the admin with separate prices and inventory. TABLES STARTING issues six guest tickets per purchased table and consumes six places in total venue capacity. Other categories issue one guest ticket per unit. Setup category prices are drafts; all sales remain closed until configured.
- No admin delete controls. PostgreSQL triggers reject deletion of events, bookings, tickets, users and email delivery records. Audit rows reject updates and deletion. Changes append old/new values and admin identity. Previously purchased quantities and amounts cannot be rewritten.
- Razorpay server-created orders, signature verification, amount/currency/account checks, captured-payment checks and idempotent ticket issuance. Callback and webhook confirmations converge on the same transaction.
- Confirmation email queued in the same database transaction as ticket issuance. Failed deliveries retry up to ten times, survive restarts and are visible as pending to the admin. A mail server can deliver a message before a connection fails, so rare duplicate emails are possible; tickets are not duplicated.

## Hosting

Your selected host is Hostinger: follow [HOSTINGER.md](HOSTINGER.md) and upload the prepared `TWKTK-hostinger.zip`. Use the Node.js web app service with a hosted PostgreSQL database, email provider and replacement live Razorpay secrets. The local [admin preview](http://localhost:8140/admin-preview) uses sample records and never bypasses the connected admin's authentication. Original category prices are retained, and initial inventory is 200 units per category, editable in the dashboard. **The project is prepared for deployment, not already deployed.** [HOSTING.md](HOSTING.md) has the operational verification steps; `render.yaml` remains available as an alternative host configuration.

The supplied Razorpay test key ID is configured. Its private secret was shared in chat; rotate it and enter the replacement directly in hosting settings. Do not commit it. Configure the Razorpay webhook at:

`https://www.thosewhoknowtheyknow.com/api/webhooks/razorpay`

Subscribe to `payment.captured` and `order.paid` and set the same signing secret in `RAZORPAY_WEBHOOK_SECRET`. Test-mode payments are not real ticket sales. Switch both keys and the webhook configuration to live mode only after your test transaction, provider account activation and event/policy review.

## Development and verification

Requires Node 22 or newer. `npm ci`, `npm run build`, `npm test`. `npm run dev` serves the interface at `http://localhost:5173`; the API runs at port 8140. Provide development settings through process environment, with `APP_URL=http://localhost:5173`. For a production build preview, use `APP_URL=http://localhost:8140 npm start` (set the environment in your shell). The original globe and city journey run without account credentials, but accounts and payments return explicit unavailable responses until configured. This does not store visitor records locally.

`npm run migrate` applies the idempotent PostgreSQL schema and seeds the two drafts. Run migrations before starting a deployed service. Production startup refuses missing database, admin and SMTP configuration. The migration login owns schema; for stronger separation, use a restricted application role after migration with only SELECT/INSERT/UPDATE on business tables, SELECT/INSERT on audit_logs and DELETE only on login_tokens/sessions. Schema owners can bypass triggers; application immutability does not replace independent managed backups or a separate audit archive.

## Operational limits

- Pending reservations remain counted until resolved; no automatic inventory release is attempted because late payment capture must not oversell an event. Use CHECK PAYMENT in the admin area to reconcile captured payments. If order creation timed out, locate the receipt matching the displayed booking ID in Razorpay and enter the matching provider order ID; the backend verifies its receipt, amount and currency before linking it. The app blocks automatic second creation after an ambiguous timeout. This conservative policy can tie up capacity.
- Rate limits are process-local. Run one app instance initially; before adding replicas, use shared rate-limit storage. A CDN/WAF can provide additional traffic controls.
- Refunds must be performed through Razorpay and recorded in your accounting workflow. The app currently handles sales and entry, not automated refunds or tax invoices.
- Policy pages are organizer-review drafts. Publish final business identity, contact, age restrictions, event rules, cancellation/refund terms and retention policy before live payments.
- Database/SMTP/Razorpay production round trips and DNS require configured external accounts; local checks cannot certify those integrations or guarantee perfect security.

Only `/assets/brand`, `/assets/images`, the optimized `/assets/models/player-web.glb`, `/assets/audio` and built client files are public. Environment files, source, documentation and database records cannot be fetched through static routes.

Signed-in wardrobe preferences, arcade scores and guide state are stored in PostgreSQL world_profiles. Guests retain only temporary in-memory preferences for the current visit. Existing legacy data under server/data and ignored backups has been preserved for migration and is never served publicly.
The native Node production build and tests were verified locally. Docker image execution was not verified because the local Docker daemon was unavailable; the default Render Blueprint uses native Node hosting.
