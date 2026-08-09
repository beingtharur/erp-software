# Production Deployment Status (EC2)

Date recorded: 09 Aug 2026. **Verification note:** the Purchase Order numbering fix and its
commit hash (`ef137cef5b27bbe918fcc2772889fc6e4d940f0e`) are independently confirmed —
checked directly against local git history, diff matches exactly, at both file locations
described below. The schema-reconciliation, PM2, and live health-check sections reflect
what was reported from direct work on the production server; I have not personally run
commands against that server to confirm them myself. Recording as reported.

## Server Information

- Application: EOS Techno HRM ERP
- Platform: Next.js 16.2.10
- Database: SQLite (`/home/ubuntu/data/dev.db`)
- Server: AWS EC2 Ubuntu
- Public URL: http://13.50.236.200/login

## Issues Resolved

### 1. Prisma Schema vs SQLite Database Mismatch

Production database schema had drifted away from the Prisma schema. Observed errors
included:

**AuditLog table missing**
```text
The table main.AuditLog does not exist
```

**VendorPayment columns missing**
```text
The column main.VendorPayment.referenceNumber does not exist
```

**Department schema mismatch** — missing:
- `departmentId`
- `deletedAt`
- `type`

**Employee schema mismatch**
```text
Null constraint violation on field: department
```

**Budget schema mismatch**
```text
Null constraint violation on field: department
```

**Other missing indexes and constraints**, detected via:
```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
```

### 2. Database Reconciliation

Created backup:
```bash
cp /home/ubuntu/data/dev.db \
   /home/ubuntu/data/dev.db.backup
```

Generated migration diff:
```bash
npx prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script > diff.sql
```

Applied diff:
```bash
sqlite3 /home/ubuntu/data/dev.db < diff.sql
```

This reconciled: `AuditLog`, `Department`, `Employee`, `Budget`, `VendorPayment`, and
missing indexes. Database reported aligned with the Prisma schema.

### 3. Purchase Order Bug Fixed — independently verified

**Root cause:** PO numbers were generated with:
```ts
const count = await prisma.purchaseOrder.count();
const poNumber = `PO-${7000 + count + 1}`;
```
This breaks once any record has been deleted, since `count()` no longer matches the
highest existing number — e.g. 24 rows remaining but the highest is `PO-7025` (a gap left
by a deletion), so `count()` regenerates `PO-7025`, which already exists, and the insert
fails with `P2002 Unique constraint failed on poNumber`.

**Fix:**
```ts
const latest = await prisma.purchaseOrder.findFirst({
  orderBy: { poNumber: "desc" },
});
const lastNumber = latest
  ? parseInt(latest.poNumber.replace("PO-", ""), 10)
  : 7000;
const poNumber = `PO-${lastNumber + 1}`;
```

Locations: `src/lib/actions/vendor.ts`, in both `createPurchaseOrder` (~line 206) and
`duplicatePurchaseOrder` (~line 416).

Commit: `ef137cef5b27bbe918fcc2772889fc6e4d940f0e` — confirmed present in local git
history, diff matches exactly at both locations.

## PM2 Production Setup

**Problem:** the app was running via `nohup npm start`, which stopped periodically and
needed manual restarts.

**Installed PM2:**
```bash
sudo npm install -g pm2
```

**Started the app under PM2:**
```bash
pm2 start npm --name hrm -- start
```

**Port conflict encountered and resolved** — PM2 initially failed with
`EADDRINUSE: address already in use :::3000`, caused by the old `nohup` process still
holding port 3000:
```bash
ss -tulpn | grep 3000       # located the old process
pkill -f next-server        # killed it
pm2 delete hrm              # removed the broken PM2 entry
pm2 start npm --name hrm -- start   # recreated it cleanly
```

**Enabled auto-start after reboot:**
```bash
pm2 startup
sudo env PATH=$PATH:/usr/bin \
  /usr/lib/node_modules/pm2/bin/pm2 startup systemd \
  -u ubuntu --hp /home/ubuntu
pm2 save
```
Result: `/etc/systemd/system/pm2-ubuntu.service` created and enabled — PM2 now restores
the app automatically after server reboot, EC2 restart, or AWS maintenance restart.

## Deployment Workflow Going Forward

```bash
cd ~/app
git pull origin main
npm install
npx prisma generate
npm run build
pm2 restart hrm
```

Verify:
```bash
pm2 status
pm2 logs hrm --lines 50
```

(See `DEPLOYMENT_RUNBOOK.md` for the fuller version of this, including backup and
rollback steps.)

## Current Health Status

Verified:
```bash
curl -I http://localhost:3000
```
Response:
```http
HTTP/1.1 307 Temporary Redirect
location: /login
```

This confirms Next.js is running and the auth middleware redirect fires — it does **not**
by itself confirm database-touching routes (login, register, etc.) work, since that route
never queries the database. Confirm those separately by actually logging in.

## Current Production State (as reported)

- ✅ Database schema reconciled
- ✅ Department module working
- ✅ Employee module working
- ✅ VendorPayment schema fixed
- ✅ AuditLog table present
- ✅ Purchase Order numbering fixed — **independently verified via local git**
- ✅ PM2 installed
- ✅ PM2 auto-start configured
- ✅ Application survives reboot
- ✅ Production server operational

Public URL: http://13.50.236.200/login
