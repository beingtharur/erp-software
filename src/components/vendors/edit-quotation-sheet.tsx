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
import { updateProcurementQuotationDetails } from "@/lib/actions/procurement-quotations";
import { Pencil } from "lucide-react";

type QuotationForEdit = {
  id: string;
  quotationNumber: string;
  vendorName: string;
  projectName: string | null;
  clientName: string | null;
  quotationDate: Date | string;
  validUntil: Date | string | null;
  remarks: string | null;
};

function toDateInputValue(value: Date | string | null) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

export function EditQuotationSheet({ quotation }: { quotation: QuotationForEdit }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateProcurementQuotationDetails, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Quotation updated");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="icon-sm" variant="outline" />}>
        <Pencil className="size-3.5" />
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit quotation</SheetTitle>
          <SheetDescription>
            Update the quotation details. To replace the file itself, use New version instead.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <input type="hidden" name="quotationId" value={quotation.id} />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`quotationNumber-${quotation.id}`}>Quotation number</Label>
              <Input
                id={`quotationNumber-${quotation.id}`}
                name="quotationNumber"
                required
                defaultValue={quotation.quotationNumber}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`vendorName-${quotation.id}`}>Vendor name</Label>
              <Input
                id={`vendorName-${quotation.id}`}
                name="vendorName"
                required
                defaultValue={quotation.vendorName}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`projectName-${quotation.id}`}>Project name</Label>
              <Input
                id={`projectName-${quotation.id}`}
                name="projectName"
                defaultValue={quotation.projectName ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`clientName-${quotation.id}`}>Client name</Label>
              <Input
                id={`clientName-${quotation.id}`}
                name="clientName"
                defaultValue={quotation.clientName ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`quotationDate-${quotation.id}`}>Date</Label>
              <Input
                id={`quotationDate-${quotation.id}`}
                name="quotationDate"
                type="date"
                required
                defaultValue={toDateInputValue(quotation.quotationDate)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`validUntil-${quotation.id}`}>Valid until</Label>
              <Input
                id={`validUntil-${quotation.id}`}
                name="validUntil"
                type="date"
                defaultValue={toDateInputValue(quotation.validUntil)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`remarks-${quotation.id}`}>Remarks</Label>
            <Textarea
              id={`remarks-${quotation.id}`}
              name="remarks"
              rows={2}
              defaultValue={quotation.remarks ?? ""}
            />
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
