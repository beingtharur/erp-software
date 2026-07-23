import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientDetail } from "@/lib/queries/crm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatINR, titleCase } from "@/lib/format";
import { Mail, Phone, MapPin, Building2 } from "lucide-react";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientDetail(id);

  if (!client) notFound();

  const totalPipeline = client.leads
    .filter((l) => !["WON", "LOST"].includes(l.stage))
    .reduce((sum, l) => sum + l.value, 0);
  const totalProjectValue = client.projects.reduce((sum, p) => sum + p.value, 0);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{client.name}</h2>
                <Badge variant="outline" className="font-normal">{client.tier}</Badge>
                <Badge
                  variant={client.status === "Active" ? "default" : "secondary"}
                  className="font-normal"
                >
                  {client.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{titleCase(client.industry)}</p>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:items-end">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" /> {client.city}, {client.state}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5" /> {client.contactEmail}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" /> {client.contactPhone}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Open Pipeline</p>
            <p className="text-xl font-semibold">{formatINR(totalPipeline)}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Project Value</p>
            <p className="text-xl font-semibold">{formatINR(totalProjectValue)}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Active AMCs</p>
            <p className="text-xl font-semibold">
              {client.amcContracts.filter((c) => c.status !== "EXPIRED").length}
            </p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Primary Contact</p>
            <p className="text-sm font-medium mt-1">{client.contactName}</p>
            <p className="text-xs text-muted-foreground">{client.contactTitle}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Leads & Opportunities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {client.leads.length === 0 && (
            <p className="text-sm text-muted-foreground">No leads yet.</p>
          )}
          {client.leads.map((lead) => (
            <div key={lead.id} className="flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{lead.title}</p>
                <p className="text-xs text-muted-foreground">
                  {lead.owner.name} · Expected {formatDate(lead.expectedCloseDate)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono">{formatINR(lead.value)}</span>
                <Badge variant="secondary" className="font-normal">{titleCase(lead.stage)}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {client.projects.length === 0 && (
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            )}
            {client.projects.map((p) => (
              <div key={p.id} className="border-b pb-3 text-sm last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <Link href={`/crm/projects/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  <Badge variant="outline" className="font-normal">{titleCase(p.status)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatINR(p.value)} · {p.progressPercent}% complete
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AMC Contracts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {client.amcContracts.length === 0 && (
              <p className="text-sm text-muted-foreground">No AMC contracts.</p>
            )}
            {client.amcContracts.map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b pb-3 text-sm last:border-0 last:pb-0">
                <div>
                  <p className="font-medium">{c.contractNumber}</p>
                  <p className="text-xs text-muted-foreground">Expires {formatDate(c.endDate)}</p>
                </div>
                <Badge
                  variant={c.status === "EXPIRING_SOON" ? "destructive" : "outline"}
                  className="font-normal"
                >
                  {titleCase(c.status)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Site Visit History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {client.siteVisits.length === 0 && (
            <p className="text-sm text-muted-foreground">No site visits recorded.</p>
          )}
          {client.siteVisits.map((v) => (
            <div key={v.id} className="flex items-center justify-between border-b pb-3 text-sm last:border-0 last:pb-0">
              <div>
                <p className="font-medium">{v.purpose}</p>
                <p className="text-xs text-muted-foreground">
                  {v.assignedTo.name} · {formatDate(v.scheduledDate)}
                </p>
              </div>
              <Badge variant="outline" className="font-normal">{titleCase(v.status)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      <Separator className="hidden" />
    </div>
  );
}
