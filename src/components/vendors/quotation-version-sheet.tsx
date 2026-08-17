"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { uploadProcurementQuotationVersion } from "@/lib/actions/procurement-quotations";
import { formatFileSize, formatDateTime, titleCase } from "@/lib/format";
import { History, Paperclip } from "lucide-react";

type VersionRow = {
  id: string;
  version: number;
  status: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  createdAt: Date | string;
  uploadedBy: { name: string };
};

export function QuotationVersionSheet({
  quotationId,
  versions,
}: {
  quotationId: string;
  versions: VersionRow[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(uploadProcurementQuotationVersion, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("New version uploaded");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="icon-sm" variant="outline" />}>
        <History className="size-3.5" />
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>Every upload for this quotation, newest first.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="space-y-2">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    v{v.version}{" "}
                    <Badge variant="outline" className="ml-1 font-normal">
                      {titleCase(v.status)}
                    </Badge>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {v.uploadedBy.name} · {formatDateTime(v.createdAt)} · {formatFileSize(v.fileSize)}
                  </p>
                </div>
                <a
                  href={v.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-primary hover:underline"
                >
                  <Paperclip className="size-4" />
                </a>
              </div>
            ))}
          </div>

          <form action={formAction} className="flex flex-col gap-3 border-t pt-4">
            <input type="hidden" name="quotationId" value={quotationId} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`version-file-${quotationId}`}>Upload new version</Label>
              <Input
                id={`version-file-${quotationId}`}
                name="file"
                type="file"
                accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png"
                required
              />
              <p className="text-xs text-muted-foreground">
                Metadata carries over from the current version; status resets to Received.
              </p>
            </div>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            <SheetFooter className="px-0">
              <Button type="submit" disabled={pending}>
                {pending ? "Uploading…" : "Upload new version"}
              </Button>
              <SheetClose render={<Button type="button" variant="outline" />}>Close</SheetClose>
            </SheetFooter>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
