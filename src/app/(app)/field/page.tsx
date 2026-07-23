import { getFieldMapData, getMyActiveVisit, getGeofenceOptions } from "@/lib/queries/field";
import { getCurrentUser } from "@/lib/dal";
import { LiveMap } from "@/components/field/live-map";
import { MyFieldStatus } from "@/components/field/my-field-status";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, initials, titleCase } from "@/lib/format";

export default async function LiveMapPage() {
  const user = await getCurrentUser();
  const { reps, geofences } = await getFieldMapData();
  const checkedIn = reps.filter((r) => r.isCheckedIn);
  const offSite = reps.filter((r) => !r.isCheckedIn);

  const showMyStatus = user.accessRole === "FIELD" && user.employeeId;
  const [activeVisit, geofenceOptions] = showMyStatus
    ? await Promise.all([getMyActiveVisit(user.employeeId!), getGeofenceOptions()])
    : [null, []];

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      {showMyStatus && <MyFieldStatus activeVisit={activeVisit} geofences={geofenceOptions} />}

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="overflow-hidden lg:col-span-3 py-0 gap-0">
          <div className="h-[600px] w-full">
            <LiveMap reps={reps} geofences={geofences} />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-sm">On Site Now ({checkedIn.length})</CardTitle>
              <CardDescription>Device GPS where available, approximate otherwise</CardDescription>
            </CardHeader>
            <CardContent className="max-h-72 space-y-3 overflow-y-auto px-4">
              {checkedIn.length === 0 && (
                <p className="text-sm text-muted-foreground">No one checked in right now.</p>
              )}
              {checkedIn.map((rep) => (
                <div key={rep.id} className="flex items-center gap-2.5 text-sm">
                  <span className="relative flex size-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px]">{initials(rep.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{rep.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {rep.geofenceName} · {rep.checkInTime ? formatDateTime(rep.checkInTime) : ""}
                    </p>
                  </div>
                  {rep.isDeviceGps && (
                    <Badge variant="outline" className="shrink-0 border-emerald-500/40 text-[10px] text-emerald-600">
                      GPS
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-sm">Off Site ({offSite.length})</CardTitle>
              <CardDescription>Last known position</CardDescription>
            </CardHeader>
            <CardContent className="max-h-96 space-y-3 overflow-y-auto px-4">
              {offSite.map((rep) => (
                <div key={rep.id} className="flex items-center gap-2.5 text-sm">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px]">{initials(rep.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{rep.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{titleCase(rep.role)}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs font-normal">
                    Idle
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
