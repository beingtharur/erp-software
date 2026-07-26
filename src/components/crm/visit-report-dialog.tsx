"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import { FileText } from "lucide-react";

const OUTCOME_LABEL: Record<string, string> = {
  INTERESTED: "Interested",
  NOT_INTERESTED: "Not Interested",
  NEEDS_QUOTATION: "Needs Quotation",
  FOLLOW_UP_REQUIRED: "Follow-up Required",
  NO_DECISION: "No Decision",
  OTHER: "Other",
};

const RECOMMENDED_ACTION_LABEL: Record<string, string> = {
  CREATE_QUOTATION: "Create Quotation",
  SCHEDULE_FOLLOW_UP: "Schedule Follow-up",
  TECHNICAL_REVIEW: "Technical Review",
  AWAIT_CUSTOMER: "Await Customer",
  CLOSE_LEAD: "Close Lead",
  OTHER: "Other",
};

type Attachment = { id: string; fileUrl: string; fileName: string };

type ReportVisit = {
  visitType: string;
  outcome: string | null;
  outcomeNotes: string | null;
  customerFeedback: string | null;
  recommendedAction: string | null;
  recommendedActionNotes: string | null;
  contactName: string | null;
  actualStartTime: Date | string | null;
  actualEndTime: Date | string | null;
  durationMinutes: number | null;
  followUpDate: Date | string | null;
  attachments: Attachment[];
};

export function VisitReportDialog({ visit }: { visit: ReportVisit }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
        <FileText className="size-3" />
        View report
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Visit report</DialogTitle>
          <DialogDescription>{titleCase(visit.visitType)} visit</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto text-sm">
          {visit.outcome && (
            <div>
              <p className="text-xs text-muted-foreground">Outcome</p>
              <Badge variant="secondary" className="font-normal">
                {OUTCOME_LABEL[visit.outcome] ?? titleCase(visit.outcome)}
              </Badge>
            </div>
          )}
          {visit.outcomeNotes && (
            <div>
              <p className="text-xs text-muted-foreground">Outcome notes</p>
              <p>{visit.outcomeNotes}</p>
            </div>
          )}
          {visit.customerFeedback && (
            <div>
              <p className="text-xs text-muted-foreground">Customer feedback</p>
              <p>{visit.customerFeedback}</p>
            </div>
          )}
          {visit.recommendedAction && (
            <div>
              <p className="text-xs text-muted-foreground">Recommended next action</p>
              <p>
                {RECOMMENDED_ACTION_LABEL[visit.recommendedAction] ?? titleCase(visit.recommendedAction)}
                {visit.recommendedActionNotes ? ` — ${visit.recommendedActionNotes}` : ""}
              </p>
            </div>
          )}
          {visit.contactName && (
            <div>
              <p className="text-xs text-muted-foreground">On-site contact</p>
              <p>{visit.contactName}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Started</p>
              <p>{visit.actualStartTime ? formatDateTime(visit.actualStartTime) : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ended</p>
              <p>{visit.actualEndTime ? formatDateTime(visit.actualEndTime) : "—"}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p>
              {visit.durationMinutes != null
                ? `${Math.floor(visit.durationMinutes / 60)}h ${visit.durationMinutes % 60}m`
                : "—"}
            </p>
          </div>
          {visit.followUpDate && (
            <div>
              <p className="text-xs text-muted-foreground">Follow-up date</p>
              <p>{formatDate(visit.followUpDate)}</p>
            </div>
          )}
          {visit.attachments.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Photos</p>
              <div className="flex flex-wrap gap-2">
                {visit.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded border px-2 py-1 text-xs hover:bg-muted"
                  >
                    {a.fileName}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
