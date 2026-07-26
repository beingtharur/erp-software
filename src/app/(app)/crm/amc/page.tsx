import { getAmcContracts, getClientOptions } from "@/lib/queries/crm";
import { getCurrentUser } from "@/lib/dal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { NewAmcContractSheet } from "@/components/crm/new-amc-contract-sheet";
import { formatDate, formatINR, titleCase } from "@/lib/format";

const badgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  EXPIRING_SOON: "destructive",
  EXPIRED: "secondary",
};

export default async function AmcPage() {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  const [contracts, clients] = await Promise.all([
    getAmcContracts(organizationId),
    getClientOptions(organizationId),
  ]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex justify-end">
        <NewAmcContractSheet clients={clients} />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contract #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Equipment Covered</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Last Service</TableHead>
              <TableHead>Next Service</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                  No AMC contracts yet.
                </TableCell>
              </TableRow>
            )}
            {contracts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {c.contractNumber}
                  {c.contractName && (
                    <p className="text-xs font-normal text-muted-foreground">{c.contractName}</p>
                  )}
                </TableCell>
                <TableCell>{c.client.name}</TableCell>
                <TableCell className="max-w-40 truncate text-muted-foreground">
                  {c.project?.name ?? "—"}
                </TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">
                  {c.equipmentCovered}
                </TableCell>
                <TableCell className="text-right font-mono">{formatINR(c.value)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.lastServiceDate ? formatDate(c.lastServiceDate) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.nextServiceDate ? formatDate(c.nextServiceDate) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(c.endDate)}</TableCell>
                <TableCell>
                  <Badge variant={badgeVariant[c.status]} className="font-normal">
                    {titleCase(c.status)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
