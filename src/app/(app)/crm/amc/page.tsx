import { getAmcContracts } from "@/lib/queries/crm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatINR, titleCase } from "@/lib/format";

const badgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  EXPIRING_SOON: "destructive",
  EXPIRED: "secondary",
};

export default async function AmcPage() {
  const contracts = await getAmcContracts();

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contract #</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Equipment Covered</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Last Service</TableHead>
            <TableHead>Next Service</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.contractNumber}</TableCell>
              <TableCell>{c.client.name}</TableCell>
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
  );
}
