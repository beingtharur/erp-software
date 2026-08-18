import Link from "next/link";
import { getClients } from "@/lib/queries/crm";
import { getCurrentUser, requireRole } from "@/lib/dal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { titleCase } from "@/lib/format";
import { NewClientSheet } from "@/components/crm/new-client-sheet";
import { Download } from "lucide-react";

export default async function ClientsPage() {
  // Procurement passes the layout's broadened gate (Quotations-only) but
  // isn't meant to reach Clients — re-checked here since the layout alone
  // can't scope a single role out of one page.
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const clients = await getClients(user.organizationId!);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" nativeButton={false} render={<a href="/api/exports/clients" />}>
          <Download />
          Export to Excel
        </Button>
        <NewClientSheet />
      </div>
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
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  No clients yet. Add your first client above.
                </TableCell>
              </TableRow>
            )}
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
    </div>
  );
}
