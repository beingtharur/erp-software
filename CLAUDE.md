@AGENTS.md

# Exist Digitally — Ops Platform (ERP)

Multi-tenant ERP covering **CRM, HRMS, Vendor Management, GPS/Field Tracking, and Finance**, built with subscription billing on top. This document is an exhaustive functional reference: every page, server action, query function, and interactive UI control in the codebase, plus the business rules (and known gaps) embedded in them. File paths are relative to the repo root unless stated otherwise.

## Tech stack

- **Next.js 16** (App Router, Server Actions), **React 19**, **TypeScript**.
- **Prisma 7** ORM — SQLite in dev (`better-sqlite3` adapter), Postgres adapter available (`@prisma/adapter-pg`) for production. Client generated to `src/generated/prisma`.
- **shadcn/ui** components (Base UI primitives) + **Tailwind v4**.
- **jose** for JWT session cookies, Node `crypto.scryptSync` for password hashing.
- **Leaflet / react-leaflet** for the live GPS map, **Recharts** for dashboard charts, **qrcode** for UPI payment QR codes, **sonner** for toasts.
- **Vitest** for tests. Scripts: `dev`, `build`, `start`, `lint`, `test`, `postinstall: prisma generate`.

## Roles & access model

- `AccessRole` enum: `ADMIN, SALES, FIELD, HR, PROCUREMENT, FINANCE` — one role per `User`, scoped to their `Organization`.
- `isSuperAdmin` (boolean on `User`) is a **separate, platform-level** flag, orthogonal to `AccessRole`. Super-admins have `organizationId: null`, are routed to `/platform-admin`, and never see an org-scoped page. An org's `ADMIN` never has `isSuperAdmin`.
- `roleSectionAccess` (`src/lib/nav.ts`) maps each role to the nav sections it can see: `ADMIN` → all 5 (crm, hrms, vendors, field, finance); `SALES` → `[crm]`; `FIELD` → `[field]`; `HR` → `[hrms]`; `PROCUREMENT` → `[vendors]`; `FINANCE` → `[finance]`.
- `roleHome`: default landing route per role — `ADMIN "/"`, `SALES "/crm"`, `FIELD "/field"`, `HR "/hrms"`, `PROCUREMENT "/vendors"`, `FINANCE "/finance"`.
- `roleLabel`: display names — Admin, Sales Rep, Field Crew, HR, Procurement, Finance.
- Access is **double-gated** per module: (1) org-level — does the org's active plan/trial include the module (`Subscription.modules` or "all" during trial); (2) user-level — does this specific user have a `UserModuleAccess` row for it (auto-seeded to the role's defaults on creation/role-change, purely additive — role changes never revoke previously-granted extras).
- "Manager" is not a stored role — anywhere the app needs to know if someone is a manager (e.g. task assignment, team daily summaries) it simply checks `Employee.count({ reportingToId: employeeId }) > 0` against the org-chart hierarchy.

---

## Data model (`prisma/schema.prisma`)

**Multi-tenancy**: every tenant is one `Organization` row. Root models with no parent to scope through (`User`, `Employee`, `Client`, `Vendor`, `GeofenceZone`) carry `organizationId` directly; everything else is scoped transitively through those FKs in queries (e.g. `LeaveRequest` via `employee.organizationId`) rather than duplicating the column onto all ~27 models.

**Auth**: `User` (email, passwordHash/Salt, accessRole, optional 1:1 `employeeId`, optional `organizationId`, `isSuperAdmin`). `Notification` (userId, message, href?, read).

**HRMS**: `Employee` (employeeCode, name, role: `EmployeeRole` enum [`INSTALLATION_CREW, TECHNICIAN, SALES_REP, ENGINEER, PROJECT_MANAGER, ADMIN, HR, FINANCE`], department, email, phone, dateOfJoining, status: `EmployeeStatus` [`ACTIVE, ON_LEAVE, INACTIVE`], baseLocation, self-referential `reportingToId`/`directReports`). `Attendance` (unique `[employeeId, date]`, checkIn/checkOut, status: `AttendanceStatus` [`PRESENT, ABSENT, HALF_DAY, ON_LEAVE, HOLIDAY`], hoursWorked). `LeaveRequest` (type: `LeaveType` [`SICK, CASUAL, EARNED, UNPAID`], days, status: `LeaveStatus` [`PENDING, APPROVED, REJECTED`]). `PayrollRecord` (unique `[employeeId, month, year]`, basicSalary, allowances, deductions, netPay, status: `PayrollStatus` [`PROCESSED, PENDING`]). `Timesheet` (projectId?, date, hoursLogged, taskDescription, billable). `EmployeeDocument` (type: `DocumentType` [`ID_PROOF, OFFER_LETTER, CONTRACT, CERTIFICATE, OTHER`], fileName, fileUrl, storageKey, fileSize, uploadedById).

**CRM**: `Client` (industry: `Industry` [`PHARMACEUTICALS, CHEMICALS, COSMETICS, BIOTECH, FOOD_AND_BEVERAGE`], tier (free text), city, state, contact fields, status (free-text string, default `"Active"`)). `Lead` (source: `LeadSource` [`RFQ, TENDER, REFERRAL, WEBSITE, EXHIBITION`], productLine: `ProductLine` [`PROCESS_EQUIPMENT, CONTAINMENT_SYSTEMS, PIPING_DISTRIBUTION, TURNKEY_PROJECTS`], stage: `LeadStage` [`NEW, QUALIFIED, QUOTATION_SENT, NEGOTIATION, WON, LOST`], value, probability, expectedCloseDate, ownerId). `Quotation` (quoteNumber unique, leadId?, amount, status: `QuotationStatus` [`DRAFT, SENT, UNDER_REVIEW, APPROVED, REJECTED`], revision default 1, validUntil) + `QuotationLineItem` (description, quantity, unitPrice, amount, sortOrder). `SiteVisit` (purpose, scheduledDate, assignedToId, status: `SiteVisitStatus` [`SCHEDULED, COMPLETED, CANCELLED`], followUpDate?). `AmcContract` (contractNumber unique, equipmentCovered, startDate/endDate, value, status: `AmcStatus` [`ACTIVE, EXPIRING_SOON, EXPIRED`], lastServiceDate?, nextServiceDate?). `Project` (productLine, industry, value, startDate, targetEndDate, status: `ProjectStatus` [`PLANNING, IN_PROGRESS, COMMISSIONING, COMPLETED`], progressPercent). `Milestone` (title, dueDate, status: `MilestoneStatus` [`PLANNED, IN_PROGRESS, COMPLETED, DELAYED`], sortOrder). `ProjectTask` (milestoneId?, title, assigneeId?, status: `ProjectTaskStatus` [`TODO, IN_PROGRESS, DONE`], dueDate?). `SupportTicket` (ticketNumber unique, amcContractId?, subject, description, priority: `TicketPriority` [`LOW, MEDIUM, HIGH, CRITICAL`], status: `TicketStatus` [`OPEN, IN_PROGRESS, RESOLVED, CLOSED`], assigneeId?, resolutionNotes?, resolvedAt?).

**Vendor Management**: `Vendor` (category (free text), rating (Float), status (free text, default `"Active"`)). `PurchaseOrder` (poNumber unique, itemsDescription, amount, orderDate, expectedDelivery, status: `PoStatus` [`DRAFT, SENT, CONFIRMED, DELIVERED, CANCELLED`]). `VendorPayment` (purchaseOrderId?, amount, dueDate, paidDate?, status: `PaymentStatus` [`PENDING, PAID, OVERDUE`], method?).

**GPS & Field Tracking**: `GeofenceZone` (clientId?, projectId?, latitude, longitude, radiusMeters default 300). `LocationPing` (employeeId, latitude, longitude, timestamp, geofenceId?, isDeviceGps). `VisitLog` (employeeId, geofenceId, purpose, checkInTime, checkOutTime?, durationMinutes?, status: `VisitLogStatus` [`CHECKED_IN, CHECKED_OUT`], notes?).

**Approval Engine** (generic, reusable across entity types): `ApprovalRequest` (entityType: `ApprovalEntityType` [`PURCHASE_ORDER, EXPENSE_CLAIM, BUDGET`], entityId, requestedById, approverRole: `AccessRole`, status: `ApprovalStatus` [`PENDING, APPROVED, REJECTED`], decidedById?, decidedOn?, note?), indexed on `[entityType, entityId]` and `[status, approverRole]`.

**Personal Productivity**: `PersonalTask` (employeeId = assignee, assignedById? = manager or null for self-created, title, description?, priority: `PersonalTaskPriority` [`LOW, MEDIUM, HIGH`], status: `PersonalTaskStatus` [`TODO, IN_PROGRESS, DONE`], isBlocked, blockerNote?, dueDate?), `TaskComment` (taskId, authorId, body). `DailySummary` (unique `[employeeId, date]` — one submission per employee per day; completedNote, inProgressNote, pendingNote, blockersNote, updatesNote, nextDayPlan — all optional text).

**Finance**: `ExpenseClaim` (claimNumber unique, category: `ExpenseCategory` [`TRAVEL, MEALS, SUPPLIES, EQUIPMENT, SOFTWARE, OTHER`], amount, expenseDate, description, status: `ExpenseClaimStatus` [`PENDING, APPROVED, REJECTED, REIMBURSED`], reimbursedOn?). `Budget` (department (free text), category: `ExpenseCategory`, startDate/endDate, proposedAmount, requestedById, status: `BudgetStatus` [`PENDING, APPROVED, REJECTED`]).

**Subscription / Billing**: `Subscription` (1:1 per org — the whole trial+billing state machine; status: `SubscriptionStatus` [`TRIAL, ACTIVE, EXPIRED, CANCELLED, PAYMENT_PENDING, PAYMENT_FAILED`], trialStartedAt, trialEndsAt, currentPeriodStart?, currentPeriodEnd?, licencedUsers default 5) + `SubscriptionModule` (module: free-text string matching nav section keys, unique `[subscriptionId, module]`, kept as plain strings so new modules never need a migration). `UserModuleAccess` (per-user module grants, unique `[userId, module]`, auto-seeded at user-creation to match the role's default sections). `Payment` (numUsers, modules: JSON-encoded string array, amount computed server-side, method: `PaymentMethod` [`UPI, BANK_TRANSFER`], utr **unique** — the duplicate-payment guard, payerUpiId?, screenshotUrl?, status: `ManualPaymentStatus` [`PENDING, APPROVED, REJECTED, REFUNDED`], reviewedById?, reviewedAt?).

---

## Core library

### Sessions — `src/lib/session.ts`
- Cookie name **`eos_session`**, JWT (HS256 via `jose`), `SESSION_SECRET` env var required at module load.
- `SessionPayload`: `{ userId, accessRole, name, organizationId: string|null, isSuperAdmin }`.
- 7-day expiry (`7 * 24 * 60 * 60 * 1000` ms), `httpOnly`, `sameSite: "lax"`, `path: "/"`; `secure` flag from `COOKIE_SECURE` env var, falling back to `NODE_ENV === "production"`.
- `encrypt`/`decrypt` (returns `null` on any failure, never throws), `createSession`, `deleteSession`, `readSessionCookie`.

### Data Access Layer — `src/lib/dal.ts` (all `react cache`-wrapped, server-only)
- `verifySession()` — redirects to `/login` if no session.
- `getCurrentUser()` — loads `User`+`employee`; redirects to `/login?session=expired` if the user row is gone (stale cookie after reseed — Server Components can't clear cookies themselves, so `proxy.ts` handles that on the next `/login` hit).
- `requireRole(allowed: AccessRole[])` — redirects to `/access-denied` if role not allowed.
- `requireSuperAdmin()` — redirects to `/access-denied` if `!isSuperAdmin`.
- `getCurrentOrganization()` — loads `Organization` + `subscription.modules`; redirects to `/access-denied` if no `organizationId` (only super-admin, who never calls this).
- `requireActiveAccess()` — computes `EffectiveAccess`; redirects to `/subscription` if `!hasAccess`. This is the trial/subscription gate on the whole `(app)` shell.
- `requireModuleAccess(module)` — calls `requireActiveAccess()`, then redirects to `/subscription?blocked=module&m={module}` if the org's plan doesn't include it, or `/access-denied` if the specific user lacks the `UserModuleAccess` grant. Frontend nav-hiding is UX only; this is the real security boundary.

### Edge middleware — `src/proxy.ts`
- `publicRoutes = ["/login", "/register"]`. Decrypts the session cookie on every matched request.
- No session + non-public route → redirect `/login`. Valid session + public route → redirect to `roleHome[accessRole]`.
- `/login?session=expired` → redirects to bare `/login` **and deletes the cookie** (the mechanism `dal.ts` relies on to clear stale-user cookies).
- Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, static image extensions.

### Passwords — `src/lib/password.ts`
`scryptSync`, 16-byte random hex salt, 64-byte derived key, hex-encoded; `verifyPassword` recomputes and compares via `timingSafeEqual`.

### Storage — `src/lib/storage.ts`
Local filesystem abstraction (explicitly documented as swappable to Vercel Blob/S3 without touching callers). `UPLOAD_ROOT` = `DATA_DIR/uploads` if `DATA_DIR` env set (e.g. a persistent disk mount in prod), else `public/uploads`. `saveFile(file, folder)` sanitizes the filename to `[a-zA-Z0-9._-]`, prefixes a `randomUUID()`, returns `{ url, storageKey }` — URL is `/api/uploads/{key}` (route-served) if `DATA_DIR` set, else `/uploads/{key}` (static). `readFile` returns `null` on any error; `deleteFile` silently swallows errors (a DB-row delete shouldn't fail because the file's already gone).
- **`src/app/api/uploads/[...path]/route.ts`** serves files when `DATA_DIR` is set. Path-traversal guard rejects `..`/`\0` segments (400). 404 if missing. Content-Type resolved from extension (png/jpg/jpeg/webp/gif/pdf, else octet-stream). `Cache-Control: private, max-age=31536000, immutable`. **Not authenticated** (intentional — mirrors the same exposure model as public static assets: unlisted via random UUID filenames).

### Notifications — `src/lib/notify.ts`
`notifyUser(userId, message, href?)` creates one row. `notifyEmployee(employeeId, ...)` resolves the linked `User` first (no-op if none). `notifyRole(role, organizationId, ...)` bulk-creates one notification per user with that role in that org via `createMany`.

### Formatting — `src/lib/format.ts`
- `formatINR`: ≥₹1,00,00,000 → `₹X.XX Cr`; ≥₹1,00,000 → `₹X.XX L`; else `Intl.NumberFormat("en-IN", currency)`, 0 decimals.
- `formatDate` → `dd MMM yyyy`; `formatDateTime` → `dd MMM, HH:mm`; `formatTime` → `HH:mm` (all `en-IN`).
- `initials(name)` — first letters of first 2 words, uppercased.
- `titleCase(value)` — snake_case → Title Case, except acronyms (`rfq, amc, cip, sip, gps, po, hr`) which are fully uppercased instead.
- `formatFileSize`, `daysUntil` (note: `daysUntil` is unused dead code — nothing in the app computes a live "days to expiry" for AMC contracts or anything else).

### Billing / access computation — `src/lib/billing/access.ts`
`computeEffectiveAccess(subscription, now)` always derives access **live from timestamps**, never trusts the stored `status` column alone:
- No subscription → no access, `reason: "no_subscription"`.
- `now < trialEndsAt` → access granted, `isTrial: true`, `trialDaysRemaining`, **all modules unlocked**, `reason: "trial"`.
- Else if `currentPeriodEnd` set and `now < currentPeriodEnd` and status is `ACTIVE` or `CANCELLED` → access granted, `unlockedModules` = the subscription's actual `SubscriptionModule` rows, `reason: "active"` (a **cancelled** subscription still grants access until period end — cancellation takes effect then, not immediately).
- Else if status `PAYMENT_PENDING` → no access, `reason: "payment_pending"`.
- Else → no access, `reason: "subscription_expired"`.

### Pricing — `src/lib/billing/pricing-config.ts`
```
pricePerModulePerUserPerMonth: ₹400
minimumUsers: 5
volumeDiscountThreshold: 20 users
volumeDiscountRate: 15%
```
`calculatePrice(numUsers, modules)`: `basePrice = numUsers × modules.length × 400`; 15% discount applied if `numUsers ≥ 20`; `finalPrice = basePrice − discount`; `pricePerUserPerMonth = round(finalPrice / numUsers)`. This is the single source of truth — used for the live client-side preview and **always recomputed server-side** at submission (never trusts a client-supplied amount).

### Payment collection config — `src/lib/billing/payment-config.ts`
Env-configurable UPI ID / bank details (dev fallbacks: UPI `existdigitally@upi`, HDFC Bank). `buildUpiDeepLink({amount, referenceId})` builds a `upi://pay?...` deep link for the QR code.

---

## Navigation (`src/lib/nav.ts`)

5 `navSections`, each with a key, title, href, icon, and sub-items:
1. **CRM** (`/crm`) — Pipeline, Clients, Projects, Quotations, Site Visits, AMC Contracts, Helpdesk.
2. **HRMS** (`/hrms`) — Overview, Employees, Attendance, Leave, Payroll, Timesheets.
3. **Vendor Management** (`/vendors`) — Vendors, Purchase Orders, Payments.
4. **GPS & Field Tracking** (`/field`) — Live Map, Visit History, Geofences.
5. **Finance** (`/finance`) — Expense Claims, Budgets.

---

## Layout shell

### Root layout — `src/app/layout.tsx`
Geist Sans/Mono fonts; wraps everything in `TooltipProvider` + global `<Toaster />` (sonner). Title "Exist Digitally — Ops Platform".

### Authenticated shell — `src/app/(app)/layout.tsx`
`getCurrentUser()` → if `isSuperAdmin`, redirect `/platform-admin`. `requireActiveAccess()`. Renders `SidebarProvider` > `AppSidebar` + `SidebarInset` containing `TrialBanner`, conditionally `CompleteProfileBanner` (if `!employeeId`), then page content.

### `AppSidebar` (`src/components/layout/app-sidebar.tsx`)
- Logo header ("Exist Digitally / Ops Platform") linking to `/`.
- Fixed **"My HR"** item (→ `/me`) visible to **all roles**.
- If `ADMIN`: two extra fixed items — **"Approvals"** (→ `/approvals`) and **"User Management"** (→ `/admin/users`).
- One `SidebarGroup` per visible nav section (filtered by `roleSectionAccess`), items highlighted active by path match.
- Footer: avatar + name + role label, dropdown with **"Log out"** (form → `logout` action) and "Demo build · sample data" text.

### `SiteHeader` (`src/components/layout/site-header.tsx`)
Sticky header: sidebar trigger, title/description, a static **"Sample data · demo environment"** badge, `NotificationBell`.

### `NotificationBell` (`src/components/layout/notification-bell.tsx`)
Bell button, red unread-count badge ("9+" if >9). Dropdown: **"Mark all read"** link (if any unread) → `markAllNotificationsRead()`; up to 15 items each with a **"View"** link (marks read + navigates) and/or **"Mark read"** button.

### `TrialBanner` (`src/components/layout/trial-banner.tsx`)
Renders nothing outside trial. Amber if ≤2 days left, else blue. "`N` day(s) left in your free trial" / "Your free trial ends today". Link **"View plans"** → `/subscription`.

### `CompleteProfileBanner` (`src/components/layout/complete-profile-banner.tsx`)
Shown when the logged-in user has no linked `Employee`. Link **"Complete your profile"** opens a `Sheet` with fields: Full name, Role (Select, 8 `EmployeeRole` options), Department, Phone, Date of joining, Base location. Submit **"Save profile"** → `createSelfEmployeeProfile`. Toast "Profile created — you're all set." on success.

### `SectionTabs` (`src/components/layout/section-tabs.tsx`)
Generic reusable horizontal sub-nav (used by CRM/HRMS/Vendors/Finance/Field layouts) — active tab matched by exact path.

---

## Auth

### `src/lib/actions/auth.ts`
- **`login(_prevState, formData)`** — trims/lowercases email; generic `"Invalid email or password."` for both not-found and wrong-password (no user enumeration); on success, redirects super-admins to `/platform-admin`, everyone else to `roleHome[accessRole]`.
- **`logout()`** — deletes session, redirects `/login`.
- **`registerOrganization(_prevState, formData)`** — public self-service org signup. Fields: orgName, email, password (≥6 chars), confirmPassword (must match). Generates a unique slug (appends `-2`, `-3`… on collision). **Trial length: exactly 5 days.** Transaction creates `Organization` → `Subscription` (`TRIAL`, `licencedUsers: 5`) → `User` (`accessRole: ADMIN`) + `UserModuleAccess` for all 5 modules. **No `Employee` record is created** — the first admin is a portal-only login. Creates session, redirects `/`.

### Pages
- **`/login`** — redirects away if already authenticated. Renders `LoginForm`.
- **`/register`** — same pattern. Renders `RegisterForm`.
- **`/access-denied`** — `ShieldAlert` icon, "Access restricted", message naming the user's role and that it lacks access to "that module in this demo"; single button **"Back to my dashboard"** → `roleHome[accessRole]`.

### `LoginForm` (`src/components/auth/login-form.tsx`)
Two-column card. Left: Email / Password fields, **"Sign in"** button ("Signing in…" pending), demo-password hint (`demo123`), link **"Start a free trial"** → `/register`. Right: **6 one-click demo persona buttons** (Manan Vora/Admin, Nikhil Bhatt/Sales Rep, Suresh Yadav/Installation Crew, Pooja Nair/HR, Tanvi Mehta/Procurement, Ankit Shah/Finance) — each auto-fills email + `demo123` and auto-submits.

### `RegisterForm` (`src/components/auth/register-form.tsx`)
"Start your free trial" — Organization name, Work email, Password (min 6), Confirm password. **"Start free trial"** ("Creating your workspace…" pending). Link to `/login`.

---

## Main Dashboard (`/`)

`src/app/(app)/page.tsx` — **gated `requireRole(["ADMIN"])`** only. Uses `getDashboardData(organizationId)` (`src/lib/queries/dashboard.ts`), which runs 15 parallel Prisma queries scoped by org:
- Aggregates: open-lead value+count (stage not WON/LOST), active-project value+count, active employee count, present-today count, checked-in-now count, pending-leave count, overdue-payment sum, expiring-AMC count, open-PO count.
- Group-bys: leads by stage (count+sum), projects by product line (count).
- Lists (take 5–6 each): upcoming site visits, AMC expiring/active, live checked-in visit logs, recent quotations.

**8 KPI cards**: Open Pipeline, Active Projects, Present Today, On-Site Now, Pending Leave, Overdue Payments, AMC Expiring Soon, Open Purchase Orders — each via `KpiCard` (label, value, sub-caption, icon, tone: default/warning/danger/success).

Below: **Pipeline by stage** bar chart (`PipelineChart`, X-axis in ₹Cr) and **Projects by product line** pie chart (`ProductLineChart`). Then a 3-card row: Upcoming site visits, AMC renewals, Live field activity (pulsing green dot per active rep). Finally a Recent Quotations list with status badges.

---

## Admin — User & Role Management (`/admin/users`)

Gate: `requireRole(["ADMIN"])`. Data: `getUsers(organizationId)` + `getEmployeesWithoutLogin(organizationId)`.

**Table**: User (avatar + name/email), Employee role, Department, **Access role** (inline `UserRoleSelect` dropdown — changes apply immediately, no save button), Created date, Actions (`EditUserSheet` pencil + `RevokeAccessButton`, the latter hidden on the admin's own row so they can't lock themselves out).

**`NewUserSheet`** — trigger **"New user"**. Segmented control **"Existing employee" / "New person"**. Existing mode: pick an employee lacking a login. New mode: full employee fields (name, role, department, email, phone, date of joining, base location). Common: Access role (Select), Temporary password (min 6 chars). Submit **"Grant access"**.

**`EditUserSheet`** — pencil icon trigger. Fields: Email, Access role, optional "Reset password" (blank = unchanged). Submit **"Save changes"**.

### `src/lib/actions/admin.ts`
- **`createUserForEmployee`** — mode "new": generates `employeeCode = EOS-###` from a **global** `Employee.count()` (not per-org — explicitly mirrors the same pattern/limitation as `hrms.ts::createEmployee`). Mode "existing": links an org employee lacking a `User`. Both: hashes password, transactionally creates `User` + seeds `UserModuleAccess` from `roleSectionAccess[accessRole]`, then **re-checks the licence count after insert inside the same transaction** — if `userCount > licencedUsers`, throws `LicenceLimitError` and rolls back with `"Your subscription includes {N} user licences. Please purchase additional licences to add more users."` Sends a welcome notification, revalidates `/admin/users` + `/hrms/employees`.
- **`updateUser`** / **`updateUserRole`** — update email/role/password; **additively upserts** `UserModuleAccess` for the new role's default modules (never removes previously-granted extras).
- **`revokeUserAccess(userId)`** — blocks self-revocation (`"You can't revoke your own access."`); hard-deletes the `User` row.

---

## Platform Admin (cross-org superadmin)

Gate: `requireSuperAdmin()` throughout. Layout has nav: **Payments** (`/platform-admin`), **Organizations** (`/platform-admin/organizations`), **Log out**.

### `/platform-admin` — Payments review
Split into **"Pending verification"** (table: Organization, Submitted by, Plan, Amount, UTR, Method, Payment date, Screenshot link, `PaymentReviewActions`) and **"Payment history"** (status badges: PENDING secondary, APPROVED default, REJECTED destructive, REFUNDED outline).

**`PaymentReviewActions`**: **"Approve"** button (direct call) or **"Reject"** (opens a `Dialog` requiring a reason `Textarea`, disabled until non-blank).

### `src/lib/actions/platform-admin.ts`
- **`approvePayment(paymentId)`** — loads the payment WHERE `status: PENDING` only (guards double-approval race), throws otherwise. Computes new billing period: `periodStart` = existing `currentPeriodEnd` if still future (else `now`) — **renewing before expiry extends the current period rather than restarting it**; `periodEnd = periodStart + 1 month`. Sets subscription `ACTIVE`, `licencedUsers = payment.numUsers` (replaces), and **deletes+recreates** all `SubscriptionModule` rows from `JSON.parse(payment.modules)` — approving a payment fully replaces the module grant set with what was purchased, it does not merge.
- **`rejectPayment(paymentId, reason)`** — requires non-empty reason; `updateMany` WHERE `status: PENDING` only.

### `/platform-admin/organizations`
Table of every org using `computeEffectiveAccess` per row: Users (`count/licencedUsers`), Status badge, Trial ends, Current period end, Modules (or "All (trial)"), Created date.

---

## Subscription & Billing

### `/subscription`
Status card (Trial/Active/No active access, with icon+color). If `blocked=module` query param present, shows a contextual "isn't included in your plan" banner. Trial: days remaining + "ends {date}". Active: renewal date + licenced users + module badges. No access: message varies by `reason` (payment_pending vs none), plus role-conditional hint. `PlanSelector` (purchase calculator) renders **only for ADMIN**.

### `PlanSelector` (`src/components/subscription/plan-selector.tsx`)
"Number of users" input (min 5), module checkbox grid (all 5 checked by default), live price breakdown (base price, volume discount line if ≥20 users, monthly total, per-user rate). **"Proceed to payment"** (disabled below minimum/zero modules) → `/subscription/payment?numUsers=...&modules=...`.

### `/subscription/payment`
Gate `requireRole(["ADMIN"])`. Recomputes price server-side (authoritative). Generates `referenceId = "{ORGSLUG}-{8 hex chars}"` + a UPI deep-link QR code (240×240). Shows payment details (Amount, UPI ID, Account name, Bank, Account number, IFSC, Reference). Embeds `PaymentSubmissionForm`.

### `PaymentSubmissionForm`
Fields: Payment method (UPI/Bank transfer), Payment date (max = today), UTR/Transaction ID, Payer UPI ID (optional), Payment screenshot (optional, image), Notes (optional). **"Submit for verification"**.

### `submitPayment` (`src/lib/actions/billing.ts`)
Validates `numUsers ≥ 5`, `modules` non-empty, valid method, non-empty UTR, valid date; screenshot ≤10MB (saved via `saveFile`). **Amount is always recomputed server-side via `calculatePrice`** — client-supplied amount is never trusted. Creates `Payment` (status defaults PENDING). **Duplicate guard**: `utr` has a DB-unique constraint; Prisma error `P2002` is caught and surfaced as `"This UTR has already been submitted. Duplicate payments aren't allowed."`

---

## CRM

Layout gate: `requireRole(["ADMIN", "SALES"])` + `requireModuleAccess("crm")`. Tabs: Pipeline, Clients, Projects, Quotations, Site Visits, AMC Contracts, Helpdesk.

**Access-control asymmetry (real gap)**: `create*` actions (`createClient`, `createLead`, `createQuotation`, `createMilestone`, `createProjectTask`, `createTicket`) all re-check `requireRole(["ADMIN","SALES"])`. Every `update*` / status-transition / `resolveTicket` / `assignTicket` action only calls `getCurrentUser()` — **any authenticated user who can reach a CRM route can perform status transitions and ticket resolution**, regardless of role.

**Status-menu pattern**: Milestone, Quotation, Site Visit, and Ticket status controls are all a `Badge` that opens a `DropdownMenu` listing **every other status as an unrestricted "Mark X" option** — there is no enforced state machine anywhere (e.g. you can jump `OPEN`→`CLOSED` directly, or `PLANNED`→`COMPLETED`).

**Number generation gap**: `quoteNumber` (`QT-${1001+count}`) and `ticketNumber` (`TKT-${1001+count}`) both derive from a **global** (cross-tenant) `count()`, not scoped per org, with no transaction/lock — a documented collision risk under concurrency.

### Pipeline / Leads (`/crm`)
`PipelineBoard` — **6 fixed Kanban columns** (New/Qualified/Quotation Sent/Negotiation/Won/Lost) with colored dot accents, each showing count + total pipeline value. **Not drag-and-drop** — each card has a "⋯" menu labeled **"Move to"** listing every other stage. `NewLeadSheet` fields: Opportunity title, Client, Source (Select), Product line (Select), Deal value (₹), Probability % (default 20), Expected close date, Owner (admins choose any active sales rep via Select; non-admins get a hidden input forcing themselves as owner), Notes.
- `updateLeadStage`: forces `probability = 100` on WON, `= 0` on LOST; notifies all ADMIN users on WON/LOST.

### Clients (`/crm/clients`)
List + detail (`/crm/clients/[id]`, read-only). `NewClientSheet` fields: Client name, Industry (Select), Tier (free text), City/State (free text), Contact person/title/email/phone. `status` is hardcoded `"Active"` at creation with **no UI anywhere to change it afterward**. Detail page computes `totalPipeline` (open leads only), `totalProjectValue`, and "Active AMCs" (status ≠ EXPIRED) client-side.

### Projects (`/crm/projects`, `/crm/projects/[id]`)
**No "New Project" creation UI exists anywhere** — projects can only originate outside the app (seed data). Progress bar caption explicitly notes: *"Calculated from completed tasks below — not manually set."* `NewMilestoneSheet` (Title, Due date) appends to the end (`sortOrder` = current count, no reordering). `MilestoneStatusMenu` same unrestricted-dropdown pattern. `NewProjectTaskSheet` (Title, Milestone select optional, Assignee select optional, Due date optional). `ProjectTaskRow` uses direct action buttons (not a dropdown): **"Start"** badge (TODO→IN_PROGRESS) + green checkmark (jump straight to DONE, skipping IN_PROGRESS); IN_PROGRESS shows only the checkmark; DONE shows only a **Reopen** icon (→ TODO, never back to IN_PROGRESS). Notably this component never shows a success toast (only error), unlike every other status-mutating component. `updateProjectTaskStatus` recomputes `Project.progressPercent = round(done/total*100)` project-wide across all tasks (milestone + unassigned).

### Quotations (`/crm/quotations`, `/crm/quotations/[id]`)
`NewQuotationSheet` — dynamic client-managed line-item rows (Description/Qty/Unit price, add/remove), a live client-side running total for UX only. Server independently recomputes `amount = Σ(qty×unitPrice)` from non-empty rows (a half-filled trailing row is silently dropped); **never sets `leadId`** — quotations created via the UI are never linked to a Lead. `quoteNumber = QT-{1001+count}` (global). `revision` defaults to 1 and **no code path ever increments it** — there is no "create revision" feature; the Rev./"Revision N" UI will always read R1 for app-created quotes. `QuotationStatusMenu`: DRAFT→SENT→UNDER_REVIEW→APPROVED→REJECTED, unrestricted transitions.

### Site Visits (`/crm/site-visits`)
**Read/status-only** — no creation UI/action exists. `SiteVisitStatusMenu`: SCHEDULED/COMPLETED/CANCELLED.

### AMC Contracts (`/crm/amc`)
**Fully read-only** — no status menu, no creation UI, and **no mutation action exists at all**. `AmcStatus` (ACTIVE/EXPIRING_SOON/EXPIRED) is a **static value set once at seed time**; nothing in the running app recomputes it as `endDate` approaches/passes, despite the enum name implying a live state. `daysUntil()` helper exists but is unused.

### Helpdesk (`/crm/helpdesk`, `/crm/helpdesk/[id]`)
`NewTicketSheet` — Client (Select), Related AMC contract (Select, disabled/filtered to that client's contracts, remounts on client change), Subject, Description (Textarea), Priority (Select, default MEDIUM), Assignee (Select, optional). `ticketNumber = TKT-{1001+count}` (global). **If priority is CRITICAL**, notifies all ADMIN users. `TicketStatusMenu`: OPEN/IN_PROGRESS/RESOLVED/CLOSED — setting RESOLVED or CLOSED stamps `resolvedAt`; **any other status explicitly nulls `resolvedAt`** (reopening clears the timestamp but leaves `resolutionNotes` text intact). `TicketAssigneeSelect` — plain Select bound to `assignTicket`; **no notification is sent to the newly assigned employee** (unlike the CRITICAL-creation notify path — a functional gap). `ResolveTicketForm` renders whenever status ≠ CLOSED (including already-RESOLVED, allowing notes to be edited/resaved). `resolveTicket` action has **no role gate at all** (only `getCurrentUser`) — any authenticated user can resolve a ticket, unlike creation which is ADMIN/SALES-only.

---

## HRMS

Layout gate: `requireRole(["ADMIN","HR"])` + `requireModuleAccess("hrms")`. Tabs: Overview, Employees, Org Chart, Attendance, Leave, Payroll, Timesheets. Every server action in `actions/hrms.ts` re-checks the role itself (defense in depth), except the self-service `createSelfEmployeeProfile`.

### Overview (`/hrms`)
5 KPI cards: Active Employees, Present Today (+half-day sub), Absent Today, On Leave Today, Pending Payroll (this month). "Pending leave requests" card (up to 6, with inline `LeaveDecisionButtons`). "Headcount by department" card.

### Employees (`/hrms/employees`, `/hrms/employees/[id]`)
Table: Employee (avatar+code), Role, Department, Location, Joined, Status badge (`ACTIVE` default, `ON_LEAVE` secondary, `INACTIVE` destructive), Actions. `NewEmployeeSheet`: name, role (8-option Select), department, email, phone, date of joining, base location, access role (helper text: "A portal login is created automatically with temporary password `demo123`").
- **`createEmployee`**: `employeeCode = EOS-###` from a **global** `Employee.count()` (explicitly, globally unique across all orgs). Transaction creates `Employee` + `User` (temp password `demo123`) + seeds `UserModuleAccess`; **licence check runs after insert inside the same transaction**, rolling back with a friendly error if the org's `licencedUsers` cap is exceeded. Sends a welcome notification naming the temp password.
- **`createSelfEmployeeProfile`**: no role gate; used for self-onboarding. If an `Employee` already exists with the user's email but no linked login, links it instead of duplicating.
- **`deleteEmployee`**: blocks self-deletion; deletes the linked `User` first, then the `Employee`; catches Prisma FK-violation (`P2003`) and rethrows as *"Cannot delete this employee — they have existing HR or business records... linked to their profile."* UI confirms via `window.confirm`.
- Detail page: header stats (Joined, Reports To, Latest Net Pay, Status), Recent Attendance / Leave History / Payroll History / Recent Timesheets / Documents cards.

### Attendance (`/hrms/attendance`)
`getAttendanceToday` builds a **full daily roster** (not just existing rows) — deliberately synthesizes placeholder rows so every ACTIVE employee appears: real `Attendance` row if it exists → else a synthetic `ON_LEAVE` row if an approved leave covers today → else a synthetic `ABSENT` row. No check-in/out controls live on this admin page (that's `/me`). Status badges: PRESENT default, HALF_DAY secondary, ABSENT destructive, ON_LEAVE secondary, HOLIDAY outline.
- **Check-in/out logic** (in `actions/me.ts`, populates this same table): checkout hours = `((checkOut-checkIn)/3600000).toFixed(1)`; **`< 4 hours → HALF_DAY`, else `PRESENT`** (binary threshold, no overtime logic).

### Leave (`/hrms/leave`)
Table with inline `LeaveDecisionButtons` (green check / red X) for PENDING rows. Day count (computed in `applyLeave`, `actions/me.ts`): `round((end-start)/86400000) + 1` — **inclusive calendar-day diff, no weekend/holiday exclusion**.
- **`decideLeaveRequest`**: stamps `decidedBy` with the deciding user's employee name (fallback `"HR"`); notifies the employee: *"Your {Type} leave request was approved/rejected."*

### Payroll (`/hrms/payroll`)
`GeneratePayrollButton` (Month/Year Selects) → `generatePayroll(month, year)`: for every ACTIVE employee, skips if a record already exists for that period; otherwise **copies `basicSalary`/`allowances` from the employee's most recent prior `PayrollRecord`** (there is no canonical base-salary field on `Employee` at all) — a brand-new employee with zero payroll history is silently skipped and gets no record. New records start `deductions: 0`, `netPay = basicSalary+allowances`, `status: PENDING`.
- `ProcessPayrollButton` → `processPayroll(payrollId)`: recomputes real unpaid-leave deduction at process time by summing `APPROVED` `UNPAID`-type leave days overlapping that calendar month, then calls the payroll formula (below); sets `status: PROCESSED`, `paidOn: now`.
- **Formula** (`src/lib/payroll.ts`, `calculateNetPay`):
  ```
  perDayRate = basicSalary / 30           // flat divisor, not calendar-aware
  unpaidLeaveDeduction = round(perDayRate * unpaidLeaveDays)
  deductions = baseDeductions + unpaidLeaveDeduction
  netPay = basicSalary + allowances - deductions
  ```
  **No tax/PF/ESI/statutory deduction logic exists anywhere.** `basicSalary`/`allowances` are never entered directly anywhere in the UI — they only ever propagate employee-to-employee via the "most recent record" template chain.

### Timesheets (`/hrms/timesheets`)
Read-only table (Employee, Project, Task, Date, Hours, Billable badge). Creation only happens via `/me` (`logTimesheet`), which **hardcodes `billable: true`** — despite the table rendering a Billable/Non-billable badge, nothing in the app ever creates a non-billable entry.

### Org Chart (`/hrms/org-chart`)
Builds a tree client-side from flat ACTIVE-employee rows (`reportingToId`), single pass into a `Map`. Root nodes (depth 0) start **expanded**; all deeper levels start collapsed. Each expandable node shows a "`N` report(s)" badge; direct reports render alphabetically (insertion order follows the `orderBy name asc` query).

### Employee Documents
`UploadDocumentSheet`: Document type (5-option Select: ID Proof/Offer Letter/Contract/Certificate/Other), File input (helper text "Max 10MB", **server-enforced** — `MAX_DOCUMENT_SIZE = 10MB`, no MIME/type restriction enforced). Stored via the shared `storage.ts` flow under `employees/{employeeId}/`. `deleteEmployeeDocument` deletes the DB row then the physical file.

---

## Finance

Layout gate: `requireRole(["ADMIN","FINANCE"])` + `requireModuleAccess("finance")`. Tabs: Expense Claims, Budgets.

### Expense Claims (`/finance`)
Table status cell is mutually exclusive: `APPROVED` → `ReimburseClaimButton` ("Mark reimbursed"); `PENDING` with a live approval → inline `DecideClaimButtons` (green check/red X, right in the table, no navigation to `/approvals` needed); otherwise a static status badge.
- **`createExpenseClaim`** (no role gate — any user with an `employeeId` can self-file, used from `/me`): `claimNumber = EXP-{2001+count}` from a **global** count (explicit comment: field is globally unique so the counter must be too — same race-condition caveat as PO/ticket/quote numbering). Routes to `requestApproval({... approverRole: "FINANCE"})`, notifies role FINANCE.
- **`markExpenseClaimReimbursed`**: only allowed from `APPROVED` status; sets `REIMBURSED` + `reimbursedOn`. No notification sent.

### Budgets (`/finance/budgets`)
Each budget is a card; **only APPROVED budgets show a live spend/utilization Progress bar** — PENDING/REJECTED just show "proposed" text. `getBudgets` computes `spent` as a **live derived aggregate** (not a stored running total): sums `ExpenseClaim.amount` matching same category + same department (via employee.department) + date range + status in [APPROVED, REIMBURSED]. Utilization % can exceed 100 in the text even though the bar visually caps at 100%.
- **`createBudget`**: routes to `requestApproval({... approverRole: "ADMIN"})`, notifies role ADMIN.
- `NewBudgetSheet`: Department (free text), Category (6-option Select), Amount, Start/End date (end must be ≥ start).

---

## Vendor Management

Layout gate: `requireRole(["ADMIN","PROCUREMENT"])` + `requireModuleAccess("vendors")`. Tabs: Vendors, Purchase Orders, Payments.

### Vendors (`/vendors`, `/vendors/[id]`)
`NewVendorSheet`: Vendor name, Category (free text, not an enum), Contact person/email/phone, City. **`createVendor` hardcodes `rating: 4.0` and `status: "Active"`** — no form fields for either.
- **`deleteVendor`**: hard-blocked (no cascade) if the vendor has any purchase orders or payments.
- **`VendorRatingControl`**: 5 clickable star icons, hover-preview; `updateVendorRating` validates `1 ≤ rating ≤ 5` (DB field is `Float`, though UI only ever sends integers). Read-only on the list page, interactive on the detail page.
- Detail page stats: Total Spend (excludes CANCELLED/DRAFT POs), Purchase Orders count, Delivered count, Overdue Payments count (red if >0).

### Purchase Orders (`/vendors/purchase-orders`)
`NewPurchaseOrderSheet`: Vendor (Select), Items (Textarea), Amount, Order date, Expected delivery.
- **`createPurchaseOrder`**: `poNumber = PO-{7000+count+1}` (**global** count, same collision caveat). Status always starts `DRAFT`. Routes to `requestApproval({... approverRole: "ADMIN"})`.
- **`EditPurchaseOrderSheet`**: edits vendor/items/amount/dates; **`status` is a hidden input, always resubmitted unchanged** — there is no UI control anywhere to manually change PO status (the only status transitions happen via approval decisions: DRAFT→SENT/CANCELLED).
- **`deletePurchaseOrder`**: blocked if the PO has recorded payments; otherwise deletes any orphaned `ApprovalRequest` rows first, then the PO.
- **`duplicatePurchaseOrder`** ("Reorder", `ReorderPoButton`, `Repeat` icon, no confirmation dialog unlike delete): new `poNumber`; **preserves the original lead time** (`expectedDelivery = today + (source.expectedDelivery - source.orderDate)`, clamped ≥0) rather than copying dates verbatim; always starts `DRAFT`; creates a new ADMIN approval request.

### Payments (`/vendors/payments`)
`MarkPaidButton` — **hardcodes `method: "NEFT"`**, there is no method picker anywhere in the UI despite the underlying action accepting an arbitrary string. Sets `PAID` + `paidDate`; **always notifies role ADMIN** regardless of who (PROCUREMENT or ADMIN) clicked it.
- **Overdue detection is not live**: grepping the whole codebase confirms `PaymentStatus.OVERDUE` is never assigned by any runtime action — it's a static label baked in once at seed time (`isOverdue = !isPaid && dueDate < now` computed only in `prisma/seed.ts`). A payment that goes past its due date after seeding will **not** automatically flip to OVERDUE; every "Overdue" count/badge in the app (dashboard KPI, vendor detail stat) just trusts the stored value.

---

## Approval Engine

### Core logic — `src/lib/approvals.ts` + `src/lib/actions/approvals.ts`
- `requestApproval({entityType, entityId, requestedById, approverRole, note?})` — a thin `ApprovalRequest.create` wrapper. **Routing (which role) is decided by the caller, hardcoded per call site**: Expense Claim → FINANCE, Budget → ADMIN, Purchase Order (create & reorder) → ADMIN.
- `decideApproval(approvalId, decision)` — the single decision point for **every** entity type:
  1. Loads the request scoped by the **original requester's** org (not the decider's — intentional per code comment, functionally equivalent since role+org constraints align).
  2. Throws if not found or already decided (`status !== PENDING`).
  3. **`requireRole([approval.approverRole])`** — the role gate is **data-driven**: whichever role was stamped on the request at creation is the only role allowed to decide it. This makes the engine generic/extensible.
  4. Updates the request, then a `switch (entityType)` applies entity-specific side effects — explicitly the extension point for future consumers:
     - **PURCHASE_ORDER**: PO → `SENT` (approved) or `CANCELLED` (rejected). If approved, **creates a new `VendorPayment`** — this is the *only* place a `VendorPayment` is ever created for a PO (`amount = po.amount`, `dueDate = po.expectedDelivery`, status PENDING). Notifies the requester, links `/vendors/purchase-orders`.
     - **EXPENSE_CLAIM**: claim status → APPROVED/REJECTED directly (not a payment state). Notifies requester, links `/me`.
     - **BUDGET**: budget status → APPROVED/REJECTED. Notifies requester, links `/finance/budgets`.

### `/approvals` page
Role-scoped via `getPendingApprovals(user.accessRole, organizationId)` — an ADMIN sees PO+budget requests, a FINANCE user sees expense-claim requests. Cards render entity-specific summaries (PO number+vendor+items; claim number+category+description; budget department+category+date range), footer "Requested by {name} · {date}". `ApprovalDecisionButtons` — labeled **"Approve"**/**"Reject"** buttons (unlike the icon-only inline variant on the Finance page), no confirmation dialog.

---

## GPS & Field Tracking

Layout gate: `requireRole(["ADMIN","FIELD"])` + `requireModuleAccess("field")`. Tabs: Live Map, Visit History, Geofences.

### Live Map (`/field`)
`MyFieldStatus` self check-in card shown **only for FIELD-role users with a linked employee** (ADMIN viewers see the map/lists only). Right column: "On Site Now" (checked-in reps, pulsing green dot, GPS badge if `isDeviceGps`) and "Off Site" (last-known position, "Idle" badge).

`getFieldMapData` fetches active `INSTALLATION_CREW`/`TECHNICIAN`/`SALES_REP` employees, each with their single most-recent `LocationPing`; **employees with zero pings ever are filtered out entirely and never appear on the map.**

### `LiveMapInner` (Leaflet)
OpenStreetMap tiles; map centers on the average of all geofence coordinates, falling back to a hardcoded Vadodara, Gujarat coordinate if no geofences exist. Circles drawn per geofence at their true `radiusMeters`. Rep markers are custom `L.divIcon` dots — green if checked in (with a CSS `field-marker-pulse` radar-ping animation) or gray if not. Popups show role, live-GPS flag, site, purpose, since-timestamp.
- **Simulated movement**: a client-side `setInterval` (3500ms) **re-randomizes the on-screen position of every checked-in rep purely visually** via a `jitter()` helper — this never touches the database or reflects real device movement; off-site reps stay static.

### `jitter(lat, lng, maxMeters)` (duplicated in both `actions/field.ts` and `live-map-inner.tsx`)
Converts a radius to a random lat/lng offset using `111,320` (meters per degree latitude at the equator) as the base constant, correcting longitude by `cos(latitude)`. **Not a distance/containment check** — purely a noise generator, used both (a) to fake a plausible check-in position when no real device fix exists, and (b) for the map's cosmetic movement animation.

### Check-in / check-out (`src/lib/actions/field.ts`, surfaced via `MyFieldStatus`)
- **`checkIn`**: rejects if already checked in anywhere (`"You're already checked in somewhere. Check out first."` — one active visit per employee, enforced in app code only, no DB constraint). Uses the real device GPS fix if the browser provided one (`hasDeviceFix`); otherwise synthesizes a position via `jitter(zone center, min(radius×0.5, 150))`. **No actual geofence-containment/Haversine check is ever performed** — device coordinates are trusted and stored regardless of whether they fall inside the drawn circle; the circle is purely visual. Transaction creates a `VisitLog` + one `LocationPing`.
- **`checkOut(visitId)`**: authorization requires the visit belongs to the caller. `durationMinutes = round((checkOutTime-checkInTime)/60000)`.
- **No notification or approval-engine call exists anywhere in `field.ts`** — visits are not routed for approval, unlike expense claims.
- **GPS pings are one-shot, not polled** — a `LocationPing` row is only ever created at check-in time; there's no `watchPosition`, cron, or interval anywhere that records ongoing location during an active visit (confirmed via a repo-wide search — the only `geolocation`/`getCurrentPosition` usage is the single one-shot call in `MyFieldStatus`, `{enableHighAccuracy:true, timeout:8000, maximumAge:30000}`).

### `MyFieldStatus` geolocation states
`geoStatusLabel` state machine: `locating`, `ready`, `unavailable`, `denied`, `timeout`, `insecure` (explicit HTTPS check via `window.isSecureContext` — flagged as the top real-world cause of "GPS not working" on LAN-only deployments). **"Retry"** link shown for unavailable/denied/timeout.

### Visit History (`/field/visits`)
Read-only table: Employee, Site, Purpose, Check In/Out times, Duration (`Xh Ym` or "—"), Status badge (Checked In default / Checked Out outline).

### Geofences (`/field/geofences`)
Read-only table: Zone, Client/Project, Coordinates (4 decimal places), Radius (m), Visits Logged count. **No create/edit UI exists** for geofences anywhere in the reviewed code.

---

## Me (personal workspace, `/me`)

No role restriction (any authenticated non-superadmin user with active access). If `!employeeId`, most data fetches are skipped and the `CompleteProfileBanner` shows instead.

### Layout
Profile header, then a 4-column stat grid — **Recent attendance** (`AttendanceCheckButton`), **Leave** (`ApplyLeaveSheet`), **Timesheet** (`LogTimesheetSheet`), **Expenses** (`NewExpenseClaimSheet`) — each with its own recent-history list. Then **My Tasks** (`TaskBoard`), **Team Tasks** (manager-only flat list of tasks assigned to others), **Evening Summary** (`DailySummaryForm` + history), **Team Summaries** (manager-only, direct reports' daily summaries).

### Self-service attendance (`src/lib/actions/me.ts`)
`checkInAttendance` / `checkOutAttendance` — same hours formula and `< 4h → HALF_DAY` rule as documented under HRMS Attendance (this is the actual entry point; the HRMS page only displays the results). `AttendanceCheckButton` is a 3-state machine: "Check in" → "Check out (in since HH:MM)" → static "Checked out at HH:MM" text (no button once both timestamps exist for the day).

### Self-service leave (`ApplyLeaveSheet` → `applyLeave`)
Leave type (4-option Select, default Casual), Start/End date, Reason (Textarea). Day count formula as documented above (inclusive calendar days). **No notification/approval-engine integration** — unlike expense claims, applying for leave doesn't notify anyone; HR/Admin only see it via the `/hrms/leave` list.

### Self-service timesheet (`LogTimesheetSheet` → `logTimesheet`)
Project (optional Select), Date, Hours (`0.5`–`16` step `0.5`), Task description (Textarea). **Hardcodes `billable: true`** — no control exists to log non-billable time despite the HRMS table rendering both badge states.

### Self-service expense claims (`NewExpenseClaimSheet` → `createExpenseClaim` in `finance.ts`)
Category (6-option Select), Amount, Expense date, Description. This is the **only** Me self-service action that integrates with notifications/approvals (`requestApproval` → FINANCE, `notifyRole`).

### Personal Tasks (`TaskBoard`, `NewTaskSheet`, `TaskDetailSheet`)
3-column Kanban (To Do / In Progress / Done) — **no drag-and-drop**; movement is via small forward/back arrow icon buttons, one step at a time (can't jump TODO→DONE from the board itself — see below for the one place that *can* happen). `NewTaskSheet`: Title, Notes, Priority (Low/Medium/High, default Medium), Due date, and — **only if the user is a manager** (has ≥1 direct report) — an "Assign to" Select (defaults to "Myself"); non-managers never see this control at all, and `createTask` independently re-validates the manager check server-side regardless.
- **`updateTaskStatus`**: only the **assignee** can move their own task (not the assigner); moving to `DONE` automatically clears `isBlocked`.
- **`deleteTask`**: allowed by either the assignee **or** the assigner.
- **`setTaskBlocked`**: assignee-only; sets/clears `blockerNote`.
- **`addTaskComment`**: assignee or assigner only.
- `TaskDetailSheet` (viewer-role-aware): assignee sees a blocker report/clear mini-form; assigner sees the blocker note read-only; both see a comment thread with a post box.

### Daily Summary (`DailySummaryForm` → `submitDailySummary`)
Six optional free-text fields (Completed/In progress/Pending/Blockers/Updates/Next-day plan) — rejects only if **all six** are empty. **Upserted** on the unique `[employeeId, date]` key — exactly one row per employee per calendar day; resubmitting the same day overwrites rather than duplicating (button label toggles "Submit summary" ↔ "Update summary" accordingly).

---

## Known business-rule quirks & gaps (for future maintainers)

These are real, verified-in-code characteristics — not necessarily bugs to "fix" without asking, since some are intentional simplifications for a demo/MVP, but worth knowing before changing adjacent code:

1. **Several sequence numbers are global, not per-tenant**, and generated via a non-transactional `count()+1` scheme: `Employee.employeeCode` (`EOS-###`), `Quotation.quoteNumber` (`QT-###`), `SupportTicket.ticketNumber` (`TKT-###`), `ExpenseClaim.claimNumber` (`EXP-###`), `PurchaseOrder.poNumber` (`PO-###`). Each risks collisions under concurrent creation and mixes numbering across all organizations sharing the DB.
2. **No enforced status state machines** anywhere in CRM (lead stage, quotation, site visit, milestone, project task-via-menu, ticket) or Vendor POs — every status dropdown allows jumping to any other status unconditionally.
3. **AMC contract status never transitions automatically** — `ACTIVE`/`EXPIRING_SOON`/`EXPIRED` is set once at seed time and there is no mutation action, cron, or computed-at-read logic that updates it as dates pass.
4. **Vendor payment `OVERDUE` status is likewise static** — never recomputed at runtime; only seed data assigns it.
5. **Quotation `revision` never increments** — always reads `1` for any quotation created through the app; there's no "create revision" feature despite the field's presence.
6. **No real geofence containment check** — field check-in never validates the device's coordinates fall within the geofence radius; the map circle is purely visual, and jitter-based synthetic coordinates are used only as a UX fallback, not a security boundary.
7. **GPS tracking is one-shot per visit, not continuous** — a single `LocationPing` is recorded at check-in; the "moving dots" on the live map are a client-only cosmetic animation that never persists.
8. **Payroll has no tax/PF/ESI logic** — `basicSalary`/`allowances` are never entered directly in any form; they propagate only via copying the employee's most recent prior payroll record, and the only deduction ever computed is a flat unpaid-leave proration (`basicSalary/30 × days`).
9. **Timesheets logged via self-service are always `billable: true`** — there's no UI path to create a non-billable entry, though the HRMS table renders both states.
10. **Ticket reassignment does not notify the new assignee**, while CRITICAL-priority ticket *creation* does notify all ADMINs — an inconsistency worth being aware of if extending notification coverage.
11. **Leave applications never notify or route through the approval engine** — only expense claims and budgets/POs do; HR/Admin discover pending leave purely by visiting `/hrms/leave` or the Overview page's pending-list card.
12. **`decideApproval`'s authorization is fully data-driven** (`requireRole([approval.approverRole])`) — adding a new approval-routed entity type only requires calling `requestApproval` with the right `approverRole` and adding a case to the `switch` in `decideApproval`; no new role-check code is needed.
13. **Module access is intentionally additive-only** — changing a user's `AccessRole` seeds the new role's default modules via upsert but never revokes modules an admin previously granted beyond defaults.
14. **A cancelled subscription still grants access until `currentPeriodEnd`** — cancellation is not immediate.
