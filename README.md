# TWKTK Festival Platform

The official TWKTK (Those Who Know They Know) full-stack festival platform. Built with a high-performance **Three.js** 3D interactive world, **React 19** customer & admin portal, and a production **TypeScript / Express** backend with **PostgreSQL**, **Razorpay** checkout, and **SMTP** transactional ticketing.

---

## ⚡ Quick Answers

### Why are we running 2 servers in `pnpm dev`?

In local development, `pnpm dev` runs:
```bash
concurrently "tsx watch server/app.ts" "vite --host 127.0.0.1"
```

1. **Server 1: Vite Dev Server (`http://127.0.0.1:5173`)**
   - Serves the frontend (Three.js 3D world, React 19 portal, Tailwind/CSS, and assets).
   - Provides instant **Hot Module Replacement (HMR)** so code changes update instantly in the browser without full reloads.

2. **Server 2: Express API Server (`http://127.0.0.1:8140`)**
   - Runs the backend API (`/api/*`).
   - Connects to PostgreSQL, manages sessions/cookies, generates Razorpay orders, verifies payment signatures & webhooks, and queues transactional emails.

3. **How they talk to each other in dev:**
   - In `vite.config.ts`, Vite includes a reverse proxy that forwards all `/api/*` and `/assets/*` requests directly to `http://127.0.0.1:8140`.
   - You only open `http://localhost:5173` in your browser. All backend API calls work seamlessly with zero CORS issues.

> 💡 **In Production on Vercel, you DO NOT run 2 servers.**  
> Vercel hosts the frontend as optimized static assets on its global Edge CDN (`dist/`) and executes the Express backend as a Serverless Function (`api/index.ts`) for all `/api/*` routes.

---

These credentials are saved in `.env` for local testing and must also be added into your Vercel Project Environment Variables.

---

## 🚀 Production Hosting on Vercel (Step-by-Step)

The project includes pre-configured Vercel integration via:
- [vercel.json](file:///Users/piyush/Desktop/mayank/vercel.json): Defines the build output (`dist`), routes `/api/(.*)` to the serverless function handler, and routes frontend pages (`/admin`, `/login`, `/portal.html`, `/world`, `/index.html`).
- [api/index.ts](file:///Users/piyush/Desktop/mayank/api/index.ts): Bridges Vercel serverless requests into the Express application.

---

### Step 1: Provision a Managed PostgreSQL Database

> [!IMPORTANT]
> Vercel is a **serverless** environment. Ephemeral local storage (`/tmp` or `.data`) resets between cold starts. You **MUST** use a persistent cloud PostgreSQL database in production (e.g., [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)).

1. Create a free or production database on Neon, Supabase, or AWS RDS.
2. Copy the pooled connection string, for example:
   ```text
   postgres://username:password@ep-cool-db.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

---

### Step 2: Run Database Migrations

Apply the database schema and initial festival data to your remote database:

```bash
# In your local terminal, point DATABASE_URL to your remote PostgreSQL instance:
DATABASE_URL="postgres://username:password@your-db-host/dbname?sslmode=require" pnpm run migrate
```

This creates the tables (`events`, `ticket_categories`, `orders`, `tickets`, `users`, `sessions`, `email_queue`, `audit_logs`) and applies immutability triggers.

---

### Step 3: Deploy Project to Vercel

1. **Push your code to GitHub / GitLab**.
2. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New... → Project"**.
3. Import your Git repository.
4. Set the project configuration:
   - **Framework Preset**: `Vite` (or `Other`)
   - **Root Directory**: `./`
   - **Build Command**: `pnpm run build` (or `npm run build`)
   - **Output Directory**: `dist`
   - **Install Command**: `pnpm install` (or `npm install`)

---

### Step 4: Configure Production Environment Variables in Vercel

Under **Project Settings → Environment Variables**, add:

| Key | Value / Description | Environment |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Production |
| `APP_URL` | `https://www.thosewhoknowtheyknow.com` (or your assigned `.vercel.app` URL initially) | Production |
| `DATABASE_URL` | Your remote PostgreSQL connection string (from Step 1) | Production, Preview |
| `DATABASE_SSL` | `true` | Production, Preview |
| `TRUST_PROXY_HOPS` | `1` | Production, Preview |
| `ADMIN_EMAILS` | `mayank@emergencenetwork.in` | Production, Preview |
| `CONTACT_EMAIL` | `mayank@emergencenetwork.in` | Production, Preview |
| `RAZORPAY_KEY_ID` | `rzp_test_ToW7BPeKuvvWRg` (or live key `rzp_live_...` for real sales) | Production, Preview |
| `RAZORPAY_KEY_SECRET` | `2d5dgJBckneeXT4Xc4PLIOLr` (or live secret) | Production, Preview |
| `RAZORPAY_WEBHOOK_SECRET` | `TWKTK@2006` | Production, Preview |
| `RAZORPAY_DEV_MOCK` | `false` | Production, Preview |
| `SMTP_HOST` | e.g. `smtp.resend.com` or `smtp.sendgrid.net` | Production |
| `SMTP_PORT` | `587` | Production |
| `SMTP_USER` | Your SMTP username / API key | Production |
| `SMTP_PASS` | Your SMTP password / secret | Production |
| `MAIL_FROM` | `TWKTK <tickets@thosewhoknowtheyknow.com>` | Production |
| `GOOGLE_CLIENT_ID` | *(Optional)* Google OAuth Client ID | Production |
| `GOOGLE_CLIENT_SECRET`| *(Optional)* Google OAuth Client Secret | Production |

> [!NOTE]
> During initial staging, if testing without a custom domain, set `APP_URL` to `https://<your-project-name>.vercel.app`. The server validates `APP_URL` against the request origin for security.

Click **Deploy**.

---

### Step 5: Configure Custom Domain & SSL on Vercel

1. In Vercel, go to **Settings → Domains**.
2. Add `www.thosewhoknowtheyknow.com` and `thosewhoknowtheyknow.com`.
3. In your DNS manager (e.g., GoDaddy, Cloudflare):
   - For `www`: Add a **CNAME** pointing to `cname.vercel-dns.com`
   - For root `@`: Add an **A record** pointing to `76.76.21.21` (or redirect apex to `www`).
4. Wait for Vercel to issue the automatic Let's Encrypt SSL certificate.

---

### Step 6: Configure Razorpay Webhooks

1. Log into your [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Navigate to **Account & Settings → Webhooks**.
3. Click **Add New Webhook**:
   - **Webhook URL**: `https://www.thosewhoknowtheyknow.com/api/webhooks/razorpay`
   - **Secret**: `TWKTK@2006`
   - **Alert Email**: `mayank@emergencenetwork.in`
   - **Active Events**: Check `payment.captured` and `order.paid`.
4. Click **Create Webhook**.

---

### Step 7: Post-Deployment Smoke Test & Verification

1. **Health Check**:
   Visit `https://www.thosewhoknowtheyknow.com/api/healthz` — verify it returns `{ status: "ok" }`.
2. **Admin Portal**:
   Navigate to `https://www.thosewhoknowtheyknow.com/admin`. Log in using `mayank@emergencenetwork.in`. Verify that event inventory and categories are editable.
3. **Checkout Flow**:
   Select a ticket in the 3D world or booking dialog. Complete a checkout using Razorpay Test Mode.
4. **Webhook & Ticket Issuance**:
   Confirm that the order status transitions to `paid`, the ticket QR/code is generated, and a confirmation email is dispatched.

---

## 🛠 Local Development & Testing

```bash
# Install dependencies
pnpm install

# Run dev servers (Vite 5173 + API 8140)
pnpm dev

# Run automated tests
pnpm test

# Build for production
pnpm run build
```

---

## 🔒 Security Architecture Highlights

- **Anti-tamper immutability**: PostgreSQL triggers prevent deletion of orders, tickets, and audit trails.
- **Strict Razorpay signature verification**: Every payment callback and webhook is verified via HMAC-SHA256.
- **Idempotent processing**: Duplicate callbacks or webhook retries converge on the exact same booking record without duplicate ticket creation.
- **Secure Sessions**: HTTP-only, SameSite=Strict cookies with cryptographic tokens.
- **Production Safety**: Startup aborts if `APP_URL` is non-HTTPS or required database/email configs are missing.
