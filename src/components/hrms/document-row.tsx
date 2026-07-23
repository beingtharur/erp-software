"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteEmployeeDocument } from "@/lib/actions/hrms";
import { formatDate, formatFileSize, titleCase } from "@/lib/format";
import { FileText, Trash2 } from "lucide-react";

export function DocumentRow({
  doc,
}: {
  doc: {
    id: string;
    type: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    createdAt: Date | string;
    uploadedBy: { name: string };
  };
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteEmployeeDocument(doc.id);
        toast.success("Document removed");
      } catch {
        toast.error("Could not remove document");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-medium hover:underline"
          >
            {doc.fileName}
          </a>
          <p className="truncate text-xs text-muted-foreground">
            {formatFileSize(doc.fileSize)} · Uploaded by {doc.uploadedBy.name} ·{" "}
            {formatDate(doc.createdAt)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="outline" className="font-normal">
          {titleCase(doc.type)}
        </Badge>
        <Button
          size="icon-sm"
          variant="outline"
          disabled={isPending}
          onClick={handleDelete}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
