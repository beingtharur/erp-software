import Link from "next/link";
import { getTickets, getClientOptions, getAmcContractOptions, getAssignableEmployees } from "@/lib/queries/crm";
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
import { formatDate, titleCase } from "@/lib/format";
import { TicketStatusMenu } from "@/components/crm/ticket-status-menu";
import { NewTicketSheet } from "@/components/crm/new-ticket-sheet";

const priorityVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  LOW: "outline",
  MEDIUM: "secondary",
  HIGH: "default",
  CRITICAL: "destructive",
};

export default async function HelpdeskPage() {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  const [tickets, clients, amcContracts, employees] = await Promise.all([
    getTickets(organizationId),
    getClientOptions(organizationId),
    getAmcContractOptions(organizationId),
    getAssignableEmployees(organizationId),
  ]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex justify-end">
        <NewTicketSheet clients={clients} amcContracts={amcContracts} employees={employees} />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Raised</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  No tickets raised yet.
                </TableCell>
              </TableRow>
            )}
            {tickets.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  <Link href={`/crm/helpdesk/${t.id}`} className="hover:underline">
                    {t.ticketNumber}
                  </Link>
                </TableCell>
                <TableCell>{t.client.name}</TableCell>
                <TableCell className="max-w-64 truncate">
                  <Link href={`/crm/helpdesk/${t.id}`} className="hover:underline">
                    {t.subject}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={priorityVariant[t.priority]} className="font-normal">
                    {titleCase(t.priority)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.assignee?.name ?? "Unassigned"}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
                <TableCell>
                  <TicketStatusMenu ticketId={t.id} status={t.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
