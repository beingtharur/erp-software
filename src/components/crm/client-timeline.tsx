import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Target, MapPin, FileText, HardHat, ShieldCheck, type LucideIcon } from "lucide-react";

type Stage = { key: string; label: string; icon: LucideIcon; count: number };

// Purely presentational — no click-through beyond what the per-stage cards already
// on the client detail page provide. Counts come from data getClientDetail already
// fetches, so this needs no query of its own.
export function ClientTimeline({
  counts,
}: {
  counts: { leads: number; siteVisits: number; quotations: number; projects: number; amcContracts: number };
}) {
  const stages: Stage[] = [
    { key: "leads", label: "Lead", icon: Target, count: counts.leads },
    { key: "siteVisits", label: "Site Visit", icon: MapPin, count: counts.siteVisits },
    { key: "quotations", label: "Quotation", icon: FileText, count: counts.quotations },
    { key: "projects", label: "Project", icon: HardHat, count: counts.projects },
    { key: "amcContracts", label: "AMC", icon: ShieldCheck, count: counts.amcContracts },
  ];

  return (
    <div className="flex items-center justify-between overflow-x-auto rounded-lg border bg-card p-4">
      {stages.map((stage, i) => (
        <div key={stage.key} className="flex flex-1 items-center last:flex-none">
          <div className="flex shrink-0 flex-col items-center gap-1.5 px-1">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-full",
                stage.count > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              <stage.icon className="size-5" />
            </div>
            <p className="whitespace-nowrap text-xs font-medium">{stage.label}</p>
            <Badge variant={stage.count > 0 ? "secondary" : "outline"} className="text-[10px] font-normal">
              {stage.count}
            </Badge>
          </div>
          {i < stages.length - 1 && (
            <div className={cn("mx-1 h-px flex-1", stage.count > 0 ? "bg-primary/40" : "bg-border")} />
          )}
        </div>
      ))}
    </div>
  );
}
