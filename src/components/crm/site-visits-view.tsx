"use client";

import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import { SiteVisitActions } from "@/components/crm/site-visit-actions";
import { VisitReportDialog } from "@/components/crm/visit-report-dialog";
import { VisitFollowUpActions } from "@/components/crm/visit-follow-up-actions";
import { NewSiteVisitSheet } from "@/components/crm/new-site-visit-sheet";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";

type ClientOption = { id: string; name: string };
type ProjectOption = { id: string; name: string; clientId: string };
type EmployeeOption = { id: string; name: string };

export type SiteVisitRow = {
  id: string;
  clientId: string;
  projectId: string | null;
  leadId: string | null;
  purpose: string;
  visitType: string;
  priority: string;
  scheduledDate: Date | string;
  followUpDate: Date | string | null;
  status: string;
  addressLine: string | null;
  landmark: string | null;
  mapsLink: string | null;
  contactName: string | null;
  actualStartTime: Date | string | null;
  actualEndTime: Date | string | null;
  durationMinutes: number | null;
  outcome: string | null;
  outcomeNotes: string | null;
  customerFeedback: string | null;
  recommendedAction: string | null;
  recommendedActionNotes: string | null;
  client: { name: string; city: string; state: string };
  project: { id: string; name: string } | null;
  assignedTo: { id: string; name: string };
  lead: { id: string; title: string } | null;
  attachments: { id: string; fileUrl: string; fileName: string }[];
};

const priorityVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  LOW: "outline",
  MEDIUM: "secondary",
  HIGH: "default",
  URGENT: "destructive",
};

const statusDot: Record<string, string> = {
  SCHEDULED: "bg-blue-400",
  IN_PROGRESS: "bg-amber-400",
  RESCHEDULED: "bg-violet-400",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-red-400",
};

function DuplicateVisitButton({
  visit,
  clients,
  projects,
  employees,
}: {
  visit: SiteVisitRow;
  clients: ClientOption[];
  projects: ProjectOption[];
  employees: EmployeeOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="icon-xs" variant="outline" title="Duplicate" onClick={() => setOpen(true)}>
        <Copy className="size-3.5" />
      </Button>
      <NewSiteVisitSheet
        clients={clients}
        projects={projects}
        employees={employees}
        open={open}
        onOpenChange={setOpen}
        initialValues={{
          leadId: visit.leadId ?? undefined,
          clientId: visit.clientId,
          projectId: visit.projectId ?? undefined,
          visitType: visit.visitType,
          priority: visit.priority,
          purpose: visit.purpose,
          contactName: visit.contactName ?? undefined,
          addressLine: visit.addressLine ?? undefined,
          landmark: visit.landmark ?? undefined,
          mapsLink: visit.mapsLink ?? undefined,
          assignedToId: visit.assignedTo.id,
        }}
      />
    </>
  );
}

function VisitAddress({ visit }: { visit: SiteVisitRow }) {
  const line = visit.addressLine || `${visit.client.city}, ${visit.client.state}`;
  return (
    <div className="max-w-40 text-xs text-muted-foreground">
      <p className="truncate">{line}</p>
      {visit.landmark && <p className="truncate">Near {visit.landmark}</p>}
      {visit.mapsLink && (
        <a href={visit.mapsLink} target="_blank" rel="noreferrer" className="underline">
          Map
        </a>
      )}
    </div>
  );
}

function VisitRowActions({
  visit,
  clients,
  projects,
  employees,
}: {
  visit: SiteVisitRow;
  clients: ClientOption[];
  projects: ProjectOption[];
  employees: EmployeeOption[];
}) {
  if (visit.status === "COMPLETED") {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <div className="flex items-center gap-1.5">
          <VisitReportDialog visit={visit} />
          <DuplicateVisitButton visit={visit} clients={clients} projects={projects} employees={employees} />
        </div>
        {visit.leadId && (
          <VisitFollowUpActions
            visit={{
              leadId: visit.leadId,
              clientId: visit.clientId,
              projectId: visit.projectId,
              followUpDate: visit.followUpDate,
            }}
            clients={clients}
            projects={projects}
            employees={employees}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <SiteVisitActions visit={visit} />
      <DuplicateVisitButton visit={visit} clients={clients} projects={projects} employees={employees} />
    </div>
  );
}

export function SiteVisitsView({
  visits,
  clients,
  projects,
  employees,
}: {
  visits: SiteVisitRow[];
  clients: ClientOption[];
  projects: ProjectOption[];
  employees: EmployeeOption[];
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <Tabs defaultValue="list">
      <TabsList>
        <TabsTrigger value="list">List</TabsTrigger>
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
      </TabsList>

      <TabsContent value="list">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status / Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visits.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                    No site visits yet. Schedule one above.
                  </TableCell>
                </TableRow>
              )}
              {visits.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.client.name}</TableCell>
                  <TableCell className="max-w-52">
                    <p className="truncate text-muted-foreground">{v.purpose}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {titleCase(v.visitType)}
                      </Badge>
                      <Badge variant={priorityVariant[v.priority]} className="text-[10px] font-normal">
                        {titleCase(v.priority)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">
                    {v.project?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{v.assignedTo.name}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(v.scheduledDate)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {v.followUpDate ? formatDate(v.followUpDate) : "—"}
                  </TableCell>
                  <TableCell>
                    <VisitAddress visit={v} />
                  </TableCell>
                  <TableCell>
                    <VisitRowActions visit={v} clients={clients} projects={projects} employees={employees} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="calendar">
        <div className="rounded-lg border p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">{format(month, "MMMM yyyy")}</p>
            <div className="flex items-center gap-1.5">
              <Button size="icon-sm" variant="outline" onClick={() => setMonth((m) => subMonths(m, 1))}>
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMonth(startOfMonth(new Date()))}>
                Today
              </Button>
              <Button size="icon-sm" variant="outline" onClick={() => setMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="bg-muted/60 p-1.5 text-center font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const dayVisits = visits.filter((v) => isSameDay(new Date(v.scheduledDate), day));
              const inMonth = isSameMonth(day, month);
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-24 bg-background p-1.5 ${inMonth ? "" : "opacity-40"}`}
                >
                  <p className="mb-1 text-[11px] text-muted-foreground">{format(day, "d")}</p>
                  <div className="flex flex-col gap-1">
                    {dayVisits.slice(0, 3).map((v) => (
                      <div
                        key={v.id}
                        title={`${v.purpose} — ${v.client.name}`}
                        className="flex items-center gap-1 truncate rounded bg-muted px-1 py-0.5"
                      >
                        <span className={`size-1.5 shrink-0 rounded-full ${statusDot[v.status]}`} />
                        <span className="truncate">
                          {format(new Date(v.scheduledDate), "HH:mm")} {v.purpose}
                        </span>
                      </div>
                    ))}
                    {dayVisits.length > 3 && (
                      <p className="text-[10px] text-muted-foreground">+{dayVisits.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
