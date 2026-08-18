// Diagnostic: does a candidate password still verify against the stored hash?
//
// Answers "are these accounts still on demo123?" without guessing and without
// ever revealing a stored password — scrypt is one-way, so this can only
// confirm or deny a password you already supply.
//
//   cd /home/ubuntu/app
//   DATA_DIR=/home/ubuntu/data node scripts/check-password.mjs demo123
//   DATA_DIR=/home/ubuntu/data node scripts/check-password.mjs demo123 '%sachin%'
//
// Arg 1: candidate password (default "demo123")
// Arg 2: optional SQL LIKE pattern for email (default: every user)
import path from "node:path";
import { scryptSync, timingSafeEqual } from "node:crypto";
import Database from "better-sqlite3";

const candidate = process.argv[2] ?? "demo123";
const pattern = process.argv[3] ?? "%";

// Mirrors src/lib/db.ts so this reads the same file the running app does.
const dbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "dev.db")
  : path.join(process.cwd(), "prisma", "dev.db");

// Prefer the application's own verifyPassword so this is the real code path,
// not a lookalike. Falls back to an identical local copy on Node versions
// without TypeScript type-stripping.
let verifyPassword;
let source = "src/lib/password.ts (application code)";
try {
  ({ verifyPassword } = await import("../src/lib/password.ts"));
} catch {
  source = "inline replica (Node too old to import the .ts module)";
  verifyPassword = (password, hash, salt) => {
    const c = scryptSync(password, salt, 64);
    const stored = Buffer.from(hash, "hex");
    return c.length === stored.length && timingSafeEqual(c, stored);
  };
}

function hidden(value) {
  const notes = [];
  if (value !== value.trim()) notes.push("LEADING/TRAILING WHITESPACE");
  if (value !== value.toLowerCase()) notes.push("MIXED CASE");
  if (/[^\x20-\x7E]/.test(value)) notes.push("NON-ASCII CHARACTER");
  return notes.length ? `  <-- ${notes.join(", ")}` : "";
}

const db = new Database(dbPath, { readonly: true });
const users = db
  .prepare("SELECT email, accessRole, passwordHash, passwordSalt FROM User WHERE email LIKE ? ORDER BY email")
  .all(pattern);

console.log(`database   : ${dbPath}`);
console.log(`verifier   : ${source}`);
console.log(`candidate  : "${candidate}" (${candidate.length} chars)`);
console.log(`matching   : ${users.length} user(s) for pattern "${pattern}"\n`);

let ok = 0;
for (const u of users) {
  let result;
  try {
    result = verifyPassword(candidate, u.passwordHash, u.passwordSalt) ? "MATCHES" : "does NOT match";
  } catch (err) {
    result = `ERROR: ${err.message}`;
  }
  if (result === "MATCHES") ok++;
  console.log(`  ${result === "MATCHES" ? "✔" : "✘"} ${String(u.email).padEnd(38)} ${String(u.accessRole).padEnd(12)} ${result}${hidden(u.email)}`);
}
console.log(`\n${ok}/${users.length} account(s) still use "${candidate}".`);
