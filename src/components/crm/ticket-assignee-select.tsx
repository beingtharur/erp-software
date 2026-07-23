"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignTicket } from "@/lib/actions/crm";

export function TicketAssigneeSelect({
  ticketId,
  assigneeId,
  employees,
}: {
  ticketId: string;
  assigneeId: string | null;
  employees: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string | null) {
    startTransition(async () => {
      try {
        await assignTicket(ticketId, !value || value === "unassigned" ? "" : value);
        toast.success("Ticket reassigned");
      } catch {
        toast.error("Could not reassign ticket");
      }
    });
  }

  return (
    <Select
      value={assigneeId ?? "unassigned"}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Unassigned">
          {(value: unknown) =>
            value === "unassigned" || !value
              ? "Unassigned"
              : (employees.find((e) => e.id === value)?.name ?? "Unassigned")
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {employees.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
