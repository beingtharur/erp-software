"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createSite } from "@/lib/actions/sites";
import { Plus } from "lucide-react";

type ClientOption = { id: string; name: string };
type ProjectOption = { id: string; name: string; clientId: string };
type LeadOption = { id: string; title: string; clientId: string };

const DUPLICATE_PREFIX = "duplicate:";

export type SiteInitialValues = Partial<{
  clientId: string;
  name: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  contactName: string;
  contactPhone: string;
}>;

// Serves two entry points: standalone creation from /crm/sites, and
// "Create Site" from a completed Site Visit (client + address pre-filled) —
// via initialValues, same pattern as NewSiteVisitSheet.
export function NewSiteSheet({
  clients,
  projects,
  leads,
  initialValues,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  clients: ClientOption[];
  projects: ProjectOption[];
  leads: LeadOption[];
  initialValues?: SiteInitialValues;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const onOpenChange = isControlled ? onOpenChangeProp! : setInternalOpen;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {!isControlled && (
        <SheetTrigger render={<Button size="sm" />}>
          <Plus />
          New Site
        </SheetTrigger>
      )}
      <SiteFormContent
        key={initialValues?.clientId ?? "new"}
        clients={clients}
        projects={projects}
        leads={leads}
        initialValues={initialValues}
        onOpenChange={onOpenChange}
      />
    </Sheet>
  );
}

function SiteFormContent({
  clients,
  projects,
  leads,
  initialValues,
  onOpenChange,
}: {
  clients: ClientOption[];
  projects: ProjectOption[];
  leads: LeadOption[];
  initialValues?: SiteInitialValues;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(createSite, undefined);
  const [clientId, setClientId] = useState<string | undefined>(initialValues?.clientId);

  useEffect(() => {
    if (state?.success) {
      toast.success("Site created");
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const isDuplicateWarning = state?.error?.startsWith(DUPLICATE_PREFIX) ?? false;
  const errorMessage = state?.error?.startsWith(DUPLICATE_PREFIX)
    ? state.error.slice(DUPLICATE_PREFIX.length)
    : state?.error;

  const relevantProjects = projects.filter((p) => p.clientId === clientId);
  const relevantLeads = leads.filter((l) => l.clientId === clientId);

  return (
    <SheetContent className="sm:max-w-lg">
      <SheetHeader>
        <SheetTitle>New site</SheetTitle>
        <SheetDescription>
          A physical client location — reusable across future visits, AMC contracts, and tickets.
        </SheetDescription>
      </SheetHeader>
      <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
        <input type="hidden" name="confirmDuplicate" value={isDuplicateWarning ? "1" : "0"} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientId">Client</Label>
          <Select
            name="clientId"
            required
            defaultValue={initialValues?.clientId}
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Site name</Label>
          <Input
            id="name"
            name="name"
            placeholder="e.g. Vadodara Plant 2"
            required
            defaultValue={initialValues?.name}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="projectId">Related project (optional)</Label>
            <Select key={clientId} name="projectId" disabled={!clientId || relevantProjects.length === 0}>
              <SelectTrigger id="projectId" className="w-full">
                <SelectValue
                  placeholder={
                    !clientId
                      ? "Select a client first"
                      : relevantProjects.length === 0
                        ? "No projects"
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leadId">Related lead (optional)</Label>
            <Select key={clientId} name="leadId" disabled={!clientId || relevantLeads.length === 0}>
              <SelectTrigger id="leadId" className="w-full">
                <SelectValue
                  placeholder={
                    !clientId ? "Select a client first" : relevantLeads.length === 0 ? "No leads" : "None"
                  }
                >
                  {(value: unknown) => relevantLeads.find((l) => l.id === value)?.title ?? "None"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {relevantLeads.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <Label className="text-xs text-muted-foreground">Address (optional)</Label>
          <Input name="addressLine" placeholder="Address line" defaultValue={initialValues?.addressLine} />
          <div className="grid grid-cols-3 gap-3">
            <Input name="city" placeholder="City" defaultValue={initialValues?.city} />
            <Input name="state" placeholder="State" defaultValue={initialValues?.state} />
            <Input name="pincode" placeholder="PIN code" defaultValue={initialValues?.pincode} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input name="contactName" placeholder="Contact person" defaultValue={initialValues?.contactName} />
          <Input name="contactPhone" placeholder="Contact phone" defaultValue={initialValues?.contactPhone} />
        </div>

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

        <SheetFooter className="px-0">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : isDuplicateWarning ? "Create anyway" : "Create site"}
          </Button>
          <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
        </SheetFooter>
      </form>
    </SheetContent>
  );
}
