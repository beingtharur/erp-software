import { getGeofences } from "@/lib/queries/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function GeofencesPage() {
  const geofences = await getGeofences();

  return (
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
  );
}
