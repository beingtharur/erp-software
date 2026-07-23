"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials, titleCase } from "@/lib/format";
import { ChevronDown, ChevronRight } from "lucide-react";

export type OrgNode = {
  id: string;
  name: string;
  role: string;
  department: string;
  children: OrgNode[];
};

function OrgChartNode({ node, depth }: { node: OrgNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => hasChildren && setExpanded((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-accent/50 disabled:cursor-default"
        disabled={!hasChildren}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="size-3.5 shrink-0" />
        )}
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="text-[11px]">{initials(node.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-none">{node.name}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {titleCase(node.role)} · {node.department}
          </p>
        </div>
        {hasChildren && (
          <Badge variant="outline" className="shrink-0 text-[10px] font-normal text-muted-foreground">
            {node.children.length} report{node.children.length === 1 ? "" : "s"}
          </Badge>
        )}
      </button>

      {hasChildren && expanded && (
        <div className="mt-2 ml-4 grid grid-cols-1 gap-2 border-l pl-4 sm:grid-cols-2 xl:grid-cols-3">
          {node.children.map((child) => (
            <OrgChartNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrgChart({ roots }: { roots: OrgNode[] }) {
  if (roots.length === 0) {
    return <p className="text-sm text-muted-foreground">No active employees to show.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {roots.map((root) => (
        <OrgChartNode key={root.id} node={root} depth={0} />
      ))}
    </div>
  );
}
