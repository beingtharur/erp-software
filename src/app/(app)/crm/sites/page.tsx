import Link from "next/link";
import { getSites } from "@/lib/queries/sites";
import { getClientOptions, getProjectOptionsByClient, getLeadOptions } from "@/lib/queries/crm";
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
import { NewSiteSheet } from "@/components/crm/new-site-sheet";

export default async function SitesPage() {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  const [sites, clients, projects, leads] = await Promise.all([
    getSites(organizationId),
    getClientOptions(organizationId),
    getProjectOptionsByClient(organizationId),
    getLeadOptions(organizationId),
  ]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex justify-end">
        <NewSiteSheet clients={clients} projects={projects} leads={leads} />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Site</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Linked records</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sites.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No sites yet. Add one above, or create one from a completed site visit.
                </TableCell>
              </TableRow>
            )}
            {sites.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <Link href={`/crm/sites/${s.id}`} className="hover:underline">
                    {s.name}
                  </Link>
                  {s.siteCode && <p className="text-xs font-normal text-muted-foreground">{s.siteCode}</p>}
                </TableCell>
                <TableCell>{s.client.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.contactName ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {s._count.siteVisits} visits · {s._count.amcContracts} AMC · {s._count.supportTickets} tickets
                </TableCell>
                <TableCell>
                  <Badge variant={s.status === "Active" ? "default" : "secondary"} className="font-normal">
                    {s.status}
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
