import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// DATA_DIR points the SQLite file at a persistent-disk mount (e.g. Render's
// /data) in production. Unset locally, so local dev is unaffected — the file
// stays exactly where it's always been, at prisma/dev.db.
const dbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "dev.db")
  : path.join(process.cwd(), "prisma", "dev.db");

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${dbPath}` }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
