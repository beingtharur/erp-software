"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { FieldRep, FieldGeofence } from "@/components/field/live-map-inner";

const LiveMapInner = dynamic(
  () => import("@/components/field/live-map-inner").then((m) => m.LiveMapInner),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full" />,
  }
);

export function LiveMap({
  reps,
  geofences,
}: {
  reps: FieldRep[];
  geofences: FieldGeofence[];
}) {
  return <LiveMapInner reps={reps} geofences={geofences} />;
}
