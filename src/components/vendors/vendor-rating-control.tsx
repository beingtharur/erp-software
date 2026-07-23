"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { updateVendorRating } from "@/lib/actions/vendor";
import { cn } from "@/lib/utils";

const STAR_VALUES = [1, 2, 3, 4, 5];

export function VendorRatingControl({
  vendorId,
  rating,
  readOnly,
}: {
  vendorId: string;
  rating: number;
  readOnly?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [hovered, setHovered] = useState<number | null>(null);

  function setRating(value: number) {
    if (readOnly || isPending) return;
    startTransition(async () => {
      try {
        await updateVendorRating(vendorId, value);
        toast.success(`Rating set to ${value}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update rating");
      }
    });
  }

  const display = hovered ?? rating;

  return (
    <div
      className={cn("flex items-center gap-2", !readOnly && "cursor-pointer")}
      onMouseLeave={() => setHovered(null)}
    >
      <div className="flex items-center gap-0.5">
        {STAR_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            disabled={readOnly || isPending}
            aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
            onMouseEnter={() => !readOnly && setHovered(value)}
            onClick={() => setRating(value)}
            className="disabled:cursor-default"
          >
            <Star
              className={cn(
                "size-4 transition-colors",
                value <= Math.round(display)
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-muted-foreground/40"
              )}
            />
          </button>
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}
