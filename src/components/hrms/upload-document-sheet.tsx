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
import { uploadEmployeeDocument } from "@/lib/actions/hrms";
import { Upload } from "lucide-react";

export function UploadDocumentSheet({ employeeId }: { employeeId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(uploadEmployeeDocument, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Document uploaded");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" variant="outline" />}>
        <Upload />
        Upload
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Upload document</SheetTitle>
          <SheetDescription>Attach a file to this employee&apos;s record.</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <input type="hidden" name="employeeId" value={employeeId} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Document type</Label>
            <Select name="type" required defaultValue="OTHER">
              <SelectTrigger id="type" className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ID_PROOF">ID Proof</SelectItem>
                <SelectItem value="OFFER_LETTER">Offer Letter</SelectItem>
                <SelectItem value="CONTRACT">Contract</SelectItem>
                <SelectItem value="CERTIFICATE">Certificate</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file">File</Label>
            <Input id="file" name="file" type="file" required />
            <p className="text-xs text-muted-foreground">Max 10MB.</p>
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
