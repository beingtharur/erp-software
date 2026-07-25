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
import { createTicket } from "@/lib/actions/crm";
import { Plus } from "lucide-react";

type ClientOption = { id: string; name: string };
type AmcOption = { id: string; contractNumber: string; clientId: string };
type EmployeeOption = { id: string; name: string };

const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export function NewTicketSheet({
  clients,
  amcContracts,
  employees,
}: {
  clients: ClientOption[];
  amcContracts: AmcOption[];
  employees: EmployeeOption[];
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [state, formAction, pending] = useActionState(createTicket, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Ticket raised");
      setOpen(false);
      setClientId(undefined);
    }
  }, [state]);

  const relevantContracts = amcContracts.filter((c) => c.clientId === clientId);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <Plus />
        New Ticket
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New support ticket</SheetTitle>
          <SheetDescription>Log a service issue raised by a client.</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientId">Client</Label>
            <Select
              name="clientId"
              required
              onValueChange={(value) => setClientId((value as string) ?? undefined)}
            >
              <SelectTrigger id="clientId" className="w-full">
                <SelectValue placeholder="Select client">
                  {(value: unknown) =>
                    clients.find((c) => c.id === value)?.name ?? "Select client"
                  }
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
            <Label htmlFor="amcContractId">Related AMC contract</Label>
            <Select key={clientId} name="amcContractId" disabled={!clientId || relevantContracts.length === 0}>
              <SelectTrigger id="amcContractId" className="w-full">
                <SelectValue
                  placeholder={
                    !clientId
                      ? "Select a client first"
                      : relevantContracts.length === 0
                        ? "No AMC contracts for this client"
                        : "None"
                  }
                >
                  {(value: unknown) =>
                    relevantContracts.find((c) => c.id === value)?.contractNumber ?? "None"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {relevantContracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.contractNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" placeholder="e.g. Isolator pressure alarm tripping" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="What's happening, and what has the client already tried?"
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select name="priority" defaultValue="MEDIUM">
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue>{(value: unknown) => PRIORITY_LABEL[value as string] ?? "Medium"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assigneeId">Assignee</Label>
              <Select name="assigneeId">
                <SelectTrigger id="assigneeId" className="w-full">
                  <SelectValue placeholder="Unassigned">
                    {(value: unknown) => employees.find((e) => e.id === value)?.name ?? "Unassigned"}
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
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Raising…" : "Raise ticket"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
