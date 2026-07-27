# Exist Digitally Ops Platform — User Manual

A complete guide for anyone using the platform day to day. No technical background needed.

---

## A. Product Overview

**What it does.** Exist Digitally Ops Platform is an all-in-one business system for a company that sells, installs, and services equipment (process equipment, containment systems, piping, turnkey projects). It covers five areas in one place:

- **CRM** — sales pipeline, clients, quotations, projects, site visits, service contracts (AMC), and a customer support helpdesk.
- **HRMS** — employee records, attendance, leave, payroll, and timesheets.
- **Vendor Management** — suppliers, purchase orders, and vendor payments.
- **GPS & Field Tracking** — a live map of field staff, their visit history, and site geofences.
- **Finance** — expense claims and department budgets.

On top of these, every company (called an "organization") gets its own private workspace, a personal dashboard for every employee, an approvals inbox for anything that needs sign-off, and a notification bell that surfaces what needs your attention.

**Who uses it.** Everyone in the company, each seeing only what their role needs:

- **Admin** — sees everything, manages users and billing.
- **Sales Rep** — CRM only.
- **Field Crew** — GPS & Field Tracking, plus their own HR/personal tools.
- **HR** — HRMS.
- **Procurement** — Vendor Management.
- **Finance** — Finance module.

Everyone, regardless of role, also has a personal workspace ("My HR") for attendance, leave, timesheets, expenses, and personal tasks.

**Main benefits.** One login for the whole business instead of scattered spreadsheets and emails; a real-time view of the sales pipeline, field team location, and financial approvals; and an audit trail (who approved what, when) built into every workflow.

---

## B. Getting Started

### Accessing the application

Open the app's web address in your browser (your admin will give you the URL). You'll land on the **Sign in** page.

### Logging in

Enter your work email and password, then click **Sign in**. If you don't have an account yet, click **Start a free trial** to register a brand-new company workspace (this makes you the first Admin).

If you're trying the platform out with sample data, the login page shows six **demo persona** buttons — clicking one instantly logs you in as that sample person (their password is always `demo123`).

### First-time setup

If your account has no employee profile linked yet (common for a freshly registered Admin), you'll see a banner: **Complete your profile**. Click it, fill in your name, role, department, phone, joining date, and base location, then **Save profile**. This links your login to a full HR record so attendance, leave, and payroll all work for you.

### Basic navigation

- The **left sidebar** lists the modules you have access to, plus **My HR** (everyone) and, for Admins, **Approvals** and **User Management**.
- The **bell icon** (top right) shows notifications — things awaiting your action or updates on things you're involved in.
- Each module has its own row of **tabs** near the top (e.g., CRM's tabs are Pipeline, Clients, Projects, Quotations, Site Visits, AMC Contracts, Helpdesk).
- A banner near the top will show your **free trial** countdown, if you're on a trial.

---

## C. Complete Module Guide

### CRM

**Purpose:** run the sales pipeline from first contact through to a signed service contract.
**Who should use it:** Admin, Sales Rep.
**How to access:** sidebar → CRM.

**Pipeline (tab: Pipeline)**
Deals ("leads") are shown as cards in six columns: New, Qualified, Quotation Sent, Negotiation, Won, Lost.
- **New Lead** button — opens a form (client, source, product line, value, probability, expected close date, owner, notes). Click **Save** to add it to the New column.
- Each card has a **⋯ menu** → **Move to** — lists only the sensible next stages (you can no longer jump straight from New to Won; you move it forward one stage at a time, or mark it Lost from anywhere).
- **Schedule Site Visit** from the same menu books a visit tied to that lead.
- *Common error:* "Can't move a lead from X directly to Y" — the stage jump you tried isn't allowed; move it through the stage in between first.

**Clients (tab: Clients)**
A directory of customer companies. **New Client** captures name, industry, tier, location, and contact details. Click into a client to see their full history: open deals, projects, quotations, site visits, and service contracts in one place.

**Projects (tab: Projects)**
Projects come from converting an approved quotation (see Quotations below) — there's no separate "new project" button. Inside a project: add **Milestones** (with due dates) and **Tasks** (assignable to any employee). Progress is calculated automatically from how many tasks are done — you don't set it manually.
- Milestone status: click the status badge to see allowed next steps (Planned → In Progress → Completed, or → Delayed if it slips).
- Tasks: click **Start** to begin a task, the checkmark to finish it, or the reopen icon to undo a finished task.

**Quotations (tab: Quotations)**
**New Quotation** — pick a client (and optionally the lead it's for), add line items (description, quantity, unit price — the total is calculated for you), and set a valid-until date.
- Status badge → click to move it forward: Draft → Sent → Under Review → Approved/Rejected.
- Once **Approved**, a **Convert to Project** button appears — turning it into a real project.
- If a quotation comes back Rejected (or needs a re-quote after being sent), click **Revise** — this bumps it to the next revision number and puts it back in Draft so you can send an updated version.
- *Common error:* "Add at least one line item" — every line needs a description, quantity, and price greater than zero.

**Site Visits (tab: Site Visits)**
**New Site Visit** schedules a visit for a client/project/lead, assigned to an employee, with a purpose, date/time, and site contact details.
- **Start** begins the visit (records the actual start time).
- **Reschedule** requires a reason and a new date/time.
- **Complete** opens a form to record the outcome, notes, customer feedback, a follow-up recommendation, and optionally photos.
- **Cancel** stops the visit without completing it.
- Only the assigned employee (any role) or an Admin/Sales user can manage a given visit.

**AMC Contracts (tab: AMC Contracts)**
Service contracts, created from a **completed** project (**New AMC Contract**, only enabled once the linked project is done). The status shown (Active / Expiring Soon / Expired) is calculated live from the contract's end date — you don't need to update it manually, and it will never go stale.

**Helpdesk (tab: Helpdesk)**
**New Ticket** — pick a client, optionally link it to one of their AMC contracts, describe the issue, set a priority, and optionally assign it immediately. Marking a ticket **Critical** automatically alerts all Admins; assigning or reassigning a ticket always notifies whoever it's now assigned to.
- Status: Open → In Progress → Resolved → Closed (you can no longer skip straight from Open to Closed).
- **Resolve** — fill in resolution notes to close it out with a record of what was done.

---

### HRMS

**Purpose:** manage the workforce — who's employed, present, on leave, and paid.
**Who should use it:** Admin, HR.
**How to access:** sidebar → HRMS.

**Overview (tab: Overview)** — at-a-glance counts (active employees, present/absent/on-leave today, pending payroll) and a quick-decide list for pending leave requests.

**Employees (tab: Employees)** — **New Employee** creates both the HR record and, if you set an access role, a portal login (temporary password `demo123`, shown in a welcome notification to them). Click into an employee for their full history: attendance, leave, payroll, timesheets, and documents. **Upload Document** attaches ID proofs, offer letters, contracts, etc. (max 10MB).

**Attendance (tab: Attendance)** — a read-only daily roster; employees check themselves in/out from their own **My HR** page (see below), not from here.

**Leave (tab: Leave)** — every leave request, with **Approve**/**Reject** buttons for pending ones. HR/Admin are now notified automatically the moment someone applies, so nothing needs to be checked manually.

**Payroll (tab: Payroll)** — **Generate Payroll** for a month/year creates a pending record for every active employee who has a salary structure set up (see below). **Process** locks it in — recalculating any unpaid-leave deduction for real, based on actual approved unpaid leave in that period. **Unlock** reverses that if you need to correct something.
- Before payroll can be generated for someone, HR must set up their **Salary Structure** (on their employee detail page) — basic salary, allowances (HRA, DA, travel, medical, special), bonus, and statutory deductions (PF, ESI, professional tax, income tax). This is the one place these numbers are entered directly.

**Timesheets (tab: Timesheets)** — a read-only log of hours employees have logged against projects (they log these themselves from **My HR**), now showing real Billable/Non-billable status.

**Org Chart (tab: Org Chart)** — a visual reporting-line tree, built from each employee's manager.

---

### Vendor Management

**Purpose:** manage suppliers, purchase orders, and what's owed to them.
**Who should use it:** Admin, Procurement.
**How to access:** sidebar → Vendor Management.

**Vendors (tab: Vendors)** — **New Vendor** records a supplier's name, category, contact, and city. Click into a vendor for their star rating (click a star to rate 1–5), total spend, and payment history. A vendor with existing purchase orders or payments can't be deleted.

**Purchase Orders (tab: Purchase Orders)** — **New Purchase Order** picks a vendor, items, amount, and dates; it starts as Draft and goes to an Admin for approval automatically. Once approved it moves to Sent (and a payment record is created for it); once rejected it's Cancelled. **Reorder** clones a past PO with today's date, keeping the same lead time — handy for repeat orders. **Edit** lets you change the details of an existing PO.

**Payments (tab: Payments)** — shows what's owed to vendors. **Mark Paid** records a payment as settled. A payment's Overdue/Pending status is now calculated live against today's date, so it's always accurate without anyone updating it by hand.

---

### GPS & Field Tracking

**Purpose:** see where field staff are and manage service-site visits with real GPS.
**Who should use it:** Admin, Field Crew.
**How to access:** sidebar → GPS & Field Tracking.

**Live Map (tab: Live Map)** — a map showing every checked-in field employee (green, pulsing) and everyone's last known position when off-site (gray). If you're Field Crew, you'll also see your own **check-in card** here.
- **Check in**: pick the site and a purpose, then submit. Your browser will ask for location permission — allow it. If your device's GPS says you're too far from the selected site, check-in is blocked with a message telling you to move closer; this can't be bypassed by accident.
- While checked in, your position is recorded periodically (every few minutes) as long as your browser tab stays open and has GPS permission — not just once at check-in.
- **Check out** ends your visit and records the duration.
- *Common error:* "Location unavailable" / "permission denied" — click **Retry**, and make sure you've allowed location access for the site in your browser settings. If the app is opened over a plain (non-HTTPS) network address, browsers block location entirely — you'll see a message explaining that specifically.

**Visit History (tab: Visit History)** — a log of every check-in/check-out, with duration.

**Geofences (tab: Geofences)** — the list of defined sites (client/project, coordinates, radius). This is currently view-only.

---

### Finance

**Purpose:** track expense reimbursements and department budgets.
**Who should use it:** Admin, Finance. (Any employee can file their own expense claims from **My HR**.)
**How to access:** sidebar → Finance.

**Expense Claims (tab: Expense Claims)** — every claim routes to Finance for approval automatically when filed. Once **Approved**, a **Mark Reimbursed** button appears here.

**Budgets (tab: Budgets)** — **New Budget** proposes an amount for a department/category/date range; it goes to an Admin for approval. Once **Approved**, the card shows a live spend bar — calculated in real time from actual approved/reimbursed expenses matching that department and category, not a number anyone has to update.

---

### My HR (personal workspace)

**Purpose:** everyone's personal daily-use hub — no matter your role.
**How to access:** sidebar → My HR (always visible).

- **Attendance** — one **Check in** / **Check out** button pair per day.
- **Leave** — **Apply for Leave**: pick a type, start/end date, and reason. HR is notified the moment you submit.
- **Timesheet** — **Log Timesheet**: project (optional), date, hours, task description, and a **Billable to client** checkbox (on by default — untick it for internal/non-billable work).
- **Expenses** — **New Expense Claim**: category, amount, date, description. This automatically goes to Finance for approval and they're notified immediately.
- **My Tasks** — a personal to-do board (To Do / In Progress / Done) with priorities, due dates, and comments. If you manage other people, you can also assign tasks to them here (an "Assign to" option appears only for managers) and see **Team Tasks** below your own board.
- **Evening Summary** — a short end-of-day note (what you completed, what's in progress, blockers, etc.) — only one per day; resubmitting the same day updates it rather than creating a duplicate. Managers also see their team's summaries here.

---

### Admin — User & Role Management

**Purpose:** control who can log in and what they can access.
**Who should use it:** Admin only.
**How to access:** sidebar → User Management.

- **New User** — either grant a login to an existing employee who doesn't have one yet, or create a brand-new person (with a temporary password) in one step.
- **Access role** dropdown (in the table) — changes a user's role immediately.
- **Edit (pencil icon)** — change email, role, reset password, and now also tick/untick exactly which modules (CRM, HRMS, Vendor Management, GPS & Field, Finance) this specific person can see — this is the one place you can take away access that was previously granted, not just add to it.
- **Revoke access** — removes someone's login entirely (you can't do this to your own account).
- *Common error:* "Your subscription includes N user licences..." — you've hit your plan's user limit; either free up a licence or upgrade your subscription under **Subscription**.

### Approvals

**Purpose:** a single inbox for anything awaiting your sign-off (purchase orders and budgets for Admins; expense claims for Finance).
**How to access:** sidebar → Approvals.
Each card shows what's being requested and by whom; **Approve** or **Reject** decides it — the requester is notified either way, and the underlying record (PO, claim, or budget) updates automatically.

### Subscription & Billing

**Purpose:** manage your organization's plan and payment.
**How to access:** sidebar → Subscription (or automatically if your trial/access has run out).
Admins see a plan calculator (number of users × modules), a price breakdown, and a payment page with a UPI QR code and bank details. After paying, submit the transaction reference for manual verification — you'll see the payment move from Pending to Approved once reviewed.

---

## D. Recommended End-to-End Workflow

A typical sales-to-service journey through the platform:

1. **Log in** → land on your role's home page.
2. **CRM → Pipeline**: log a new lead, move it through stages as the deal progresses.
3. **CRM → Quotations**: quote the client, get it approved, then **Convert to Project**.
4. **CRM → Projects**: add milestones and tasks, track progress as work completes.
5. **GPS & Field Tracking**: field crew check in/out at the client site during installation.
6. **CRM → AMC Contracts**: once the project is complete, set up a service contract.
7. **CRM → Helpdesk**: log and resolve any support tickets against that contract.
8. **HRMS/Finance**: in parallel, attendance, leave, timesheets, expenses, and payroll keep running for everyone involved.
9. **Approvals**: purchase orders, budgets, and expense claims generated along the way get signed off here.

---

## E. FAQ & Troubleshooting

**I can't see a module I used to see.** Ask your Admin — module access is controlled per-person and can be changed (including removed) in User Management.

**A status dropdown doesn't show the option I want.** This is intentional — the app only lets you move a record through sensible next steps (e.g., a ticket can't jump straight from Open to Closed). Move it through the in-between state first.

**Check-in says I'm too far from the site.** Your device's GPS location doesn't fall within the site's radius. Move closer, or ask an Admin if the site's location needs correcting.

**Location won't turn on at all.** Make sure you're using the app over a secure (https://) address, not a plain http:// one — browsers block location entirely on insecure connections. Also check your browser's site permissions.

**I got a "licence limit reached" message adding a user.** Your organization's plan has a cap on user logins. An Admin can purchase more licences under Subscription.

**A payment/quote submission was rejected as a duplicate.** The transaction reference (UTR) you entered was already used for a previous submission — duplicate payments aren't allowed. Double-check the reference number.

**My session logged me out unexpectedly.** Sessions last 7 days; if it's been reset (e.g., after certain admin changes), just log back in.

---

## F. Glossary

- **AMC** — Annual Maintenance Contract; a paid service agreement covering equipment after a project is complete.
- **Lead / Pipeline** — a potential sale being tracked through stages from first contact to Won or Lost.
- **Quotation (Quote)** — a formal priced proposal sent to a client; can be revised if a client asks for changes.
- **Milestone** — a checkpoint within a project with its own due date and status.
- **Geofence** — a defined circular area around a site used to validate field check-ins.
- **PO (Purchase Order)** — a formal order placed with a vendor, subject to approval.
- **UTR** — Unique Transaction Reference; the bank/UPI reference number for a payment, used to confirm and prevent duplicate submissions.
- **Approval Engine** — the shared workflow that routes purchase orders, expense claims, and budgets to the right role for sign-off.
- **Module** — one of the five major areas of the app (CRM, HRMS, Vendor Management, GPS & Field Tracking, Finance) that can be individually licensed and granted per user.
- **Trial** — a free 5-day period with full access to every module, shown as a countdown banner.
