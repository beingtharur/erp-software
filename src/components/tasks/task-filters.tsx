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

type EmployeeOption = { id: string; name: string };

const STATUS_LABEL: Record<string, string> = {
  ALL: "Any status",
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

const PRIORITY_LABEL: Record<string, string> = {
  ALL: "Any priority",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const DUE_LABEL: Record<string, string> = {
  ALL: "Any due date",
  overdue: "Overdue",
  today: "Due today",
  week: "Due this week",
  none: "No due date",
};

/**
 * Filters are held in the URL rather than component state: the task list is a
 * Server Component, so pushing the query string is what re-runs the filtered
 * query, and a filtered view stays shareable and survives a refresh.
 */
export function TaskFilters({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const employeeId = searchParams.get("employeeId") ?? "ALL";
  const status = searchParams.get("status") ?? "ALL";
  const priority = searchParams.get("priority") ?? "ALL";
  const due = searchParams.get("due") ?? "ALL";
  const hasFilters =
    employeeId !== "ALL" || status !== "ALL" || priority !== "ALL" || due !== "ALL" || Boolean(search);

  function apply(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === "ALL") next.delete(key);
    else next.set(key, value);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  // Debounced so typing doesn't fire a server round-trip per keystroke.
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
        <Label htmlFor="task-search">Search</Label>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="task-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Task, notes or employee…"
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-employee">Employee</Label>
        <Select value={employeeId} onValueChange={(v) => apply("employeeId", String(v ?? "ALL"))}>
          <SelectTrigger id="filter-employee" className="w-44">
            <SelectValue>
              {(value: unknown) =>
                value === "ALL" || !value
                  ? "All employees"
                  : (employees.find((e) => e.id === value)?.name ?? "All employees")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All employees</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-status">Status</Label>
        <Select value={status} onValueChange={(v) => apply("status", String(v ?? "ALL"))}>
          <SelectTrigger id="filter-status" className="w-36">
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-priority">Priority</Label>
        <Select value={priority} onValueChange={(v) => apply("priority", String(v ?? "ALL"))}>
          <SelectTrigger id="filter-priority" className="w-36">
            <SelectValue>
              {(value: unknown) => PRIORITY_LABEL[value as string] ?? "Any priority"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-due">Due date</Label>
        <Select value={due} onValueChange={(v) => apply("due", String(v ?? "ALL"))}>
          <SelectTrigger id="filter-due" className="w-36">
            <SelectValue>{(value: unknown) => DUE_LABEL[value as string] ?? "Any due date"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DUE_LABEL).map(([value, label]) => (
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
