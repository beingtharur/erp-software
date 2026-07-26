"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSiteVisit } from "@/lib/actions/crm";
import { Plus } from "lucide-react";

type ClientOption = { id: string; name: string };
type ProjectOption = { id: string; name: string; clientId: string };
type EmployeeOption = { id: string; name: string };

export type SiteVisitInitialValues = Partial<{
  leadId: string;
  clientId: string;
  projectId: string;
  visitType: string;
  priority: string;
  purpose: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  addressLine: string;
  landmark: string;
  mapsLink: string;
  notes: string;
  scheduledDate: string;
  scheduledTime: string;
  assignedToId: string;
}>;

const VISIT_TYPE_LABEL: Record<string, string> = {
  INSTALLATION: "Installation",
  INSPECTION: "Inspection",
  SALES: "Sales",
  MAINTENANCE: "Maintenance",
  SUPPORT: "Support",
  FOLLOW_UP: "Follow-up",
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

// Serves four entry points: standalone creation, scheduling from a Lead card,
// "Schedule Follow-up" on a completed visit, and "Duplicate Visit" — all via
// initialValues rather than four near-duplicate components. When open/onOpenChange
// are supplied, the caller owns the trigger UI (e.g. a dropdown item) and this
// sheet renders no trigger of its own.
export function NewSiteVisitSheet({
  clients,
  projects,
  employees,
  initialValues,
  hideProject = false,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  clients: ClientOption[];
  projects: ProjectOption[];
  employees: EmployeeOption[];
  initialValues?: SiteVisitInitialValues;
  hideProject?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const onOpenChange = isControlled ? onOpenChangeProp! : setInternalOpen;

  // Keyed on the context this sheet was opened for, so reopening it for a
  // different lead/client (the shared-instance case, e.g. from PipelineBoard)
  // remounts the form and its local state fresh instead of syncing via effect.
  const formKey = initialValues?.leadId ?? initialValues?.clientId ?? "new";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {!isControlled && (
        <SheetTrigger render={<Button size="sm" />}>
          <Plus />
          New Site Visit
        </SheetTrigger>
      )}
      <SiteVisitFormContent
        key={formKey}
        clients={clients}
        projects={projects}
        employees={employees}
        initialValues={initialValues}
        hideProject={hideProject}
        onOpenChange={onOpenChange}
      />
    </Sheet>
  );
}

function SiteVisitFormContent({
  clients,
  projects,
  employees,
  initialValues,
  hideProject,
  onOpenChange,
}: {
  clients: ClientOption[];
  projects: ProjectOption[];
  employees: EmployeeOption[];
  initialValues?: SiteVisitInitialValues;
  hideProject: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(createSiteVisit, undefined);
  const [clientId, setClientId] = useState<string | undefined>(initialValues?.clientId);

  useEffect(() => {
    if (state?.success) {
      toast.success("Site visit scheduled");
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  const lockedClient = clients.find((c) => c.id === initialValues?.clientId);
  const relevantProjects = projects.filter((p) => p.clientId === clientId);

  return (
    <SheetContent className="sm:max-w-lg">
      <SheetHeader>
        <SheetTitle>Schedule site visit</SheetTitle>
        <SheetDescription>Plan a client visit and assign an engineer.</SheetDescription>
      </SheetHeader>
      <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {initialValues?.leadId && (
            <input type="hidden" name="leadId" value={initialValues.leadId} />
          )}

          {lockedClient ? (
            <div className="flex flex-col gap-1.5">
              <Label>Client</Label>
              <input type="hidden" name="clientId" value={lockedClient.id} />
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {lockedClient.name}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clientId">Client</Label>
              <Select
                name="clientId"
                required
                onValueChange={(value) => setClientId((value as string) ?? undefined)}
              >
                <SelectTrigger id="clientId" className="w-full">
                  <SelectValue placeholder="Select client">
                    {(value: unknown) => clients.find((c) => c.id === value)?.name ?? "Select client"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!hideProject && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="projectId">Related project (optional)</Label>
              <Select
                key={clientId}
                name="projectId"
                defaultValue={initialValues?.projectId}
                disabled={!clientId || relevantProjects.length === 0}
              >
                <SelectTrigger id="projectId" className="w-full">
                  <SelectValue
                    placeholder={
                      !clientId
                        ? "Select a client first"
                        : relevantProjects.length === 0
                          ? "No projects for this client"
                          : "None"
                    }
                  >
                    {(value: unknown) => relevantProjects.find((p) => p.id === value)?.name ?? "None"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {relevantProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="visitType">Visit type</Label>
              <Select name="visitType" required defaultValue={initialValues?.visitType ?? "SALES"}>
                <SelectTrigger id="visitType" className="w-full">
                  <SelectValue>{(value: unknown) => VISIT_TYPE_LABEL[value as string] ?? "Sales"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VISIT_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select name="priority" required defaultValue={initialValues?.priority ?? "MEDIUM"}>
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue>{(value: unknown) => PRIORITY_LABEL[value as string] ?? "Medium"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="purpose">Purpose</Label>
            <Input
              id="purpose"
              name="purpose"
              placeholder="e.g. Site survey for isolator installation"
              required
              defaultValue={initialValues?.purpose}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scheduledDate">Date</Label>
              <Input
                id="scheduledDate"
                name="scheduledDate"
                type="date"
                required
                defaultValue={initialValues?.scheduledDate}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scheduledTime">Time</Label>
              <Input
                id="scheduledTime"
                name="scheduledTime"
                type="time"
                required
                defaultValue={initialValues?.scheduledTime ?? "09:00"}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignedToId">Assigned engineer</Label>
            <Select name="assignedToId" required defaultValue={initialValues?.assignedToId}>
              <SelectTrigger id="assignedToId" className="w-full">
                <SelectValue placeholder="Select engineer">
                  {(value: unknown) => employees.find((e) => e.id === value)?.name ?? "Select engineer"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <Label className="text-xs text-muted-foreground">On-site contact (optional)</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input name="contactName" placeholder="Contact name" defaultValue={initialValues?.contactName} />
              <Input name="contactPhone" placeholder="Contact phone" defaultValue={initialValues?.contactPhone} />
            </div>
            <Input
              name="contactEmail"
              type="email"
              placeholder="Contact email"
              defaultValue={initialValues?.contactEmail}
            />
          </div>

          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <Label className="text-xs text-muted-foreground">Address (optional)</Label>
            <Input name="addressLine" placeholder="Address line" defaultValue={initialValues?.addressLine} />
            <div className="grid grid-cols-2 gap-3">
              <Input name="landmark" placeholder="Landmark" defaultValue={initialValues?.landmark} />
              <Input
                name="mapsLink"
                type="url"
                placeholder="Google Maps link"
                defaultValue={initialValues?.mapsLink}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Optional context…"
              rows={3}
              defaultValue={initialValues?.notes}
            />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Scheduling…" : "Schedule visit"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
    </SheetContent>
  );
}
