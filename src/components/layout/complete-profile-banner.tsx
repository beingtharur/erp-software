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
import { JobTitleSelect } from "@/components/roles/role-fields";
import { createSelfEmployeeProfile } from "@/lib/actions/hrms";
import { UserCog } from "lucide-react";

export function CompleteProfileBanner() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createSelfEmployeeProfile, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Profile created — you're all set.");
      setOpen(false);
    }
  }, [state]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-center text-xs font-medium text-amber-700 dark:text-amber-400">
      <UserCog className="size-3.5 shrink-0" />
      Your login isn&apos;t linked to an employee profile — some actions (proposing a budget, filing an
      expense claim, field check-in) need one.
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={<button type="button" className="underline underline-offset-2 hover:no-underline" />}
        >
          Complete your profile
        </SheetTrigger>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Complete your employee profile</SheetTitle>
            <SheetDescription>
              A few details so the rest of the platform can attribute your requests and check-ins to you.
            </SheetDescription>
          </SheetHeader>
          <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-name">Full name</Label>
              <Input id="profile-name" name="name" placeholder="Your name" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-role">Job title</Label>
                <JobTitleSelect id="profile-role" required defaultValue="ADMIN" />
                <p className="text-xs text-muted-foreground">
                  What you do — this doesn&apos;t change your portal access.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-department">Department</Label>
                <Input
                  id="profile-department"
                  name="department"
                  placeholder="e.g. Management"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-phone">Phone</Label>
                <Input id="profile-phone" name="phone" placeholder="+91 90000 00000" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-dateOfJoining">Date of joining</Label>
                <Input id="profile-dateOfJoining" name="dateOfJoining" type="date" required />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-baseLocation">Base location</Label>
              <Input
                id="profile-baseLocation"
                name="baseLocation"
                placeholder="e.g. Vadodara, GJ"
                required
              />
            </div>

            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

            <SheetFooter className="px-0">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save profile"}
              </Button>
              <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
