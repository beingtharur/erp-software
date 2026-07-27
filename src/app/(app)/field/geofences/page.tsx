import { getGeofences } from "@/lib/queries/field";
import { getClientOptions, getProjectOptionsByClient } from "@/lib/queries/crm";
import { getCurrentUser } from "@/lib/dal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewGeofenceSheet } from "@/components/field/new-geofence-sheet";

export default async function GeofencesPage() {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  const [geofences, clients, projects] = await Promise.all([
    getGeofences(organizationId),
    getClientOptions(organizationId),
    getProjectOptionsByClient(organizationId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      {user.accessRole === "ADMIN" && (
        <div className="flex justify-end">
          <NewGeofenceSheet clients={clients} projects={projects} />
        </div>
      )}
      <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Zone</TableHead>
            <TableHead>Client / Project</TableHead>
            <TableHead>Coordinates</TableHead>
            <TableHead className="text-right">Radius</TableHead>
            <TableHead className="text-right">Visits Logged</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {geofences.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                No sites yet.
              </TableCell>
            </TableRow>
          )}
          {geofences.map((g) => (
            <TableRow key={g.id}>
              <TableCell className="font-medium">{g.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {g.client?.name ?? g.project?.name ?? "—"}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {g.latitude.toFixed(4)}, {g.longitude.toFixed(4)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">{g.radiusMeters} m</TableCell>
              <TableCell className="text-right text-muted-foreground">{g._count.visitLogs}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
