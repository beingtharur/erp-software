import { describe, expect, it } from "vitest";
import { navSections, roleSectionAccess, roleHome, roleLabel, visibleSectionsFor } from "@/lib/nav";
import { AccessRole } from "@/generated/prisma/enums";

const allRoles = Object.values(AccessRole);
const allSectionKeys = navSections.map((s) => s.key);

describe("RBAC wiring (nav.ts)", () => {
  it("gives every AccessRole an entry in roleSectionAccess, roleHome, and roleLabel", () => {
    // This is the regression guard for the exact class of bug the platform has today:
    // add a role to the schema and forget to wire up what it can see.
    for (const role of allRoles) {
      expect(roleSectionAccess, `roleSectionAccess is missing ${role}`).toHaveProperty(role);
      expect(roleHome, `roleHome is missing ${role}`).toHaveProperty(role);
      expect(roleLabel, `roleLabel is missing ${role}`).toHaveProperty(role);
    }
  });

  it("only references section keys that actually exist in navSections", () => {
    for (const role of allRoles) {
      for (const key of roleSectionAccess[role]) {
        expect(allSectionKeys, `roleSectionAccess.${role} references unknown section "${key}"`).toContain(key);
      }
    }
  });

  it("gives ADMIN access to every module", () => {
    expect(new Set(roleSectionAccess.ADMIN)).toEqual(new Set(allSectionKeys));
  });

  it("gives every non-ADMIN role at least one module to land on", () => {
    for (const role of allRoles) {
      if (role === "ADMIN") continue;
      expect(roleSectionAccess[role].length, `${role} has no accessible sections`).toBeGreaterThan(0);
    }
  });

  it("points roleHome at a section the role is actually allowed to see (or the dashboard)", () => {
    for (const role of allRoles) {
      const home = roleHome[role];
      if (home === "/") continue; // dashboard is allowed for everyone
      const allowedHrefs = roleSectionAccess[role].flatMap((key) => {
        const section = navSections.find((s) => s.key === key)!;
        return [section.href, ...section.items.map((i) => i.href)];
      });
      expect(allowedHrefs, `roleHome.${role} ("${home}") isn't reachable by ${role}'s own section access`).toContain(home);
    }
  });
});

describe("visibleSectionsFor — role eligibility ∩ per-user grants", () => {
  const keys = (role: Parameters<typeof visibleSectionsFor>[0], grants: string[]) =>
    visibleSectionsFor(role, grants).map((s) => s.key);

  it("shows Field to a sales rep who holds the field grant", () => {
    expect(keys("SALES", ["crm", "field"])).toEqual(["crm", "field"]);
  });

  it("hides Field from a sales rep who does not hold the grant", () => {
    // The regression guard for the other sales reps: making the section
    // role-eligible must not hand it to everyone with the role.
    expect(keys("SALES", ["crm"])).toEqual(["crm"]);
  });

  it("never shows a section the role is not eligible for, even when granted", () => {
    // Grants alone can't unlock a module whose layout role gate would reject
    // the user anyway — that link would dead-end at /access-denied.
    expect(keys("SALES", ["crm", "field", "finance", "hrms", "vendors"])).toEqual(["crm", "field"]);
  });

  it("exposes all three field pages once Field is visible", () => {
    const field = visibleSectionsFor("SALES", ["crm", "field"]).find((s) => s.key === "field");
    expect(field?.items.map((i) => i.href)).toEqual(["/field", "/field/visits", "/field/geofences"]);
  });

  it("keeps procurement's CRM entry filtered to Quotations only", () => {
    const crm = visibleSectionsFor("PROCUREMENT", ["crm", "vendors"]).find((s) => s.key === "crm");
    expect(crm?.items.map((i) => i.href)).toEqual(["/crm/quotations"]);
  });

  it("hides CRM from a procurement user who was never granted it", () => {
    expect(keys("PROCUREMENT", ["vendors"])).toEqual(["vendors"]);
  });

  it("still shows an admin every section they hold", () => {
    expect(new Set(keys("ADMIN", ["crm", "hrms", "vendors", "field", "finance"]))).toEqual(
      new Set(navSections.map((s) => s.key))
    );
  });
});
