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
import { completeEmployeeProfileFields } from "@/lib/actions/hrms";
import { UserCog } from "lucide-react";

// Companion to CompleteProfileBanner: that one covers a user with *no*
// Employee record at all. This covers the other gap the profile-page
// investigation found — a user whose Employee record already exists but is
// missing fields that were left blank at creation (registerOrganization
// leaves phone/baseLocation blank for a brand-new org's founding admin, by
// design, to keep signup short). Only shows the fields that are actually
// missing, and only ever writes fields the user actually filled in.
export function IncompleteProfileBanner({
  missingPhone,
  missingBaseLocation,
}: {
  missingPhone: boolean;
  missingBaseLocation: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(completeEmployeeProfileFields, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Profile updated — thanks for filling that in.");
      setOpen(false);
    }
  }, [state]);

  const missingLabels = [missingPhone && "phone", missingBaseLocation && "location"]
    .filter(Boolean)
    .join(" and ");

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-center text-xs font-medium text-amber-700 dark:text-amber-400">
      <UserCog className="size-3.5 shrink-0" />
      Your profile is missing your {missingLabels} — some teammates may need this to reach you.
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={<button type="button" className="underline underline-offset-2 hover:no-underline" />}
        >
          Complete it now
        </SheetTrigger>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Complete your profile</SheetTitle>
            <SheetDescription>Just the missing details — everything else stays as-is.</SheetDescription>
          </SheetHeader>
          <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            {missingPhone && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="incomplete-phone">Phone</Label>
                <Input id="incomplete-phone" name="phone" placeholder="+91 90000 00000" />
              </div>
            )}
            {missingBaseLocation && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="incomplete-baseLocation">Base location</Label>
                <Input id="incomplete-baseLocation" name="baseLocation" placeholder="e.g. Vadodara, GJ" />
              </div>
            )}

            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

            <SheetFooter className="px-0">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
              <SheetClose render={<Button type="button" variant="outline" />}>Not now</SheetClose>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
