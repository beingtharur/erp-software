import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Plain Link-based pagination (no client JS needed) — the caller supplies
// buildHref so it can preserve whatever other search params (filters, sort)
// belong to its own page.
export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const windowEnd = Math.min(totalPages, Math.max(page + 2, 5));
  const pages = Array.from(
    { length: windowEnd - windowStart + 1 },
    (_, i) => windowStart + i
  ).filter((p) => p >= 1 && p <= totalPages);

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        size="icon-sm"
        variant="outline"
        disabled={page <= 1}
        render={page > 1 ? <Link href={buildHref(page - 1)} /> : undefined}
      >
        <ChevronLeft className="size-3.5" />
      </Button>
      {windowStart > 1 && <span className="px-1 text-sm text-muted-foreground">…</span>}
      {pages.map((p) => (
        <Button
          key={p}
          size="icon-sm"
          variant={p === page ? "default" : "outline"}
          render={p !== page ? <Link href={buildHref(p)} /> : undefined}
        >
          {p}
        </Button>
      ))}
      {windowEnd < totalPages && <span className="px-1 text-sm text-muted-foreground">…</span>}
      <Button
        size="icon-sm"
        variant="outline"
        disabled={page >= totalPages}
        render={page < totalPages ? <Link href={buildHref(page + 1)} /> : undefined}
      >
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  );
}
