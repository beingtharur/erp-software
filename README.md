# Exist Digitally — Ops Platform

A multi-tenant SaaS ops platform (CRM, HRMS, Vendor Management, GPS field tracking, Finance, Helpdesk, task management) built by [Exist Digitally](mailto:digitallyexist@gmail.com) with Next.js, TypeScript, and SQLite. Organizations get a 5-day free trial, then a monthly subscription (user-licensed + module-based) activated via manually-verified UPI/bank payment.

The demo data seeds a sample customer organization named "EOS Techno" to exercise multi-tenancy — that's a fictional *tenant* of this platform, not the platform's own name.

**Before making changes, read [`context.md`](./context.md)** — it covers the full architecture, data model, multi-tenancy design, subscription system, and several non-obvious gotchas (env vars, storage persistence, this fork's Next.js deviations) that aren't visible from skimming the code.

## Tech stack

- Next.js 16 (App Router, Turbopack) — ⚠️ this fork renames `middleware.ts` to `src/proxy.ts` and has other intentional deviations from stock Next.js; see `AGENTS.md`.
- TypeScript, Tailwind CSS v4, `@base-ui/react` primitives
- Prisma ORM + **SQLite only** (via `@prisma/adapter-better-sqlite3`) — this is a deliberate, permanent choice, not a placeholder for a "real" database
- Custom JWT-cookie auth (no NextAuth/Clerk)
- Local filesystem for both the database file and uploaded documents

There is no separate backend — this single Next.js app serves the UI, the API (via Server Actions and Server Components), and owns the database file directly.

## Local development

**1. Install dependencies**

```bash
npm install
```

**2. Set environment variables**

Copy `.env.example` to `.env.local` and set at minimum:

```bash
SESSION_SECRET="<any long random string>"   # required — the app throws at boot without it
```

`DATABASE_URL` in `.env.example` only drives the Prisma CLI (`db push`/`migrate`/`seed`) — the running app connects to `prisma/dev.db` directly (see `src/lib/db.ts`), so you don't need to set it for `npm run dev` to work, only for schema/seed commands.

The `PAYMENT_*` variables (UPI ID, bank details) are optional locally — they fall back to demo placeholder values.

**3. Set up the database**

```bash
npx prisma generate         # generate the Prisma client
npx prisma db push          # create/sync the SQLite schema at prisma/dev.db
npx tsx prisma/seed.ts      # load demo data (two organizations, sample employees/clients/leads/etc.)
```

**4. Run it**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The login page has one-click demo logins — password `demo123` for every seeded account. See `context.md` for the full list of demo logins and what each role/organization can see.

**Note:** any change to `prisma/schema.prisma` requires a full restart of `npm run dev` (not just a hot reload) — the Prisma client is cached in a global singleton that Turbopack's HMR doesn't refresh.

## Testing

```bash
npm run lint     # ESLint
npx tsc --noEmit # type check
npm run test     # Vitest unit tests
npm run build    # full production build — the strongest local check
```

## Production deployment

This app needs a **persistent, writable disk and a single long-running Node process** — it is not a drop-in fit for standard serverless platforms (Vercel Functions, Netlify Functions, AWS Lambda), because `prisma/dev.db` and uploaded documents (`src/lib/storage.ts`) are real files, and serverless platforms don't guarantee a persistent or shared filesystem across invocations.

The app is deployment-ready for a persistent-disk host via one env var, **`DATA_DIR`**: set it to wherever the host mounts a persistent volume, and both the SQLite file and uploads land there together, surviving restarts and redeploys. Leave it unset and nothing changes locally.

### Render (recommended, step by step)

**1. Push the code to GitHub.** Render deploys from a git repo — commit and push everything to `origin/main` first (ask me to do this when you're ready; it's a real push to a shared repo so I'll confirm with you before running it).

**2. Create the Web Service**

- [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service** → connect the `beingtharur/erp-software` GitHub repo, branch `main`.
- **Runtime**: Node
- **Build Command**: `npm ci && npx prisma generate && npm run build`
- **Start Command**: `npm start`
- **Instance Type**: at minimum the smallest paid tier — Render's free tier has no persistent disks, and this app needs one.

**3. Add a persistent disk**

In the service's **Settings → Disks** tab, add a disk:
- **Mount Path**: `/data`
- **Size**: 1 GB is plenty to start (grows with uploaded documents/screenshots over time — bump it later if needed).

**4. Set environment variables**

In **Settings → Environment**:

| Key | Value |
|---|---|
| `DATA_DIR` | `/data` |
| `SESSION_SECRET` | a long random string (e.g. output of `openssl rand -base64 32`) |
| `PAYMENT_UPI_ID` | your real UPI ID |
| `PAYMENT_ACCOUNT_NAME` | your real account holder name |
| `PAYMENT_BANK_NAME` | your real bank name |
| `PAYMENT_ACCOUNT_NUMBER` | your real account number |
| `PAYMENT_IFSC` | your real IFSC code |

**5. Deploy**

Render builds and starts the service automatically once it's created. You'll get a URL like `https://erp-software.onrender.com` — that's what you send the client. Add a custom domain later under **Settings → Custom Domains** if you have one.

**6. First-time database setup (once, after the first successful deploy)**

The persistent disk starts empty — there's no schema and no data on it yet. Open the service's **Shell** tab in the Render dashboard and run:

```bash
DATA_DIR=/data npx prisma db push
```

This creates the SQLite schema directly on the mounted disk. **Do not run the demo seed script (`prisma/seed.ts`) in production** — it wipes and reloads fake demo data, which is fine locally but wrong for a real client-facing deployment. Instead, use `/register` on your live URL to create the first real organization + admin account.

From then on, every push to `main` triggers a new Render deploy automatically; the disk (and everything on it) persists across deploys untouched.

### Alternative: a VPS or Docker on any host with volume support

Also works with zero code changes if you'd rather self-host than use Render — same `DATA_DIR` mechanism.

**Docker:**

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t eostechno-platform .
docker run -d \
  -p 3000:3000 \
  -e DATA_DIR="/data" \
  -e SESSION_SECRET="<generate a long random secret>" \
  -e PAYMENT_UPI_ID="yourcompany@upi" \
  -e PAYMENT_ACCOUNT_NAME="Your Company Pvt Ltd" \
  -e PAYMENT_BANK_NAME="Your Bank" \
  -e PAYMENT_ACCOUNT_NUMBER="..." \
  -e PAYMENT_IFSC="..." \
  -v eostechno_data:/data \
  --name eostechno \
  eostechno-platform
```

One volume at `/data` covers both the SQLite file and uploaded documents — losing it on a redeploy loses real data, so make sure it's a named volume, not an anonymous one that gets discarded.

**First-time setup on the server** (run once, via `docker exec -it eostechno sh`):

```bash
DATA_DIR=/data npx prisma db push
# Don't run prisma/seed.ts in production — it loads fake demo data. Use
# /register on the live site to create your first real organization instead.
```

**Plain VPS (no Docker)**, if you prefer:

```bash
git clone <repo> && cd eostechno-platform-demo
npm ci
npx prisma generate
mkdir -p /data && DATA_DIR=/data npx prisma db push
npm run build
# use a process manager so it survives reboots/crashes:
npm install -g pm2
DATA_DIR=/data pm2 start npm --name eostechno -- start
pm2 save && pm2 startup
```

Put Nginx or Caddy in front for TLS termination and to proxy port 3000 → 443.

### Alternative: Vercel (requires two architecture changes first)

Vercel Functions don't provide a persistent local disk, so the app as it stands today would appear to work at first deploy (the SQLite file gets bundled in via `outputFileTracingIncludes` in `next.config.ts`) but **writes would not reliably persist** between requests or across cold starts. To deploy on Vercel properly:

1. **Swap SQLite for a hosted SQLite-compatible database** reachable over the network — e.g. [Turso](https://turso.tech) (libSQL, wire-compatible with SQLite) — update `src/lib/db.ts` to use that adapter instead of `@prisma/adapter-better-sqlite3` with a local file path.
2. **Swap local file storage for Vercel Blob** — `src/lib/storage.ts` was deliberately written with a small `{url, storageKey}` interface (`saveFile`/`deleteFile`) specifically so this swap doesn't touch any calling code; only `storage.ts` itself needs to change to call Blob's `put()`/`del()`.

Once both are done, `vercel deploy --prod` (with `SESSION_SECRET` and `PAYMENT_*` set as Vercel environment variables) works like any other Next.js app. This repo is already linked to a Vercel project (see `.vercel/project.json`) but has **not** had these two changes applied yet.

### Environment variables required in production

| Variable | Required | Notes |
|---|---|---|
| `SESSION_SECRET` | Yes | Long random string; app won't boot without it |
| `DATA_DIR` | Yes (any persistent-disk host) | Set to the mounted volume's path, e.g. `/data` |
| `PAYMENT_UPI_ID` | Recommended | Falls back to a fake demo UPI ID otherwise |
| `PAYMENT_ACCOUNT_NAME` | Recommended | Falls back to a fake demo company name |
| `PAYMENT_BANK_NAME` | Recommended | Falls back to a fake demo bank |
| `PAYMENT_ACCOUNT_NUMBER` | Recommended | Falls back to a fake demo account number |
| `PAYMENT_IFSC` | Recommended | Falls back to a fake demo IFSC |
