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
import { ORG_UNIT_TYPE_LABEL, orgUnitTypeName } from "@/lib/departments";
import { Search, X } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  ALL: "All statuses",
  active: "Active only",
  inactive: "Inactive only",
};

/**
 * Same URL-state pattern as the HRMS task filters: the list is a Server
 * Component, so pushing the query string is what re-runs the filtered query and
 * keeps a filtered view shareable and refresh-proof.
 */
export function DepartmentFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const status = searchParams.get("status") ?? "ALL";
  const type = searchParams.get("type") ?? "ALL";
  const hasFilters = status !== "ALL" || type !== "ALL" || Boolean(search);

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
        <Label htmlFor="department-search">Search</Label>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="department-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, code or description…"
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="department-type">Type</Label>
        <Select value={type} onValueChange={(v) => apply("type", String(v ?? "ALL"))}>
          <SelectTrigger id="department-type" className="w-40">
            <SelectValue>
              {(value: unknown) =>
                value === "ALL" || !value ? "All types" : orgUnitTypeName(String(value))
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {Object.entries(ORG_UNIT_TYPE_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="department-status">Status</Label>
        <Select value={status} onValueChange={(v) => apply("status", String(v ?? "ALL"))}>
          <SelectTrigger id="department-status" className="w-36">
            <SelectValue>
              {(value: unknown) => STATUS_LABEL[value as string] ?? "All statuses"}
            </SelectValue>
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
      {/* The list is a Server Component, so a filter change is a round trip.
          This is the loading state for it. */}
      {isPending && <span className="pb-2 text-xs text-muted-foreground">Updating…</span>}
    </div>
  );
}
