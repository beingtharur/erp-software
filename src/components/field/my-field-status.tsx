"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { checkIn, checkOut } from "@/lib/actions/field";
import { formatDateTime } from "@/lib/format";
import { MapPin, LogOut, LocateFixed } from "lucide-react";

type GeoStatus = "locating" | "ready" | "unavailable" | "denied";

const geoStatusLabel: Record<GeoStatus, string> = {
  locating: "Getting your location…",
  ready: "Using your device's GPS location",
  unavailable: "Location unavailable — will use the site's approximate location",
  denied: "Location permission denied — will use the site's approximate location",
};

type ActiveVisit = {
  id: string;
  purpose: string;
  checkInTime: Date | string;
  geofence: { name: string; client: { name: string } | null };
};

export function MyFieldStatus({
  activeVisit,
  geofences,
}: {
  activeVisit: ActiveVisit | null;
  geofences: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(checkIn, undefined);
  const [checkingOut, startCheckOut] = useTransition();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  // Always starts as "locating" on both server and client — `navigator` doesn't exist
  // during SSR, so branching on it here would cause a hydration mismatch.
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("locating");

  useEffect(() => {
    if (activeVisit) return;
    // Deferred a tick so the "unavailable" setState below isn't synchronous-in-effect.
    queueMicrotask(() => {
      if (!("geolocation" in navigator)) {
        setGeoStatus("unavailable");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGeoStatus("ready");
        },
        (err) => setGeoStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }, [activeVisit]);

  if (activeVisit) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Checked in — {activeVisit.geofence.client?.name ?? activeVisit.geofence.name}
            </CardTitle>
            <CardDescription>
              {activeVisit.purpose} · since {formatDateTime(activeVisit.checkInTime)}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={checkingOut}
            onClick={() =>
              startCheckOut(async () => {
                try {
                  await checkOut(activeVisit.id);
                  toast.success("Checked out");
                } catch {
                  toast.error("Could not check out");
                }
              })
            }
          >
            <LogOut />
            {checkingOut ? "Checking out…" : "Check out"}
          </Button>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MapPin className="size-4" />
          Not checked in
        </CardTitle>
        <CardDescription>Check in when you arrive at a client site.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
          <input type="hidden" name="longitude" value={coords?.lng ?? ""} />
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="geofenceId">Site</Label>
            <Select name="geofenceId" required>
              <SelectTrigger id="geofenceId" className="w-full">
                <SelectValue placeholder="Select site" />
              </SelectTrigger>
              <SelectContent>
                {geofences.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="purpose">Purpose</Label>
            <Input id="purpose" name="purpose" placeholder="e.g. Site survey" required />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Checking in…" : "Check in"}
          </Button>
        </form>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <LocateFixed className="size-3.5" />
          {geoStatusLabel[geoStatus]}
        </p>
        {state?.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
      </CardContent>
    </Card>
  );
}
