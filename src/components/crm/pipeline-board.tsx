"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { formatDate, formatINR, initials, titleCase } from "@/lib/format";
import { updateLeadStage } from "@/lib/actions/crm";
import { NewSiteVisitSheet } from "@/components/crm/new-site-visit-sheet";
import { MoreHorizontal, Calendar, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";

type LeadWithRelations = {
  id: string;
  title: string;
  stage: string;
  value: number;
  probability: number;
  expectedCloseDate: Date;
  source: string;
  clientId: string;
  client: { name: string; tier: string };
  owner: { name: string };
  quotations: unknown[];
};

type ProjectOption = { id: string; name: string; clientId: string };
type EmployeeOption = { id: string; name: string };

const STAGES = [
  { key: "NEW", label: "New" },
  { key: "QUALIFIED", label: "Qualified" },
  { key: "QUOTATION_SENT", label: "Quotation Sent" },
  { key: "NEGOTIATION", label: "Negotiation" },
  { key: "WON", label: "Won" },
  { key: "LOST", label: "Lost" },
] as const;

const stageAccent: Record<string, string> = {
  NEW: "bg-slate-400",
  QUALIFIED: "bg-blue-400",
  QUOTATION_SENT: "bg-amber-400",
  NEGOTIATION: "bg-violet-400",
  WON: "bg-emerald-500",
  LOST: "bg-red-400",
};

export function PipelineBoard({
  leads,
  clientOptions,
  projects,
  employees,
}: {
  leads: LeadWithRelations[];
  clientOptions: { id: string; name: string }[];
  projects: ProjectOption[];
  employees: EmployeeOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [schedulingLead, setSchedulingLead] = useState<LeadWithRelations | null>(null);

  function handleMove(leadId: string, stage: string) {
    startTransition(async () => {
      try {
        await updateLeadStage(leadId, stage as never);
        toast.success(`Moved to ${titleCase(stage)}`);
      } catch {
        toast.error("Could not update lead stage");
      }
    });
  }

  return (
    <div className="flex min-w-0 gap-4 overflow-x-auto pb-4">
      {STAGES.map((stage) => {
        const stageLeads = leads.filter((l) => l.stage === stage.key);
        const stageValue = stageLeads.reduce((sum, l) => sum + l.value, 0);
        return (
          <div key={stage.key} className="flex w-72 shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", stageAccent[stage.key])} />
                <h3 className="text-sm font-medium">{stage.label}</h3>
                <Badge variant="secondary" className="text-xs font-normal">
                  {stageLeads.length}
                </Badge>
              </div>
            </div>
            <p className="px-1 text-xs text-muted-foreground">{formatINR(stageValue)}</p>
            <div className="flex flex-col gap-2">
              {stageLeads.map((lead) => (
                <Card key={lead.id} className={cn("gap-2 p-3", isPending && "opacity-70")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{lead.title}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-xs" className="shrink-0 -mt-1 -mr-1" />
                        }
                      >
                        <MoreHorizontal className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-xs">Move to</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {STAGES.filter((s) => s.key !== lead.stage).map((s) => (
                            <DropdownMenuItem
                              key={s.key}
                              onClick={() => handleMove(lead.id, s.key)}
                            >
                              {s.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setSchedulingLead(lead)}>
                          <CalendarPlus className="size-3.5" />
                          Schedule Site Visit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-xs text-muted-foreground">{lead.client.name}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{formatINR(lead.value)}</span>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {titleCase(lead.source)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      {formatDate(lead.expectedCloseDate)}
                    </div>
                    <Avatar className="size-5">
                      <AvatarFallback className="text-[9px]">
                        {initials(lead.owner.name)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </Card>
              ))}
              {stageLeads.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No leads
                </div>
              )}
            </div>
          </div>
        );
      })}
      <NewSiteVisitSheet
        clients={clientOptions}
        projects={projects}
        employees={employees}
        hideProject
        open={!!schedulingLead}
        onOpenChange={(next) => {
          if (!next) setSchedulingLead(null);
        }}
        initialValues={
          schedulingLead
            ? { leadId: schedulingLead.id, clientId: schedulingLead.clientId }
            : undefined
        }
      />
    </div>
  );
}
