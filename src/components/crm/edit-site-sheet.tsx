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
import { updateSite } from "@/lib/actions/sites";
import { Pencil } from "lucide-react";

const STATUS_LABEL: Record<string, string> = { Active: "Active", Inactive: "Inactive" };

type Site = {
  id: string;
  name: string;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
};

export function EditSiteSheet({ site }: { site: Site }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateSite, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Site updated");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="icon-sm" variant="outline" />}>
        <Pencil className="size-3.5" />
      </SheetTrigger>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit site</SheetTitle>
          <SheetDescription>Update this site&apos;s details.</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <input type="hidden" name="siteId" value={site.id} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Site name</Label>
            <Input id="name" name="name" required defaultValue={site.name} />
          </div>

          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <Label className="text-xs text-muted-foreground">Address (optional)</Label>
            <Input name="addressLine" placeholder="Address line" defaultValue={site.addressLine ?? ""} />
            <div className="grid grid-cols-3 gap-3">
              <Input name="city" placeholder="City" defaultValue={site.city ?? ""} />
              <Input name="state" placeholder="State" defaultValue={site.state ?? ""} />
              <Input name="pincode" placeholder="PIN code" defaultValue={site.pincode ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input name="contactName" placeholder="Contact person" defaultValue={site.contactName ?? ""} />
            <Input name="contactPhone" placeholder="Contact phone" defaultValue={site.contactPhone ?? ""} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">Status</Label>
            <Select name="status" defaultValue={site.status}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue>{(value: unknown) => STATUS_LABEL[value as string] ?? "Active"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
