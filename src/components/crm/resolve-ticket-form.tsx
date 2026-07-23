"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { resolveTicket } from "@/lib/actions/crm";

export function ResolveTicketForm({
  ticketId,
  existingNotes,
}: {
  ticketId: string;
  existingNotes: string | null;
}) {
  const [state, formAction, pending] = useActionState(resolveTicket, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Ticket resolved");
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Label htmlFor="resolutionNotes">Resolution notes</Label>
      <Textarea
        id="resolutionNotes"
        name="resolutionNotes"
        rows={3}
        placeholder="What fixed it?"
        defaultValue={existingNotes ?? ""}
      />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Resolve ticket"}
      </Button>
    </form>
  );
}
