import Link from "next/link";
import { requireRole, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { SiteHeader } from "@/components/layout/site-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { ProductLineChart } from "@/components/dashboard/product-line-chart";
import { getDashboardData } from "@/lib/queries/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, formatDateTime, formatINR, initials, titleCase } from "@/lib/format";
import {
  TrendingUp,
  Briefcase,
  UserCheck,
  MapPinned,
  Plane,
  AlertTriangle,
  ShieldAlert,
  ClipboardList,
  ArrowRight,
  Receipt,
} from "lucide-react";

export default async function OverviewPage() {
  await requireRole(["ADMIN"]);
  const user = await getCurrentUser();
  const [data, organization] = await Promise.all([
    getDashboardData(user.organizationId!),
    getCurrentOrganization(),
  ]);

  return (
    <>
      <SiteHeader
        title="Overview"
        description={`${organization.name} operations at a glance — CRM, HRMS, vendors & field`}
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Open Pipeline"
            value={formatINR(data.openLeadsValue)}
            sub={`${data.openLeadsCount} active leads`}
            icon={TrendingUp}
          />
          <KpiCard
            label="Active Projects"
            value={String(data.activeProjectsCount)}
            sub={formatINR(data.activeProjectsValue)}
            icon={Briefcase}
            tone="success"
          />
          <KpiCard
            label="Present Today"
            value={`${data.presentToday}/${data.totalActiveEmployees}`}
            sub="employees checked in"
            icon={UserCheck}
          />
          <KpiCard
            label="On-Site Now"
            value={String(data.checkedInNow)}
            sub="field reps at client sites"
            icon={MapPinned}
            tone="success"
          />
          <KpiCard
            label="Pending Leave"
            value={String(data.pendingLeave)}
            sub={`awaiting approval${data.pendingHalfDay > 0 ? ` · ${data.pendingHalfDay} half-day` : ""}`}
            icon={Plane}
            tone={data.pendingLeave > 0 ? "warning" : "default"}
          />
          <KpiCard
            label="Pending Expense Claims"
            value={String(data.pendingExpenseClaimsCount)}
            sub={formatINR(data.pendingExpenseClaimsAmount)}
            icon={Receipt}
            tone={data.pendingExpenseClaimsCount > 0 ? "warning" : "default"}
          />
          <KpiCard
            label="Overdue Payments"
            value={formatINR(data.overduePaymentsAmount)}
            sub={`${data.overduePaymentsCount} vendor invoices`}
            icon={AlertTriangle}
            tone={data.overduePaymentsCount > 0 ? "danger" : "default"}
          />
          <KpiCard
            label="AMC Expiring Soon"
            value={String(data.expiringAmc)}
            sub="within 30 days"
            icon={ShieldAlert}
            tone={data.expiringAmc > 0 ? "warning" : "default"}
          />
          <KpiCard
            label="Open Purchase Orders"
            value={String(data.openPurchaseOrders)}
            sub="sent or confirmed"
            icon={ClipboardList}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Pipeline by stage</CardTitle>
              <CardDescription>Open RFQ / tender value across the sales funnel</CardDescription>
            </CardHeader>
            <CardContent>
              <PipelineChart data={data.leadsByStage} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Projects by product line</CardTitle>
              <CardDescription>Active & planned engagements</CardDescription>
            </CardHeader>
            <CardContent>
              <ProductLineChart data={data.projectsByLine} />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Upcoming site visits</CardTitle>
                <CardDescription>Next scheduled field engagements</CardDescription>
              </div>
              <Link href="/crm/site-visits" className="text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-4" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.upcomingVisits.length === 0 && (
                <p className="text-sm text-muted-foreground">No visits scheduled.</p>
              )}
              {data.upcomingVisits.map((v) => (
                <div key={v.id} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{v.client.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {v.purpose} · {v.assignedTo.name}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs font-normal">
                    {formatDate(v.scheduledDate)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>AMC renewals</CardTitle>
                <CardDescription>Service contracts by expiry</CardDescription>
              </div>
              <Link href="/crm/amc" className="text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-4" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.amcExpiring.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.client.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.contractNumber}</p>
                  </div>
                  <Badge
                    variant={c.status === "EXPIRING_SOON" ? "destructive" : "outline"}
                    className="shrink-0 text-xs font-normal"
                  >
                    {formatDate(c.endDate)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Live field activity</CardTitle>
                <CardDescription>Currently checked in on-site</CardDescription>
              </div>
              <Link href="/field" className="text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-4" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.liveVisitLogs.length === 0 && (
                <p className="text-sm text-muted-foreground">No active field visits.</p>
              )}
              {data.liveVisitLogs.map((v) => (
                <div key={v.id} className="flex items-center gap-3 text-sm">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px]">{initials(v.employee.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{v.employee.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {v.geofence.client?.name ?? v.geofence.name} · since {formatDateTime(v.checkInTime)}
                    </p>
                  </div>
                  <span className="relative flex size-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent quotations</CardTitle>
            <CardDescription>Latest proposals issued to clients</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentQuotations.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-3 text-sm border-b pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {q.quoteNumber} · {q.client.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Issued {formatDate(q.issuedOn)} · Valid until {formatDate(q.validUntil)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm">{formatINR(q.amount)}</span>
                  <Badge
                    variant={
                      q.status === "APPROVED"
                        ? "default"
                        : q.status === "REJECTED"
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-xs font-normal"
                  >
                    {titleCase(q.status)}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
