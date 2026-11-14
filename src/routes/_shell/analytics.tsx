import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/page-header";
import { NoImportedData } from "@/components/common/no-data";
import { ToneBadge } from "@/components/common/tone-badge";
import {
  AnomalyBarChart,
  ChartCard,
  LeakBreakdownChart,
  RiskRadarChart,
  SavingsTrendChart,
} from "@/components/dashboard/charts";
import { useErpOverview } from "@/hooks/use-erp";
import { compactCurrencyIn } from "@/lib/format";

export const Route = createFileRoute("/_shell/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — AutoAudit" },
      {
        name: "description",
        content:
          "Spend, exposure and vendor concentration computed from the records imported from your accounting systems.",
      },
      { property: "og:title", content: "Analytics — AutoAudit" },
      {
        property: "og:description",
        content: "Spend and exposure analytics from your imported records.",
      },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data, isLoading } = useErpOverview();
  const code = data?.currencyCode;
  const trend = data?.detectedByMonth ?? [];
  const mix = data?.leakMix ?? [];
  const severity = (data?.severityMix ?? []).map((s) => ({ label: s.severity, count: s.count }));
  const topSpend = (data?.topVendors ?? []).reduce((s, v) => s + v.spend, 0) || 1;
  const radar = (data?.topVendors ?? []).slice(0, 6).map((v) => ({
    area: v.vendor.length > 14 ? `${v.vendor.slice(0, 13)}…` : v.vendor,
    score: Math.round((v.spend / topSpend) * 100),
  }));

  if (!isLoading && !data?.connected) {
    return (
      <>
        <PageHeader
          title="Analytics"
          description="Spend, exposure and vendor concentration from your imported records."
          crumbs={[{ label: "Analytics" }]}
        />
        <NoImportedData />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Spend, exposure and vendor concentration computed from your imported records."
        crumbs={[{ label: "Analytics" }]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Invoiced vs. detected exposure"
          description="Last 12 months of imported activity"
          action={
            <ToneBadge tone="brand">
              {compactCurrencyIn(data?.totals.spend ?? 0, code)} invoiced
            </ToneBadge>
          }
        >
          <SavingsTrendChart data={trend} />
        </ChartCard>
        <ChartCard
          title="Findings by severity"
          description="Open findings from the latest analysis"
        >
          <AnomalyBarChart data={severity} />
        </ChartCard>
        <ChartCard title="Spend concentration" description="Share of billed value by top party">
          <RiskRadarChart data={radar} />
        </ChartCard>
        <ChartCard title="Leakage mix" description="Share of total exposure by finding type">
          <LeakBreakdownChart data={mix} />
        </ChartCard>
      </div>
    </>
  );
}
