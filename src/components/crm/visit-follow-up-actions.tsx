"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateLeadStage } from "@/lib/actions/crm";
import { NewSiteVisitSheet } from "@/components/crm/new-site-visit-sheet";
import { NewQuotationSheet } from "@/components/crm/new-quotation-sheet";
import { CalendarPlus, FileText, XCircle } from "lucide-react";

type ClientOption = { id: string; name: string };
type ProjectOption = { id: string; name: string; clientId: string };
type EmployeeOption = { id: string; name: string };

function toDateInputValue(value: Date | string | null | undefined) {
  if (!value) return undefined;
  return new Date(value).toISOString().slice(0, 10);
}

// Rendered only for COMPLETED, lead-linked visits on the CRM site-visits page —
// deliberately not on /me, since Create Quotation is ADMIN/SALES-gated server-side
// and would just fail for a FIELD engineer.
export function VisitFollowUpActions({
  visit,
  clients,
  projects,
  employees,
}: {
  visit: {
    leadId: string;
    clientId: string;
    projectId: string | null;
    followUpDate: Date | string | null;
  };
  clients: ClientOption[];
  projects: ProjectOption[];
  employees: EmployeeOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [quotationOpen, setQuotationOpen] = useState(false);

  function markLost() {
    if (!window.confirm("Mark this lead as Lost? This can't be undone from here.")) return;
    startTransition(async () => {
      try {
        await updateLeadStage(visit.leadId, "LOST");
        toast.success("Lead marked Lost");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update lead");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="xs" variant="outline" onClick={() => setFollowUpOpen(true)}>
        <CalendarPlus className="size-3" />
        Schedule Follow-up
      </Button>
      <Button size="xs" variant="outline" onClick={() => setQuotationOpen(true)}>
        <FileText className="size-3" />
        Create Quotation
      </Button>
      <Button
        size="xs"
        variant="outline"
        disabled={isPending}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={markLost}
      >
        <XCircle className="size-3" />
        Mark Lead Lost
      </Button>

      <NewSiteVisitSheet
        clients={clients}
        projects={projects}
        employees={employees}
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        initialValues={{
          leadId: visit.leadId,
          clientId: visit.clientId,
          projectId: visit.projectId ?? undefined,
          visitType: "FOLLOW_UP",
          purpose: "Follow-up visit",
          scheduledDate: toDateInputValue(visit.followUpDate),
        }}
      />
      <NewQuotationSheet
        clients={clients}
        open={quotationOpen}
        onOpenChange={setQuotationOpen}
        initialValues={{ leadId: visit.leadId, clientId: visit.clientId }}
      />
    </div>
  );
}
