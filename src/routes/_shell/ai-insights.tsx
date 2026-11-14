import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { ToneBadge } from "@/components/common/tone-badge";
import { NoImportedData } from "@/components/common/no-data";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChartCard, RecoveryLineChart } from "@/components/dashboard/charts";
import { useAiLeakageAnalysis, useErpOverview } from "@/hooks/use-erp";
import { currencyIn, percent } from "@/lib/format";

export const Route = createFileRoute("/_shell/ai-insights")({
  head: () => ({
    meta: [
      { title: "AI Insights — AutoAudit" },
      {
        name: "description",
        content:
          "Plain-language explanations and prioritised actions generated from the findings in your imported financial records.",
      },
      { property: "og:title", content: "AI Insights — AutoAudit" },
      {
        property: "og:description",
        content: "Explainable findings across your imported financial records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiInsightsPage,
});

function AiInsightsPage() {
  const { data, isLoading, isFetching, refetch } = useErpOverview();
  const aiAnalysis = useAiLeakageAnalysis();
  const code = data?.currencyCode;
  const insights = data?.insights ?? [];
  const leaks = data?.leaks ?? [];

  const runAiAnalysis = () => {
    void aiAnalysis.refetch();
  };

  if (!isLoading && !data?.connected) {
    return (
      <>
        <PageHeader
          title="AI insights"
          description="Explanations generated from your imported records."
          crumbs={[{ label: "AI Insights" }]}
        />
        <NoImportedData />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="AI insights"
        description="Every finding is explained in plain language with the records the analysis used."
        crumbs={[{ label: "AI Insights" }]}
        actions={
          <>
            <Button
              variant="outline"
              className="gap-2"
              disabled={aiAnalysis.isFetching || !data?.connected}
              onClick={runAiAnalysis}
            >
              <WandSparkles className={`size-4 ${aiAnalysis.isFetching ? "animate-pulse" : ""}`} />
              {aiAnalysis.isFetching ? "AI scan running" : "Run AI scan"}
            </Button>
            <Button className="gap-2" disabled={isFetching} onClick={() => void refetch()}>
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /> Re-analyse
            </Button>
          </>
        }
      />

      {aiAnalysis.error && (
        <Alert variant="destructive" className="mt-5">
          <AlertTriangle className="size-4" />
          <AlertTitle>AI analysis could not run</AlertTitle>
          <AlertDescription>{aiAnalysis.error.message}</AlertDescription>
        </Alert>
      )}

      {aiAnalysis.data && (
        <section className="mt-5 space-y-4" aria-label="AI leakage analysis">
          <div className="surface-card overflow-hidden border-primary/20">
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <ToneBadge tone="violet" dot>
                    AI control review
                  </ToneBadge>
                  <ToneBadge
                    tone={
                      aiAnalysis.data.riskLevel === "critical" ||
                      aiAnalysis.data.riskLevel === "high"
                        ? "danger"
                        : aiAnalysis.data.riskLevel === "moderate"
                          ? "warning"
                          : "success"
                    }
                  >
                    {aiAnalysis.data.riskLevel} risk
                  </ToneBadge>
                </div>
                <h2 className="mt-3 text-lg font-semibold">AI leakage assessment</h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {aiAnalysis.data.summary}
                </p>
              </div>
              <div className="rounded-xl border border-primary/15 bg-primary/5 px-5 py-4 lg:min-w-48">
                <p className="text-xs text-muted-foreground">Estimated exposure</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {currencyIn(aiAnalysis.data.estimatedExposure, aiAnalysis.data.currency)}
                </p>
              </div>
            </div>
            {(aiAnalysis.data.recommendations.length > 0 ||
              aiAnalysis.data.limitations.length > 0) && (
              <div className="grid gap-4 border-t border-border/70 bg-muted/25 p-5 lg:grid-cols-2">
                {aiAnalysis.data.recommendations.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <CheckCircle2 className="size-4 text-success" /> Recommended controls
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {aiAnalysis.data.recommendations.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-success">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiAnalysis.data.limitations.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <AlertTriangle className="size-4 text-warning" /> Review notes
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {aiAnalysis.data.limitations.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-warning">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {aiAnalysis.data.findings.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {aiAnalysis.data.findings.map((finding, i) => (
                <motion.article
                  key={finding.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="surface-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <ToneBadge tone="muted" size="sm">
                          {finding.category}
                        </ToneBadge>
                        <ToneBadge
                          tone={
                            finding.severity === "critical" || finding.severity === "high"
                              ? "danger"
                              : finding.severity === "medium"
                                ? "warning"
                                : "muted"
                          }
                          size="sm"
                        >
                          {finding.severity}
                        </ToneBadge>
                      </div>
                      <h3 className="mt-3 text-sm font-semibold">{finding.title}</h3>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {currencyIn(finding.amount, finding.currency)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {finding.evidence}
                  </p>
                  <div className="mt-4 border-t border-border/70 pt-3 text-sm">
                    <span className="font-medium">Next control: </span>
                    <span className="text-muted-foreground">{finding.recommendation}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>AI confidence</span>
                    <span>{percent(finding.confidence)}</span>
                  </div>
                  <Progress value={finding.confidence * 100} className="mt-1.5 h-1.5" />
                </motion.article>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="surface-card space-y-3 p-5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-8 w-40" />
              </div>
            ))
          ) : insights.length === 0 ? (
            <div className="surface-card p-8 text-center text-sm text-muted-foreground">
              No issues found in the imported records — nothing to explain right now.
            </div>
          ) : (
            insights.map((insight, i) => (
              <motion.article
                key={insight.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="surface-card p-5"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet/10 text-violet">
                      <Sparkles className="size-4.5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{insight.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {insight.category} · {insight.count}{" "}
                        {insight.count === 1 ? "finding" : "findings"}
                      </p>
                    </div>
                  </div>
                  <ToneBadge tone="success">{currencyIn(insight.impact, code)}</ToneBadge>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {insight.summary}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Detection confidence</span>
                  <span>{percent(insight.confidence)}</span>
                </div>
                <Progress value={insight.confidence * 100} className="mt-1.5 h-1.5" />
              </motion.article>
            ))
          )}
        </div>

        <div className="space-y-4">
          <ChartCard
            title="Exposure over time"
            description="Invoiced vs detected exposure by month"
          >
            <RecoveryLineChart data={data?.detectedByMonth ?? []} />
          </ChartCard>
          <div className="surface-card p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Brain className="size-4 text-primary" /> Analysis coverage
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Invoices analysed", (data?.totals.invoices ?? 0).toLocaleString()],
                ["Payments analysed", (data?.totals.payments ?? 0).toLocaleString()],
                ["Vendors analysed", (data?.totals.vendors ?? 0).toLocaleString()],
                ["Findings raised", leaks.length.toLocaleString()],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold">Largest findings</h3>
            <ul className="mt-3 space-y-3">
              {leaks.slice(0, 5).map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{l.vendor}</p>
                  </div>
                  <ToneBadge tone="brand" size="sm">
                    {currencyIn(l.amount, l.currency || code)}
                  </ToneBadge>
                </li>
              ))}
              {leaks.length === 0 && (
                <li className="text-sm text-muted-foreground">Nothing flagged.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
