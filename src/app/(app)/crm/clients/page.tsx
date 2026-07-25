import Link from "next/link";
import { getClients } from "@/lib/queries/crm";
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
import { titleCase } from "@/lib/format";

export default async function ClientsPage() {
  const user = await getCurrentUser();
  const clients = await getClients(user.organizationId!);

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Projects</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell>
                <Link href={`/crm/clients/${client.id}`} className="font-medium hover:underline">
                  {client.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{titleCase(client.industry)}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal">
                  {client.tier}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {client.city}, {client.state}
              </TableCell>
              <TableCell className="text-muted-foreground">{client.contactName}</TableCell>
              <TableCell className="text-right">{client._count.leads}</TableCell>
              <TableCell className="text-right">{client._count.projects}</TableCell>
              <TableCell>
                <Badge
                  variant={client.status === "Active" ? "default" : "secondary"}
                  className="font-normal"
                >
                  {client.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
