// Throwaway: inspects the subscription a freshly registered org received.
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: "file:./prisma/dev.db" }),
});

async function main() {
  const orgs = await prisma.organization.findMany({
    where: { name: { startsWith: "ZZ DevMode" } },
    include: { subscription: { include: { modules: true } } },
  });
  for (const org of orgs) {
    const s = org.subscription;
    process.stdout.write(
      `${org.name}\n` +
        `  status=${s?.status} licencedUsers=${s?.licencedUsers}\n` +
        `  trialEndsAt=${s?.trialEndsAt.toISOString().slice(0, 10)} currentPeriodEnd=${s?.currentPeriodEnd?.toISOString().slice(0, 10) ?? "none"}\n` +
        `  modules=[${s?.modules.map((m) => m.module).sort().join(", ") || "none"}]\n`
    );
  }
  process.stdout.write(`DEV_SUBSCRIPTION_MODE env at script time: ${process.env.DEV_SUBSCRIPTION_MODE}\n`);
}

main().finally(() => prisma.$disconnect());
