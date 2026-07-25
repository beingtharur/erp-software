"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { checkInAttendance, checkOutAttendance } from "@/lib/actions/me";
import { formatTime } from "@/lib/format";

export function AttendanceCheckButton({
  checkIn,
  checkOut,
}: {
  checkIn: Date | null;
  checkOut: Date | null;
}) {
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        await action();
        toast.success(checkIn ? "Checked out" : "Checked in");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  if (checkOut) {
    return (
      <p className="text-xs text-muted-foreground">
        Checked out at {formatTime(checkOut)}
      </p>
    );
  }

  if (checkIn) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => run(checkOutAttendance)}
      >
        {isPending ? "Checking out…" : `Check out (in since ${formatTime(checkIn)})`}
      </Button>
    );
  }

  return (
    <Button size="sm" disabled={isPending} onClick={() => run(checkInAttendance)}>
      {isPending ? "Checking in…" : "Check in"}
    </Button>
  );
}
