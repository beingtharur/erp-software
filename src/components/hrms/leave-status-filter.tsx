"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_LABEL: Record<string, string> = {
  ALL: "All statuses",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function LeaveStatusFilter({ status }: { status: string }) {
  const router = useRouter();

  return (
    <Select
      value={status}
      onValueChange={(value) => {
        const params = new URLSearchParams();
        if (value !== "ALL") params.set("status", String(value));
        router.push(`/hrms/leave${params.toString() ? `?${params}` : ""}`);
      }}
    >
      <SelectTrigger className="w-40">
        <SelectValue>{(value: unknown) => STATUS_LABEL[value as string] ?? "All statuses"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(STATUS_LABEL).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
