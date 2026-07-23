import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("verifies a correct password against its own hash", () => {
    const { hash, salt } = hashPassword("correct-horse-battery-staple");
    expect(verifyPassword("correct-horse-battery-staple", hash, salt)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const { hash, salt } = hashPassword("correct-horse-battery-staple");
    expect(verifyPassword("wrong-password", hash, salt)).toBe(false);
  });

  it("rejects the correct password against a different salt", () => {
    const { hash } = hashPassword("correct-horse-battery-staple");
    const { salt: otherSalt } = hashPassword("unrelated-password");
    expect(verifyPassword("correct-horse-battery-staple", hash, otherSalt)).toBe(false);
  });

  it("produces a different salt (and hash) on every call, even for the same password", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("never accepts an empty candidate password against a real hash", () => {
    const { hash, salt } = hashPassword("demo123");
    expect(verifyPassword("", hash, salt)).toBe(false);
  });
});
