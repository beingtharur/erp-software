import { describe, expect, it } from "vitest";
import { encrypt, decrypt, type SessionPayload } from "@/lib/session";

const samplePayload: SessionPayload = {
  userId: "user_123",
  accessRole: "ADMIN",
  name: "Test User",
  organizationId: "org_123",
  isSuperAdmin: false,
};

describe("session JWT encrypt/decrypt", () => {
  it("round-trips a session payload", async () => {
    const token = await encrypt(samplePayload);
    const decoded = await decrypt(token);
    expect(decoded?.userId).toBe(samplePayload.userId);
    expect(decoded?.accessRole).toBe(samplePayload.accessRole);
    expect(decoded?.name).toBe(samplePayload.name);
  });

  it("returns null for an undefined token", async () => {
    expect(await decrypt(undefined)).toBeNull();
  });

  it("returns null for a garbage string", async () => {
    expect(await decrypt("not.a.jwt")).toBeNull();
  });

  it("returns null when the payload has been tampered with", async () => {
    const token = await encrypt(samplePayload);
    const [header, payload, signature] = token.split(".");
    // Flip the role claim without re-signing — the signature should no longer verify.
    const tamperedPayloadJson = JSON.stringify({
      ...JSON.parse(Buffer.from(payload, "base64url").toString()),
      accessRole: "ADMIN_ESCALATED",
    });
    const tamperedPayload = Buffer.from(tamperedPayloadJson).toString("base64url");
    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

    expect(await decrypt(tamperedToken)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    // Same claims, but jose will reject cross-key verification — simulate via a corrupted signature.
    const token = await encrypt(samplePayload);
    const corrupted = token.slice(0, -4) + "abcd";
    expect(await decrypt(corrupted)).toBeNull();
  });
});
