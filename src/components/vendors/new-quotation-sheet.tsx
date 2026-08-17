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
import { uploadProcurementQuotation } from "@/lib/actions/procurement-quotations";
import { Plus } from "lucide-react";

export function NewQuotationSheet() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(uploadProcurementQuotation, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Quotation uploaded");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <Plus />
        Upload quotation
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Upload quotation</SheetTitle>
          <SheetDescription>Log a vendor quotation for costing/estimation.</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quotationNumber">Quotation number</Label>
              <Input id="quotationNumber" name="quotationNumber" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vendorName">Vendor name</Label>
              <Input id="vendorName" name="vendorName" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="projectName">Project name</Label>
              <Input id="projectName" name="projectName" placeholder="Optional" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clientName">Client name</Label>
              <Input id="clientName" name="clientName" placeholder="Optional" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quotationDate">Date</Label>
              <Input id="quotationDate" name="quotationDate" type="date" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validUntil">Valid until</Label>
              <Input id="validUntil" name="validUntil" type="date" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" name="remarks" placeholder="Optional notes…" rows={2} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file">File</Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png"
              required
            />
            <p className="text-xs text-muted-foreground">PDF, Excel, Word, or image. Max 10MB.</p>
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Uploading…" : "Upload"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
