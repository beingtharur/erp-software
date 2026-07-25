import { getOrganizationsOverview } from "@/lib/queries/platform-admin";
import { computeEffectiveAccess } from "@/lib/billing/access";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { navSections } from "@/lib/nav";

export default async function PlatformAdminOrganizationsPage() {
  const organizations = await getOrganizationsOverview();

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Users</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Trial ends</TableHead>
            <TableHead>Current period end</TableHead>
            <TableHead>Modules</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.map((org) => {
            const access = computeEffectiveAccess(org.subscription);
            return (
              <TableRow key={org.id}>
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {org._count.users} / {org.subscription?.licencedUsers ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={access.hasAccess ? "default" : "destructive"} className="font-normal">
                    {access.isTrial ? "Trial" : org.subscription?.status ?? "None"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {org.subscription ? formatDate(org.subscription.trialEndsAt) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {org.subscription?.currentPeriodEnd ? formatDate(org.subscription.currentPeriodEnd) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {org.subscription?.modules.length
                    ? org.subscription.modules
                        .map((m) => navSections.find((s) => s.key === m.module)?.title ?? m.module)
                        .join(", ")
                    : access.isTrial
                      ? "All (trial)"
                      : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(org.createdAt)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
