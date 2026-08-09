# Deployment Runbook

Standing reference for deploying, rolling back, and recovering the production EC2
instance. Unlike `PRODUCTION_DEPLOYMENT_INCIDENT.md` (a specific incident writeup) or
`PRODUCTION_DEPARTMENT_MIGRATION_PLAN.md` (a one-off migration), this file is meant to be
reused for every future release.

**Key facts:**

| | |
|---|---|
| Repo | `/home/ubuntu/app` |
| Database | `/home/ubuntu/data/dev.db` (SQLite, via `DATA_DIR=/home/ubuntu/data`) |
| Process manager | PM2, process name `hrm` |
| Port | `3000` (internal; Caddy reverse-proxies the public site to it) |
| Public URL | http://13.50.236.200/login |

---

## 1. Standard deployment (no schema changes)

Use this when the release only touches application code — no `prisma/schema.prisma`
changes.

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
curl -I http://localhost:3000/login
```
A `200` on `/login` and no errors in the last 50 log lines is the baseline check — it does
**not** confirm database-touching routes work, since `/login`'s GET never queries the
database. Log in with a real account afterward to confirm the whole path.

If the build needs more memory:
```bash
NODE_OPTIONS="--max-old-space-size=2048" npm run build
```

---

## 2. Deployment WITH schema changes

Schema changes need the database brought in line *before* relying on new code that expects
it — do this deliberately, not as a side effect of `git pull`.

**Step 1 — always back up first** (§4).

**Step 2 — see what's actually different** between the live database and the target
schema, rather than guessing:
```bash
cd ~/app
npx prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script > /tmp/diff.sql
less /tmp/diff.sql   # READ IT before applying — this is the whole point of this step
```

**Step 3 — apply it**, once you've actually read what it's going to do:
```bash
sqlite3 /home/ubuntu/data/dev.db < /tmp/diff.sql
```

**Step 4 — verify structurally**, before touching code or restarting:
```bash
sqlite3 /home/ubuntu/data/dev.db ".tables"
sqlite3 /home/ubuntu/data/dev.db "PRAGMA table_info(<table you changed>);"
```

**Step 5 — reconcile Prisma's own migration tracking**, so a future `migrate diff`/`deploy`
doesn't get confused about what's already applied:
```bash
npx prisma migrate status
# for any migration folder that's now applied by hand, e.g.:
npx prisma migrate resolve --applied <migration_folder_name>
```

**Step 6 — deploy code and restart**, same as §1 (`git pull`, `npm install`, `npx prisma
generate`, `npm run build`, `pm2 restart hrm`).

**Step 7 — full functional check**: log in, hit every module that touched schema, not just
a `curl` on `/login`.

**If the change includes dropping/renaming a column**, do that as a *separate, later* step
after the rest is confirmed healthy, not bundled into the same window — a column no one
reads anymore is zero risk sitting unused; dropping it while anything might still reference
it is the one genuinely irreversible move in this whole process. See
`PRODUCTION_DEPARTMENT_MIGRATION_PLAN.md` for a worked example of this staging.

---

## 3. Backup

Run before **any** schema change, and periodically regardless:

```bash
BACKUP="/home/ubuntu/data/dev.db.bak-$(date +%Y%m%d%H%M%S)"
cp /home/ubuntu/data/dev.db "$BACKUP"
ls -la "$BACKUP"
```

List existing backups:
```bash
ls -la /home/ubuntu/data/*.bak* /home/ubuntu/data/*.backup* 2>/dev/null
```

Prune old ones periodically (they add up) — keep at least the last few:
```bash
ls -t /home/ubuntu/data/dev.db.bak-* 2>/dev/null | tail -n +6 | xargs -r rm
```

---

## 4. PM2 management cheat sheet

```bash
pm2 status                      # is it running, restart count, memory/CPU
pm2 logs hrm --lines 100        # recent output
pm2 logs hrm                    # live tail
pm2 restart hrm                 # restart (after a deploy)
pm2 stop hrm                    # stop without removing
pm2 start hrm                   # start again after a stop
pm2 delete hrm                  # remove the process entry entirely (rare — see §6 if port conflicts return)
pm2 monit                       # live CPU/memory dashboard
pm2 save                        # persist the current process list for the startup service
```

If PM2 fails to start with `EADDRINUSE: address already in use :::3000`, something else
(often a stray `nohup`/manual `next start`) is already holding the port:
```bash
ss -tulpn | grep 3000
pkill -f next-server
pm2 delete hrm
pm2 start npm --name hrm -- start
pm2 save
```

Auto-start after reboot was already configured (`/etc/systemd/system/pm2-ubuntu.service`)
— confirm it's still enabled if the server was ever rebuilt:
```bash
systemctl status pm2-ubuntu --no-pager
```

---

## 5. Health checks

```bash
pm2 status                                     # process up?
curl -sI http://localhost:3000/login | head -5 # 200, no error
pm2 logs hrm --lines 50 --nostream             # any errors right after restart?
```

Functional (do this after every deploy that touched anything beyond static assets):
- Log in with a real account.
- Submit a throwaway test registration.
- Load whichever module the release actually changed.

A `curl` success alone is not sufficient — routes that don't touch the database (like the
`/login` GET) will report healthy even when every database-touching action is failing.
This is the exact failure mode diagnosed in `PRODUCTION_DEPLOYMENT_INCIDENT.md`.

---

## 6. Rollback

**Code-only rollback** (no schema change involved in the bad release):
```bash
cd ~/app
git log --oneline -5            # find the last known-good commit
git checkout <previous-commit-hash>
npm install
npx prisma generate
npm run build
pm2 restart hrm
curl -sI http://localhost:3000/login | head -5
```

**Full rollback** (schema change was part of the bad release):
```bash
pm2 stop hrm
cp /home/ubuntu/data/dev.db.bak-<timestamp> /home/ubuntu/data/dev.db   # restore §3's backup
cd ~/app
git checkout <previous-commit-hash>
npm install
npx prisma generate
npm run build
pm2 start hrm
curl -sI http://localhost:3000/login | head -5
```

Then repeat the functional checks from §5 before considering the rollback complete.

---

## 7. Database recovery / schema drift

If the app is throwing `PrismaClientKnownRequestError` about a missing table/column in
production, that's schema drift — the deployed code expects a schema the live database
doesn't have yet. Diagnose before touching anything:

```bash
cd ~/app
git log -1 --format="%H %ad %s"                # what code is actually deployed
npx prisma migrate status                        # what Prisma thinks is applied
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
# ^ read this output — it tells you exactly what's missing, don't guess
```

Then follow §2 to close the gap. **Never run `prisma db push --accept-data-loss` against
this database** — with real user data present, "accept data loss" is not a phrase to wave
through; the `migrate diff --script` + manual `sqlite3` apply in §2 gives the same result
with a reviewable SQL file in between.

---

## 8. Things to always confirm, never assume

- The actual `DATA_DIR` value, from the running process's environment — don't hardcode a
  path from memory:
  ```bash
  PID=$(pgrep -f "next start" | head -1)
  tr '\0' '\n' < /proc/$PID/environ | grep DATA_DIR
  ```
- The actual deployed commit, before assuming what's live:
  ```bash
  cd ~/app && git log -1 --format="%H %ad %s"
  ```
- `SESSION_SECRET`, `DATA_DIR`, and `PAYMENT_*` live in `~/app/.env.production.local`
  (gitignored, not in version control) — back that file up separately if the server is
  ever rebuilt; it's not recoverable from git.
