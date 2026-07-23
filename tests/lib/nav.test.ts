import { describe, expect, it } from "vitest";
import { navSections, roleSectionAccess, roleHome, roleLabel } from "@/lib/nav";
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
