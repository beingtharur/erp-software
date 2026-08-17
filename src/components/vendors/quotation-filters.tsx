"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  ALL: "Any status",
  RECEIVED: "Received",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

/** Same URL-searchParams-driven pattern as components/tasks/task-filters.tsx. */
export function QuotationFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const status = searchParams.get("status") ?? "ALL";
  const hasFilters = status !== "ALL" || Boolean(search);

  function apply(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === "ALL") next.delete(key);
    else next.set(key, value);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (search === current) return;
    const timer = setTimeout(() => apply("search", search), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function clearAll() {
    setSearch("");
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-end gap-3" data-pending={isPending ? "" : undefined}>
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <Label htmlFor="quotation-search">Search</Label>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="quotation-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Quotation #, vendor, project or client…"
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quotation-status">Status</Label>
        <Select value={status} onValueChange={(v) => apply("status", String(v ?? "ALL"))}>
          <SelectTrigger id="quotation-status" className="w-44">
            <SelectValue>{(value: unknown) => STATUS_LABEL[value as string] ?? "Any status"}</SelectValue>
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

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} disabled={isPending}>
          <X />
          Clear
        </Button>
      )}
    </div>
  );
}
