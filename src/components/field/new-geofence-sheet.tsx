"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createGeofence } from "@/lib/actions/field";
import { Plus, LocateFixed } from "lucide-react";

type ClientOption = { id: string; name: string };
type ProjectOption = { id: string; name: string; clientId: string };

export function NewGeofenceSheet({
  clients,
  projects,
}: {
  clients: ClientOption[];
  projects: ProjectOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createGeofence, undefined);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [coords, setCoords] = useState<{ lat: string; lng: string }>({ lat: "", lng: "" });
  const [locating, setLocating] = useState(false);

  const relevantProjects = projects.filter((p) => p.clientId === clientId);

  useEffect(() => {
    if (state?.success) {
      toast.success("Site created");
      setOpen(false);
      setClientId(undefined);
      setCoords({ lat: "", lng: "" });
    }
  }, [state]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation isn't available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        });
        setLocating(false);
      },
      () => {
        toast.error("Couldn't get your current location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <Plus />
        New Site
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New site</SheetTitle>
          <SheetDescription>
            Define a geofenced site that field reps can check into.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Site name</Label>
            <Input id="name" name="name" placeholder="e.g. Client HQ — Vadodara Plant" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clientId">Client (optional)</Label>
              <Select
                name="clientId"
                onValueChange={(value) => setClientId((value as string) ?? undefined)}
              >
                <SelectTrigger id="clientId" className="w-full">
                  <SelectValue placeholder="None">
                    {(value: unknown) => clients.find((c) => c.id === value)?.name ?? "None"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="projectId">Project (optional)</Label>
              <Select key={clientId} name="projectId" disabled={!clientId || relevantProjects.length === 0}>
                <SelectTrigger id="projectId" className="w-full">
                  <SelectValue
                    placeholder={
                      !clientId
                        ? "Select a client first"
                        : relevantProjects.length === 0
                          ? "No projects for this client"
                          : "None"
                    }
                  >
                    {(value: unknown) => relevantProjects.find((p) => p.id === value)?.name ?? "None"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {relevantProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Coordinates</Label>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={useCurrentLocation}
                disabled={locating}
              >
                <LocateFixed className="size-3" />
                {locating ? "Locating…" : "Use my location"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                name="latitude"
                type="number"
                step="any"
                min={-90}
                max={90}
                placeholder="Latitude"
                value={coords.lat}
                onChange={(e) => setCoords((c) => ({ ...c, lat: e.target.value }))}
                required
              />
              <Input
                name="longitude"
                type="number"
                step="any"
                min={-180}
                max={180}
                placeholder="Longitude"
                value={coords.lng}
                onChange={(e) => setCoords((c) => ({ ...c, lng: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="radiusMeters">Radius (meters)</Label>
            <Input
              id="radiusMeters"
              name="radiusMeters"
              type="number"
              min={1}
              step={1}
              defaultValue={300}
              required
            />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create site"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
