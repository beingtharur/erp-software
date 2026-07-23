import { notFound } from "next/navigation";
import Link from "next/link";
import { getTicketDetail, getAssignableEmployees } from "@/lib/queries/crm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TicketStatusMenu } from "@/components/crm/ticket-status-menu";
import { TicketAssigneeSelect } from "@/components/crm/ticket-assignee-select";
import { ResolveTicketForm } from "@/components/crm/resolve-ticket-form";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import { LifeBuoy } from "lucide-react";

const priorityVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  LOW: "outline",
  MEDIUM: "secondary",
  HIGH: "default",
  CRITICAL: "destructive",
};

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ticket, employees] = await Promise.all([getTicketDetail(id), getAssignableEmployees()]);

  if (!ticket) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LifeBuoy className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{ticket.ticketNumber}</h2>
                <Badge variant={priorityVariant[ticket.priority]} className="font-normal">
                  {titleCase(ticket.priority)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                <Link href={`/crm/clients/${ticket.clientId}`} className="hover:underline">
                  {ticket.client.name}
                </Link>
                {ticket.amcContract && <> · {ticket.amcContract.contractNumber}</>}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-1 text-sm text-muted-foreground sm:items-end">
            <TicketStatusMenu ticketId={ticket.id} status={ticket.status} />
            <span>Raised {formatDateTime(ticket.createdAt)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">{ticket.subject}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{ticket.description}</p>

            {ticket.status !== "CLOSED" && (
              <ResolveTicketForm ticketId={ticket.id} existingNotes={ticket.resolutionNotes} />
            )}

            {ticket.resolutionNotes && ticket.status === "CLOSED" && (
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">Resolution notes</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{ticket.resolutionNotes}</p>
              </div>
            )}

            {ticket.resolvedAt && (
              <p className="text-xs text-muted-foreground">
                Resolved {formatDate(ticket.resolvedAt)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <TicketAssigneeSelect
              ticketId={ticket.id}
              assigneeId={ticket.assigneeId}
              employees={employees}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
