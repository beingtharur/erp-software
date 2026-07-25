import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, EmployeeRole, Industry, AccessRole } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: `file:${path.join(__dirname, "dev.db")}` }),
});

// ---------- helpers ----------

function daysAgo(n: number, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function daysFromNow(n: number, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function jitter(coord: number, meters = 1500) {
  const delta = meters / 111_320;
  return coord + (Math.random() - 0.5) * 2 * delta;
}

async function main() {
  console.log("Clearing existing data...");
  await prisma.payment.deleteMany();
  await prisma.subscriptionModule.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.userModuleAccess.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.locationPing.deleteMany();
  await prisma.visitLog.deleteMany();
  await prisma.geofenceZone.deleteMany();
  await prisma.timesheet.deleteMany();
  await prisma.payrollRecord.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.vendorPayment.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.expenseClaim.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.employeeDocument.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.amcContract.deleteMany();
  await prisma.siteVisit.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.projectTask.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.personalTask.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.organization.deleteMany();

  // ---------- Organization ----------
  // This app is multi-tenant: every root record (User, Employee, Client, Vendor,
  // GeofenceZone) belongs to one Organization. Everything else is scoped
  // transitively through those (e.g. LeaveRequest via employee.organizationId).
  console.log("Seeding organization...");

  const org = await prisma.organization.create({
    data: { name: "EOS Techno", slug: "eos-techno" },
  });

  const MODULES = ["crm", "hrms", "vendors", "field", "finance"] as const;
  const roleModules: Record<AccessRole, string[]> = {
    ADMIN: ["crm", "hrms", "vendors", "field", "finance"],
    SALES: ["crm"],
    FIELD: ["field"],
    HR: ["hrms"],
    PROCUREMENT: ["vendors"],
    FINANCE: ["finance"],
  };

  await prisma.subscription.create({
    data: {
      organizationId: org.id,
      status: "ACTIVE",
      trialStartedAt: daysAgo(30),
      trialEndsAt: daysAgo(25),
      currentPeriodStart: new Date(),
      currentPeriodEnd: daysFromNow(365),
      licencedUsers: 50,
      modules: { create: MODULES.map((module) => ({ module })) },
    },
  });

  // Platform operator — reviews payments across every organization, so it
  // deliberately belongs to none.
  const platformHash = hashPassword("demo123");
  await prisma.user.create({
    data: {
      email: "platform-admin@eostechno.internal",
      passwordHash: platformHash.hash,
      passwordSalt: platformHash.salt,
      accessRole: "ADMIN",
      isSuperAdmin: true,
    },
  });

  // ---------- Employees ----------
  console.log("Seeding employees...");

  const employeeSeed: {
    code: string;
    name: string;
    role: EmployeeRole;
    department: string;
    location: string;
  }[] = [
    // Leadership / PM
    { code: "EOS-001", name: "Manan Vora", role: "PROJECT_MANAGER", department: "Leadership", location: "Vadodara, GJ" },
    { code: "EOS-002", name: "Ritesh Kanade", role: "PROJECT_MANAGER", department: "Projects", location: "Vadodara, GJ" },
    { code: "EOS-003", name: "Alisha Fernandes", role: "PROJECT_MANAGER", department: "Projects", location: "Pune, MH" },
    // Engineers
    { code: "EOS-004", name: "Devendra Solanki", role: "ENGINEER", department: "Process Engineering", location: "Vadodara, GJ" },
    { code: "EOS-005", name: "Priyanka Deshmukh", role: "ENGINEER", department: "Process Engineering", location: "Ankleshwar, GJ" },
    { code: "EOS-006", name: "Sameer Iqbal", role: "ENGINEER", department: "Piping & Design", location: "Vadodara, GJ" },
    { code: "EOS-007", name: "Kavya Ramachandran", role: "ENGINEER", department: "Containment Systems", location: "Hyderabad, TG" },
    // Sales reps
    { code: "EOS-008", name: "Nikhil Bhatt", role: "SALES_REP", department: "Sales — West", location: "Mumbai, MH" },
    { code: "EOS-009", name: "Sanya Kapoor", role: "SALES_REP", department: "Sales — West", location: "Pune, MH" },
    { code: "EOS-010", name: "Rahul Trivedi", role: "SALES_REP", department: "Sales — Gujarat", location: "Ankleshwar, GJ" },
    { code: "EOS-011", name: "Meera Pillai", role: "SALES_REP", department: "Sales — South", location: "Hyderabad, TG" },
    { code: "EOS-012", name: "Aarav Chandran", role: "SALES_REP", department: "Sales — North", location: "Baddi, HP" },
    // Installation crew
    { code: "EOS-013", name: "Suresh Yadav", role: "INSTALLATION_CREW", department: "Installation", location: "Vadodara, GJ" },
    { code: "EOS-014", name: "Ganesh Pawar", role: "INSTALLATION_CREW", department: "Installation", location: "Pune, MH" },
    { code: "EOS-015", name: "Irfan Sheikh", role: "INSTALLATION_CREW", department: "Installation", location: "Ankleshwar, GJ" },
    { code: "EOS-016", name: "Vikram Naik", role: "INSTALLATION_CREW", department: "Installation", location: "Jamnagar, GJ" },
    { code: "EOS-017", name: "Ashok Meena", role: "INSTALLATION_CREW", department: "Installation", location: "Taloja, MH" },
    { code: "EOS-018", name: "Dilip Chauhan", role: "INSTALLATION_CREW", department: "Installation", location: "Dahej, GJ" },
    // Technicians
    { code: "EOS-019", name: "Ramesh Gaikwad", role: "TECHNICIAN", department: "Service & Maintenance", location: "Vadodara, GJ" },
    { code: "EOS-020", name: "Farhan Shaikh", role: "TECHNICIAN", department: "Service & Maintenance", location: "Pune, MH" },
    { code: "EOS-021", name: "Deepak Rathi", role: "TECHNICIAN", department: "Service & Maintenance", location: "Ankleshwar, GJ" },
    { code: "EOS-022", name: "Naveen Kumar", role: "TECHNICIAN", department: "Service & Maintenance", location: "Visakhapatnam, AP" },
    { code: "EOS-023", name: "Bhavesh Solanki", role: "TECHNICIAN", department: "Service & Maintenance", location: "Baddi, HP" },
    { code: "EOS-024", name: "Yogesh Kale", role: "TECHNICIAN", department: "Service & Maintenance", location: "Chakan, MH" },
    // Admin / HR / Finance
    { code: "EOS-025", name: "Pooja Nair", role: "HR", department: "Human Resources", location: "Vadodara, GJ" },
    { code: "EOS-026", name: "Ankit Shah", role: "FINANCE", department: "Finance & Accounts", location: "Vadodara, GJ" },
    { code: "EOS-027", name: "Reema Joshi", role: "ADMIN", department: "Administration", location: "Vadodara, GJ" },
    { code: "EOS-028", name: "Tanvi Mehta", role: "ADMIN", department: "Procurement", location: "Vadodara, GJ" },
  ];

  const employees: Record<string, Awaited<ReturnType<typeof prisma.employee.create>>> = {};
  for (const [i, e] of employeeSeed.entries()) {
    const emp = await prisma.employee.create({
      data: {
        employeeCode: e.code,
        name: e.name,
        role: e.role,
        department: e.department,
        email: `${e.name.toLowerCase().replace(/\s+/g, ".")}@eostechno.com`,
        phone: `+91 9${randInt(100000000, 999999999)}`,
        dateOfJoining: daysAgo(randInt(120, 1800)),
        baseLocation: e.location,
        avatarSeed: e.code,
        organizationId: org.id,
        reportingToId: i < 3 ? null : employees["EOS-001"]?.id ?? null,
      },
    });
    employees[e.code] = emp;
  }

  // ---------- Login accounts (demo password: "demo123") ----------
  console.log("Seeding demo login accounts...");

  const { hash: demoHash, salt: demoSalt } = hashPassword("demo123");

  const loginSeed: { code: string; role: AccessRole; email: string }[] = [
    { code: "EOS-001", role: "ADMIN", email: "manan.vora@eostechno.com" },
    { code: "EOS-008", role: "SALES", email: "nikhil.bhatt@eostechno.com" },
    { code: "EOS-013", role: "FIELD", email: "suresh.yadav@eostechno.com" },
    { code: "EOS-025", role: "HR", email: "pooja.nair@eostechno.com" },
    { code: "EOS-028", role: "PROCUREMENT", email: "tanvi.mehta@eostechno.com" },
    { code: "EOS-026", role: "FINANCE", email: "ankit.shah@eostechno.com" },
  ];

  for (const l of loginSeed) {
    const user = await prisma.user.create({
      data: {
        email: l.email,
        passwordHash: demoHash,
        passwordSalt: demoSalt,
        accessRole: l.role,
        employeeId: employees[l.code].id,
        organizationId: org.id,
      },
    });
    await prisma.userModuleAccess.createMany({
      data: roleModules[l.role].map((module) => ({ userId: user.id, module })),
    });
  }

  const fieldRoles: EmployeeRole[] = ["INSTALLATION_CREW", "TECHNICIAN", "SALES_REP"];
  const fieldEmployees = Object.values(employees).filter((e) => fieldRoles.includes(e.role));

  // ---------- Clients ----------
  console.log("Seeding clients...");

  const clientSeed: {
    name: string;
    industry: Industry;
    tier: string;
    city: string;
    state: string;
    contactName: string;
    contactTitle: string;
    status: string;
    lat: number;
    lng: number;
  }[] = [
    { name: "JSW Group", industry: "CHEMICALS", tier: "Strategic", city: "Dolvi", state: "Maharashtra", contactName: "Rajeev Ahluwalia", contactTitle: "VP — Procurement", status: "Active", lat: 18.0217, lng: 73.04 },
    { name: "Reliance Industries", industry: "CHEMICALS", tier: "Strategic", city: "Jamnagar", state: "Gujarat", contactName: "Kunal Bhargava", contactTitle: "GM — Engineering", status: "Active", lat: 22.2394, lng: 70.0577 },
    { name: "Parker Hannifin", industry: "PHARMACEUTICALS", tier: "Enterprise", city: "Pune", state: "Maharashtra", contactName: "Sandra D'Souza", contactTitle: "Head of Process Filtration", status: "Active", lat: 18.5204, lng: 73.8567 },
    { name: "Deepak Fertilizers", industry: "CHEMICALS", tier: "Strategic", city: "Taloja", state: "Maharashtra", contactName: "Milind Kulkarni", contactTitle: "Plant Head", status: "Active", lat: 19.0257, lng: 73.1097 },
    { name: "Sanskar Lifesciences", industry: "PHARMACEUTICALS", tier: "Enterprise", city: "Ankleshwar", state: "Gujarat", contactName: "Dr. Neha Rawal", contactTitle: "Director — Operations", status: "Active", lat: 21.6266, lng: 73.0104 },
    { name: "NovaBiotics Biotech Park", industry: "BIOTECH", tier: "Growth", city: "Hyderabad", state: "Telangana", contactName: "Dr. Suraj Menon", contactTitle: "Facilities Director", status: "Active", lat: 17.5561, lng: 78.5847 },
    { name: "Purnima Cosmetics", industry: "COSMETICS", tier: "Growth", city: "Baddi", state: "Himachal Pradesh", contactName: "Aditi Rana", contactTitle: "Head of Manufacturing", status: "Active", lat: 30.9578, lng: 76.7914 },
    { name: "Annapurna Agro Foods", industry: "FOOD_AND_BEVERAGE", tier: "Enterprise", city: "Chakan, Pune", state: "Maharashtra", contactName: "Vivek Salvi", contactTitle: "Plant Engineering Head", status: "Active", lat: 18.7574, lng: 73.8608 },
    { name: "Meridian Speciality Chemicals", industry: "CHEMICALS", tier: "Enterprise", city: "Dahej", state: "Gujarat", contactName: "Harsh Vardhan", contactTitle: "VP Operations", status: "Active", lat: 21.7051, lng: 72.5626 },
    { name: "Kavya Pharma Labs", industry: "PHARMACEUTICALS", tier: "Growth", city: "Visakhapatnam", state: "Andhra Pradesh", contactName: "Dr. Lakshmi Prasad", contactTitle: "Head of Engineering", status: "Active", lat: 17.6868, lng: 83.2185 },
    { name: "Sarvodaya Speciality Chemicals", industry: "CHEMICALS", tier: "Growth", city: "Ankleshwar", state: "Gujarat", contactName: "Jignesh Patel", contactTitle: "Procurement Manager", status: "Prospect", lat: 21.63, lng: 73.02 },
    { name: "Himalaya Nutra Foods", industry: "FOOD_AND_BEVERAGE", tier: "Growth", city: "Baddi", state: "Himachal Pradesh", contactName: "Ritu Chawla", contactTitle: "Operations Manager", status: "Prospect", lat: 30.96, lng: 76.79 },
    { name: "CellGen Biotech", industry: "BIOTECH", tier: "Growth", city: "Bengaluru", state: "Karnataka", contactName: "Dr. Arvind Rao", contactTitle: "Site Head", status: "Prospect", lat: 12.9716, lng: 77.5946 },
  ];

  const clients: Record<string, Awaited<ReturnType<typeof prisma.client.create>>> = {};
  for (const c of clientSeed) {
    const client = await prisma.client.create({
      data: {
        name: c.name,
        industry: c.industry,
        tier: c.tier,
        city: c.city,
        state: c.state,
        contactName: c.contactName,
        contactTitle: c.contactTitle,
        contactEmail: `${c.contactName.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, ".")}@${c.name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12)}.com`,
        contactPhone: `+91 8${randInt(100000000, 999999999)}`,
        logoSeed: c.name,
        status: c.status,
        organizationId: org.id,
      },
    });
    clients[c.name] = client;

    if (c.status === "Active") {
      await prisma.geofenceZone.create({
        data: {
          name: `${c.name} — ${c.city} Site`,
          clientId: client.id,
          latitude: c.lat,
          longitude: c.lng,
          radiusMeters: randInt(300, 600),
          organizationId: org.id,
        },
      });
    }
  }

  await prisma.geofenceZone.create({
    data: {
      name: "EOS Techno HQ — Vadodara",
      latitude: 22.3072,
      longitude: 73.1812,
      radiusMeters: 250,
      organizationId: org.id,
    },
  });

  const geofences = await prisma.geofenceZone.findMany();
  const geofenceByClient = new Map(geofences.filter((g) => g.clientId).map((g) => [g.clientId as string, g]));

  // ---------- Projects ----------
  console.log("Seeding projects...");

  const productLines = ["PROCESS_EQUIPMENT", "CONTAINMENT_SYSTEMS", "PIPING_DISTRIBUTION", "TURNKEY_PROJECTS"] as const;
  const activeClients = Object.values(clients).filter((c) => c.status === "Active");
  const projects: Awaited<ReturnType<typeof prisma.project.create>>[] = [];

  const projectStatuses = ["PLANNING", "IN_PROGRESS", "COMMISSIONING", "COMPLETED"] as const;
  const projectNameByLine: Record<string, string> = {
    PROCESS_EQUIPMENT: "Process Skid Fabrication & Supply",
    CONTAINMENT_SYSTEMS: "Containment Isolator Upgrade",
    PIPING_DISTRIBUTION: "Piping & Distribution Network Revamp",
    TURNKEY_PROJECTS: "Turnkey Facility Build-out",
  };

  for (const client of activeClients) {
    const numProjects = randInt(1, 2);
    for (let i = 0; i < numProjects; i++) {
      const line = pick([...productLines]);
      const status = pick([...projectStatuses]);
      const start = daysAgo(randInt(30, 400));
      const target = daysFromNow(randInt(20, 240));
      const project = await prisma.project.create({
        data: {
          name: `${client.name} — ${projectNameByLine[line]}`,
          clientId: client.id,
          productLine: line,
          industry: client.industry,
          value: randInt(2500000, 48000000),
          startDate: start,
          targetEndDate: target,
          status,
          progressPercent: status === "COMPLETED" ? 100 : status === "COMMISSIONING" ? randInt(75, 95) : status === "IN_PROGRESS" ? randInt(25, 74) : randInt(0, 15),
        },
      });
      projects.push(project);
    }
  }

  // ---------- Leads ----------
  console.log("Seeding leads...");

  const leadSources = ["RFQ", "TENDER", "REFERRAL", "WEBSITE", "EXHIBITION"] as const;
  const leadStages = ["NEW", "QUALIFIED", "QUOTATION_SENT", "NEGOTIATION", "WON", "LOST"] as const;
  const stageWeights: Record<(typeof leadStages)[number], number> = {
    NEW: 7,
    QUALIFIED: 6,
    QUOTATION_SENT: 6,
    NEGOTIATION: 4,
    WON: 5,
    LOST: 3,
  };
  const weightedStages: (typeof leadStages)[number][] = [];
  for (const s of leadStages) for (let i = 0; i < stageWeights[s]; i++) weightedStages.push(s);

  const salesReps = Object.values(employees).filter((e) => e.role === "SALES_REP");
  const allClients = Object.values(clients);
  const leads: Awaited<ReturnType<typeof prisma.lead.create>>[] = [];

  const leadTitleTemplates = [
    "SS316L Process Skid — RFQ",
    "Cleanroom Containment Isolator Package",
    "Plant-wide Piping Distribution Revamp",
    "Turnkey Utility Block for New Line",
    "Reactor Vessel Fabrication & Install",
    "CIP/SIP Skid Package",
    "Bulk Powder Containment System",
    "Effluent Treatment Piping Upgrade",
    "Modular Process Equipment — Expansion Line",
    "Annual Tender — Process Equipment Panel",
  ];

  for (let i = 0; i < 34; i++) {
    const client = pick(allClients);
    const stage = pick(weightedStages);
    const created = daysAgo(randInt(5, 200));
    const lead = await prisma.lead.create({
      data: {
        title: `${client.name} — ${pick(leadTitleTemplates)}`,
        clientId: client.id,
        source: pick([...leadSources]),
        productLine: pick([...productLines]),
        stage,
        value: randInt(800000, 32000000),
        probability: stage === "WON" ? 100 : stage === "LOST" ? 0 : stage === "NEGOTIATION" ? randInt(60, 85) : stage === "QUOTATION_SENT" ? randInt(35, 60) : stage === "QUALIFIED" ? randInt(15, 35) : randInt(5, 15),
        expectedCloseDate: daysFromNow(randInt(-10, 90)),
        ownerId: pick(salesReps).id,
        createdAt: created,
        updatedAt: created,
      },
    });
    leads.push(lead);
  }

  // ---------- Quotations ----------
  console.log("Seeding quotations...");

  const quoteStatuses = ["DRAFT", "SENT", "UNDER_REVIEW", "APPROVED", "REJECTED"] as const;
  const leadsWithQuotes = leads.filter((l) => ["QUOTATION_SENT", "NEGOTIATION", "WON", "LOST"].includes(l.stage));
  let quoteCounter = 1001;

  for (const lead of leadsWithQuotes) {
    const revisions = randInt(1, 2);
    for (let r = 1; r <= revisions; r++) {
      const status = lead.stage === "WON" ? "APPROVED" : lead.stage === "LOST" ? "REJECTED" : pick([...quoteStatuses]);
      await prisma.quotation.create({
        data: {
          quoteNumber: `QT-${quoteCounter++}`,
          leadId: lead.id,
          clientId: lead.clientId,
          amount: lead.value * (1 - (revisions - r) * 0.04),
          status,
          revision: r,
          validUntil: daysFromNow(randInt(10, 60)),
          issuedOn: daysAgo(randInt(2, 90)),
        },
      });
    }
  }

  // ---------- Site Visits ----------
  console.log("Seeding site visits...");

  const visitPurposes = ["Site survey", "Installation kickoff", "Progress review", "Client escalation", "AMC service visit", "Commissioning support", "Quotation walkthrough"];
  const fieldAndSales = [...fieldEmployees, ...salesReps];

  for (let i = 0; i < 26; i++) {
    const client = pick(allClients);
    const isPast = Math.random() < 0.6;
    await prisma.siteVisit.create({
      data: {
        clientId: client.id,
        projectId: Math.random() < 0.5 ? pick(projects.filter((p) => p.clientId === client.id))?.id ?? null : null,
        purpose: pick(visitPurposes),
        scheduledDate: isPast ? daysAgo(randInt(1, 45)) : daysFromNow(randInt(1, 30)),
        assignedToId: pick(fieldAndSales).id,
        status: isPast ? pick(["COMPLETED", "COMPLETED", "CANCELLED"] as const) : "SCHEDULED",
        notes: isPast ? "Visit completed, report shared with client." : null,
        followUpDate: isPast && Math.random() < 0.4 ? daysFromNow(randInt(3, 20)) : null,
      },
    });
  }

  // ---------- AMC Contracts ----------
  console.log("Seeding AMC contracts...");

  let amcCounter = 501;
  for (const client of activeClients.slice(0, 8)) {
    const start = daysAgo(randInt(60, 500));
    const end = daysFromNow(randInt(-20, 300));
    const status = end < new Date() ? "EXPIRED" : end < daysFromNow(30) ? "EXPIRING_SOON" : "ACTIVE";
    await prisma.amcContract.create({
      data: {
        contractNumber: `AMC-${amcCounter++}`,
        clientId: client.id,
        equipmentCovered: pick(["Process skids & CIP system", "Containment isolators", "Piping network & valves", "Reactor vessels & agitators"]),
        startDate: start,
        endDate: end,
        value: randInt(600000, 4200000),
        status,
        lastServiceDate: daysAgo(randInt(10, 80)),
        nextServiceDate: daysFromNow(randInt(5, 90)),
      },
    });
  }

  // ---------- Vendors ----------
  console.log("Seeding vendors...");

  const vendorSeed = [
    { name: "Bhavani Steel & Alloys", category: "Raw Material — SS Sheets & Pipes", city: "Ahmedabad" },
    { name: "Krishna Fabrication Works", category: "Fabrication", city: "Vadodara" },
    { name: "Voltas Instrumentation Co.", category: "Electrical & Instrumentation", city: "Pune" },
    { name: "Speedway Logistics", category: "Logistics & Transport", city: "Mumbai" },
    { name: "Om Valves & Fittings", category: "Valves & Fittings", city: "Ahmedabad" },
    { name: "Thermocore Insulation", category: "Insulation", city: "Vadodara" },
    { name: "Arc Weld Consumables", category: "Welding Consumables", city: "Surat" },
    { name: "Precision Gaskets India", category: "Gaskets & Seals", city: "Pune" },
    { name: "Metro Crane & Rigging", category: "Erection & Rigging", city: "Vadodara" },
    { name: "Sunrise Powder Coatings", category: "Surface Finishing", city: "Ankleshwar" },
    { name: "National Bearings Corp", category: "Mechanical Components", city: "Mumbai" },
    { name: "Gujarat Pipe Traders", category: "Raw Material — SS Sheets & Pipes", city: "Ankleshwar" },
    { name: "Apex Motor & Drives", category: "Electrical & Instrumentation", city: "Pune" },
    { name: "Coastal Freight Movers", category: "Logistics & Transport", city: "Surat" },
  ];

  const vendors: Awaited<ReturnType<typeof prisma.vendor.create>>[] = [];
  for (const v of vendorSeed) {
    const vendor = await prisma.vendor.create({
      data: {
        name: v.name,
        category: v.category,
        contactName: pick(["Rakesh Modi", "Sunita Iyer", "Prakash Bhosale", "Farida Sheikh", "Vinod Chaudhary"]),
        contactEmail: `contact@${v.name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 14)}.com`,
        contactPhone: `+91 7${randInt(100000000, 999999999)}`,
        city: v.city,
        rating: Number((3.4 + Math.random() * 1.6).toFixed(1)),
        status: "Active",
        organizationId: org.id,
      },
    });
    vendors.push(vendor);
  }

  // ---------- Purchase Orders + Payments ----------
  console.log("Seeding purchase orders & payments...");

  const poStatuses = ["DRAFT", "SENT", "CONFIRMED", "DELIVERED", "CANCELLED"] as const;
  let poCounter = 7001;
  for (let i = 0; i < 22; i++) {
    const vendor = pick(vendors);
    const status = pick([...poStatuses]);
    const orderDate = daysAgo(randInt(2, 90));
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-${poCounter++}`,
        vendorId: vendor.id,
        itemsDescription: pick(["SS316 sheets — 2mm x 1250 x 2500", "Pneumatic control valves (DN50)", "PTFE gaskets — bulk order", "Structural steel for skid frame", "Instrumentation cabling — 500m", "Welding electrodes & consumables"]),
        amount: randInt(45000, 1850000),
        orderDate,
        expectedDelivery: new Date(orderDate.getTime() + randInt(7, 30) * 86400000),
        status,
      },
    });

    if (status !== "DRAFT" && status !== "CANCELLED") {
      const dueDate = daysFromNow(randInt(-15, 30));
      const isPaid = Math.random() < 0.55;
      const isOverdue = !isPaid && dueDate < new Date();
      await prisma.vendorPayment.create({
        data: {
          vendorId: vendor.id,
          purchaseOrderId: po.id,
          amount: po.amount,
          dueDate,
          paidDate: isPaid ? daysAgo(randInt(0, 20)) : null,
          status: isPaid ? "PAID" : isOverdue ? "OVERDUE" : "PENDING",
          method: isPaid ? pick(["NEFT", "RTGS", "Cheque"]) : null,
        },
      });
    }
  }

  // ---------- Attendance ----------
  console.log("Seeding attendance...");

  const allEmployees = Object.values(employees);
  for (const emp of allEmployees) {
    for (let d = 0; d < 21; d++) {
      const date = daysAgo(d, 0, 0);
      const day = date.getDay();
      if (day === 0) {
        await prisma.attendance.create({ data: { employeeId: emp.id, date, status: "HOLIDAY", hoursWorked: 0 } });
        continue;
      }
      const roll = Math.random();
      let status: "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE" = "PRESENT";
      let hours = 8 + Math.random() * 1.5;
      if (roll < 0.05) { status = "ABSENT"; hours = 0; }
      else if (roll < 0.09) { status = "ON_LEAVE"; hours = 0; }
      else if (roll < 0.13) { status = "HALF_DAY"; hours = 4; }

      await prisma.attendance.create({
        data: {
          employeeId: emp.id,
          date,
          status,
          hoursWorked: Number(hours.toFixed(1)),
          checkIn: status === "PRESENT" || status === "HALF_DAY" ? new Date(date.getTime() + (9 * 60 + randInt(-15, 20)) * 60000) : null,
          checkOut: status === "PRESENT" ? new Date(date.getTime() + (18 * 60 + randInt(-20, 30)) * 60000) : status === "HALF_DAY" ? new Date(date.getTime() + 13 * 60 * 60000) : null,
        },
      });
    }
  }

  // ---------- Leave Requests ----------
  console.log("Seeding leave requests...");

  const leaveTypes = ["SICK", "CASUAL", "EARNED", "UNPAID"] as const;
  const leaveStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
  for (let i = 0; i < 16; i++) {
    const emp = pick(allEmployees);
    const start = Math.random() < 0.3 ? daysFromNow(randInt(1, 20)) : daysAgo(randInt(1, 40));
    const days = randInt(1, 4);
    const end = new Date(start.getTime() + (days - 1) * 86400000);
    const status = start > new Date() ? pick(["PENDING", "APPROVED"] as const) : pick([...leaveStatuses]);
    await prisma.leaveRequest.create({
      data: {
        employeeId: emp.id,
        type: pick([...leaveTypes]),
        startDate: start,
        endDate: end,
        days,
        status,
        reason: pick(["Personal work", "Family function", "Medical appointment", "Not keeping well", "Travel to hometown"]),
        appliedOn: new Date(start.getTime() - randInt(1, 6) * 86400000),
        decidedOn: status !== "PENDING" ? new Date(start.getTime() - randInt(0, 3) * 86400000) : null,
        decidedBy: status !== "PENDING" ? employees["EOS-025"].name : null,
      },
    });
  }

  // ---------- Finance: Expense Claims + Budgets ----------
  console.log("Seeding expense claims & budgets...");

  const expenseCategories = ["TRAVEL", "MEALS", "SUPPLIES", "EQUIPMENT", "SOFTWARE", "OTHER"] as const;
  const claimStatuses = ["PENDING", "APPROVED", "REJECTED", "REIMBURSED"] as const;
  let claimCounter = 2001;
  for (let i = 0; i < 20; i++) {
    const emp = pick(allEmployees);
    const status = pick([...claimStatuses]);
    const expenseDate = daysAgo(randInt(1, 60));
    await prisma.expenseClaim.create({
      data: {
        claimNumber: `EXP-${claimCounter++}`,
        employeeId: emp.id,
        category: pick([...expenseCategories]),
        amount: randInt(800, 45000),
        expenseDate,
        description: pick([
          "Client site visit travel",
          "Team lunch during commissioning",
          "Office supplies restock",
          "Replacement laptop charger",
          "Software license renewal",
          "Courier charges for documents",
        ]),
        status,
        reimbursedOn: status === "REIMBURSED" ? new Date(expenseDate.getTime() + randInt(3, 15) * 86400000) : null,
      },
    });
  }

  const departments = Array.from(new Set(allEmployees.map((e) => e.department)));
  const budgetStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
  for (let i = 0; i < 8; i++) {
    const department = pick(departments);
    const start = daysAgo(randInt(30, 90));
    await prisma.budget.create({
      data: {
        department,
        category: pick([...expenseCategories]),
        startDate: start,
        endDate: new Date(start.getTime() + 90 * 86400000),
        proposedAmount: randInt(50000, 500000),
        requestedById: employees["EOS-026"].id,
        status: pick([...budgetStatuses]),
      },
    });
  }

  // ---------- Payroll ----------
  console.log("Seeding payroll...");

  const baseSalaryByRole: Record<EmployeeRole, number> = {
    INSTALLATION_CREW: 32000,
    TECHNICIAN: 34000,
    SALES_REP: 45000,
    ENGINEER: 58000,
    PROJECT_MANAGER: 95000,
    ADMIN: 38000,
    HR: 50000,
    FINANCE: 52000,
  };

  const now = new Date();
  for (const emp of allEmployees) {
    for (let m = 0; m < 3; m++) {
      const date = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const basic = baseSalaryByRole[emp.role];
      const allowances = Math.round(basic * 0.32);
      const deductions = Math.round(basic * 0.09);
      await prisma.payrollRecord.create({
        data: {
          employeeId: emp.id,
          month: date.getMonth() + 1,
          year: date.getFullYear(),
          basicSalary: basic,
          allowances,
          deductions,
          netPay: basic + allowances - deductions,
          status: m === 0 ? "PENDING" : "PROCESSED",
          paidOn: m === 0 ? null : new Date(date.getFullYear(), date.getMonth() + 1, 2),
        },
      });
    }
  }

  // ---------- Timesheets ----------
  console.log("Seeding timesheets...");

  const timesheetTasks = ["Skid assembly", "Piping fit-up", "Client review meeting", "Documentation & QA", "Instrumentation wiring", "Site survey", "Punch list closure", "Commissioning support"];
  const engAndCrew = allEmployees.filter((e) => ["ENGINEER", "INSTALLATION_CREW", "TECHNICIAN", "PROJECT_MANAGER"].includes(e.role));

  for (let i = 0; i < 70; i++) {
    const emp = pick(engAndCrew);
    const project = pick(projects);
    await prisma.timesheet.create({
      data: {
        employeeId: emp.id,
        projectId: project.id,
        date: daysAgo(randInt(0, 21)),
        hoursLogged: Number((2 + Math.random() * 7).toFixed(1)),
        taskDescription: pick(timesheetTasks),
        billable: Math.random() < 0.85,
      },
    });
  }

  // ---------- GPS: location pings + visit logs ----------
  console.log("Seeding GPS pings & visit logs...");

  for (const emp of fieldEmployees) {
    const zone = pick(geofences.filter((g) => g.clientId));
    for (let i = 0; i < 4; i++) {
      await prisma.locationPing.create({
        data: {
          employeeId: emp.id,
          latitude: jitter(zone.latitude, 400),
          longitude: jitter(zone.longitude, 400),
          timestamp: new Date(Date.now() - i * 20 * 60000),
          geofenceId: zone.id,
        },
      });
    }
  }

  for (let i = 0; i < 34; i++) {
    const emp = pick(fieldEmployees);
    const zone = pick(geofences.filter((g) => g.clientId));
    const isActive = i < 7;
    const checkIn = isActive ? new Date(Date.now() - randInt(20, 240) * 60000) : daysAgo(randInt(1, 20), randInt(8, 11));
    await prisma.visitLog.create({
      data: {
        employeeId: emp.id,
        geofenceId: zone.id,
        purpose: pick(visitPurposes),
        checkInTime: checkIn,
        checkOutTime: isActive ? null : new Date(checkIn.getTime() + randInt(60, 300) * 60000),
        durationMinutes: isActive ? null : randInt(60, 300),
        status: isActive ? "CHECKED_IN" : "CHECKED_OUT",
        notes: isActive ? null : "Work completed as per checklist.",
      },
    });
  }

  // ---------- Second organization ----------
  // Minimal second tenant, seeded purely so cross-org data isolation can be
  // verified live (log in as this org, confirm EOS Techno's data is invisible).
  console.log("Seeding second organization for isolation testing...");

  const secondOrg = await prisma.organization.create({
    data: { name: "Vasant Industrial Supplies", slug: "vasant-industrial" },
  });

  const secondEmployee = await prisma.employee.create({
    data: {
      employeeCode: "VIS-001",
      name: "Kiran Deshpande",
      role: "ADMIN",
      department: "Leadership",
      email: "kiran.deshpande@vasantindustrial.com",
      phone: "+91 9800000001",
      dateOfJoining: daysAgo(10),
      baseLocation: "Nashik, MH",
      avatarSeed: "VIS-001",
      organizationId: secondOrg.id,
    },
  });

  const secondUserHash = hashPassword("demo123");
  const secondUser = await prisma.user.create({
    data: {
      email: "kiran.deshpande@vasantindustrial.com",
      passwordHash: secondUserHash.hash,
      passwordSalt: secondUserHash.salt,
      accessRole: "ADMIN",
      employeeId: secondEmployee.id,
      organizationId: secondOrg.id,
    },
  });
  await prisma.userModuleAccess.createMany({
    data: MODULES.map((module) => ({ userId: secondUser.id, module })),
  });

  await prisma.client.create({
    data: {
      name: "Deccan Pharma Labs",
      industry: "PHARMACEUTICALS",
      tier: "Gold",
      city: "Nashik",
      state: "Maharashtra",
      contactName: "Rohan Patil",
      contactTitle: "Plant Head",
      contactEmail: "rohan.patil@deccanpharma.example",
      contactPhone: "+91 9800000099",
      logoSeed: "deccan-pharma",
      organizationId: secondOrg.id,
    },
  });

  await prisma.subscription.create({
    data: {
      organizationId: secondOrg.id,
      status: "TRIAL",
      trialStartedAt: new Date(),
      trialEndsAt: daysFromNow(5),
      licencedUsers: 5,
    },
  });

  console.log(
    `Second org "${secondOrg.name}" ready: login ${secondUser.email} / demo123, 5-day trial, 1 client.`
  );

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
