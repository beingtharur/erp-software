"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Circle, Marker, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatDateTime } from "@/lib/format";

export type FieldRep = {
  id: string;
  name: string;
  role: string;
  department: string;
  latitude: number;
  longitude: number;
  geofenceId: string | null;
  geofenceName: string | null;
  isCheckedIn: boolean;
  checkInTime: Date | string | null;
  visitPurpose: string | null;
  isDeviceGps: boolean;
};

export type FieldGeofence = {
  id: string;
  name: string;
  clientName: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

const roleLabel: Record<string, string> = {
  INSTALLATION_CREW: "Installation Crew",
  TECHNICIAN: "Technician",
  SALES_REP: "Sales Rep",
};

function jitter(lat: number, lng: number, maxMeters: number) {
  const dLat = (Math.random() - 0.5) * 2 * (maxMeters / 111_320);
  const dLng =
    (Math.random() - 0.5) * 2 * (maxMeters / (111_320 * Math.cos((lat * Math.PI) / 180)));
  return { lat: lat + dLat, lng: lng + dLng };
}

function makeIcon(color: string, pulse: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:16px;height:16px;">
      <div class="${pulse ? "field-marker-pulse" : ""}" style="--pulse-color:${color};position:absolute;inset:0;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>
    </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

export function LiveMapInner({
  reps,
  geofences,
}: {
  reps: FieldRep[];
  geofences: FieldGeofence[];
}) {
  const [positions, setPositions] = useState<Record<string, { lat: number; lng: number }>>(() =>
    Object.fromEntries(reps.map((r) => [r.id, { lat: r.latitude, lng: r.longitude }]))
  );

  const geofenceById = useMemo(() => new Map(geofences.map((g) => [g.id, g])), [geofences]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPositions((prev) => {
        const next = { ...prev };
        for (const rep of reps) {
          if (!rep.isCheckedIn) continue;
          const zone = rep.geofenceId ? geofenceById.get(rep.geofenceId) : null;
          const anchor = zone
            ? { lat: zone.latitude, lng: zone.longitude }
            : { lat: rep.latitude, lng: rep.longitude };
          const radius = zone ? Math.min(zone.radiusMeters * 0.6, 200) : 80;
          next[rep.id] = jitter(anchor.lat, anchor.lng, radius);
        }
        return next;
      });
    }, 3500);
    return () => clearInterval(interval);
  }, [reps, geofenceById]);

  const center: [number, number] = useMemo(() => {
    if (geofences.length === 0) return [22.3072, 73.1812];
    const lat = geofences.reduce((s, g) => s + g.latitude, 0) / geofences.length;
    const lng = geofences.reduce((s, g) => s + g.longitude, 0) / geofences.length;
    return [lat, lng];
  }, [geofences]);

  return (
    <MapContainer
      center={center}
      zoom={5}
      scrollWheelZoom
      className="h-full w-full"
      style={{ background: "var(--muted)" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {geofences.map((g) => (
        <Circle
          key={g.id}
          center={[g.latitude, g.longitude]}
          radius={g.radiusMeters}
          pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.08, weight: 1.5 }}
        >
          <Tooltip direction="top" opacity={0.9}>
            {g.clientName ?? g.name}
          </Tooltip>
        </Circle>
      ))}
      {reps.map((rep) => {
        const pos = positions[rep.id];
        if (!pos) return null;
        const color = rep.isCheckedIn ? "#10b981" : "#94a3b8";
        return (
          <Marker
            key={rep.id}
            position={[pos.lat, pos.lng]}
            icon={makeIcon(color, rep.isCheckedIn)}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-medium">{rep.name}</p>
                <p className="text-muted-foreground">{roleLabel[rep.role] ?? rep.role}</p>
                {rep.isCheckedIn ? (
                  <>
                    {rep.isDeviceGps && (
                      <p className="mt-1 text-[11px] font-medium text-emerald-600">
                        ● Live device GPS
                      </p>
                    )}
                    <p className="mt-1">
                      <span className="font-medium">On site:</span> {rep.geofenceName}
                    </p>
                    <p>
                      <span className="font-medium">Purpose:</span> {rep.visitPurpose}
                    </p>
                    {rep.checkInTime && (
                      <p className="text-xs text-muted-foreground">
                        Since {formatDateTime(rep.checkInTime)}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Not currently checked in</p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
