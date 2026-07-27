import { notFound } from "next/navigation";
import Link from "next/link";
import { getSiteDetail } from "@/lib/queries/sites";
import { getCurrentUser } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditSiteSheet } from "@/components/crm/edit-site-sheet";
import { formatDate, titleCase } from "@/lib/format";
import { Warehouse, MapPin, Phone } from "lucide-react";

const amcStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  EXPIRING_SOON: "destructive",
  EXPIRED: "secondary",
};

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const site = await getSiteDetail(id, user.organizationId!);

  if (!site) notFound();

  const location = [site.addressLine, site.city, site.state, site.pincode].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Warehouse className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{site.name}</h2>
                <Badge variant={site.status === "Active" ? "default" : "secondary"} className="font-normal">
                  {site.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                <Link href={`/crm/clients/${site.clientId}`} className="hover:underline">
                  {site.client.name}
                </Link>
                {site.siteCode ? ` · ${site.siteCode}` : ""}
              </p>
            </div>
          </div>
          <EditSiteSheet site={site} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="flex items-start gap-1.5 text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              {location || "No address on file"}
            </p>
            {site.contactName && (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="size-3.5 shrink-0" />
                {site.contactName}
                {site.contactPhone ? ` · ${site.contactPhone}` : ""}
              </p>
            )}
            {(site.project || site.lead) && (
              <div className="space-y-0.5 pt-2 text-xs text-muted-foreground">
                {site.project && (
                  <p>
                    Project:{" "}
                    <Link href={`/crm/projects/${site.project.id}`} className="text-foreground hover:underline">
                      {site.project.name}
                    </Link>
                  </p>
                )}
                {site.lead && <p>Lead: {site.lead.title}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-semibold">{site.siteVisits.length}</p>
              <p className="text-xs text-muted-foreground">Visits</p>
            </div>
            <div>
              <p className="text-xl font-semibold">{site.amcContracts.length}</p>
              <p className="text-xs text-muted-foreground">AMC</p>
            </div>
            <div>
              <p className="text-xl font-semibold">{site.supportTickets.length}</p>
              <p className="text-xs text-muted-foreground">Tickets</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Site Visits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {site.siteVisits.length === 0 && (
            <p className="text-sm text-muted-foreground">No visits recorded for this site yet.</p>
          )}
          {site.siteVisits.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{v.purpose}</p>
                <p className="text-xs text-muted-foreground">
                  {v.assignedTo.name} · {formatDate(v.scheduledDate)}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 font-normal">
                {titleCase(v.status)}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AMC Contracts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {site.amcContracts.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
            {site.amcContracts.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between border-b pb-3 text-sm last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">{c.contractNumber}</p>
                  <p className="text-xs text-muted-foreground">Expires {formatDate(c.endDate)}</p>
                </div>
                <Badge variant={amcStatusVariant[c.status]} className="font-normal">
                  {titleCase(c.status)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {site.supportTickets.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
            {site.supportTickets.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0 last:pb-0"
              >
                <p className="truncate font-medium">{t.subject}</p>
                <Badge variant="outline" className="shrink-0 font-normal">
                  {titleCase(t.status)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
