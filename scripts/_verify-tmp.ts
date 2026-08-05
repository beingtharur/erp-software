import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

async function main() {
  const adapter = new PrismaBetterSqlite3({ url: "file:./prisma/dev.db" });
  const prisma = new PrismaClient({ adapter });
  try {
    const org = await prisma.organization.findFirst({ where: { name: "Verify Test Org" } });
    if (!org) {
      process.stdout.write("ORG NOT FOUND\n");
      return;
    }
    const user = await prisma.user.findFirst({ where: { organizationId: org.id }, include: { employee: true } });
    process.stdout.write(
      `org: ${org.id} ${org.name}\nuser: ${user?.email} accessRole=${user?.accessRole} employeeId=${user?.employeeId}\nemployee: ${JSON.stringify(user?.employee)}\n`
    );
  } catch (err) {
    process.stderr.write(`ERROR: ${String(err)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
