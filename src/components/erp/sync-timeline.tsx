import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/common/tone-badge";
import { providerMeta } from "@/lib/erp/providers";
import type { SyncRunView } from "@/lib/erp/activity.server";
import type { ErpConnectionView } from "@/lib/erp/providers";

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function duration(run: SyncRunView) {
  if (!run.finishedAt) return "in progress";
  const ms = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  return ms < 1000 ? "<1s" : `${Math.round(ms / 1000)}s`;
}

export interface TimelineProps {
  runs: SyncRunView[];
  connections: ErpConnectionView[];
  onRetry: (connectionId: string) => void;
  retryingId: string | null;
}

export function SyncTimeline({ runs, connections, onRetry, retryingId }: TimelineProps) {
  const failed = runs.filter((r) => r.status === "failed");
  const errored = connections.filter((c) => c.status === "error");
  const stale = connections.filter(
    (c) =>
      c.status !== "error" &&
      (!c.lastSyncAt || Date.now() - new Date(c.lastSyncAt).getTime() > 24 * 3600 * 1000),
  );

  const actions: string[] = [];
  if (errored.length)
    actions.push(
      `Retry ${errored.length} failing connection${errored.length > 1 ? "s" : ""} — the last import did not complete.`,
    );
  if (stale.length)
    actions.push(
      `Re-sync ${stale.map((c) => providerMeta(c.provider)?.name ?? c.provider).join(", ")} — data is over a day old.`,
    );
  if (!connections.length)
    actions.push("Connect your first accounting or ERP account to start importing real data.");
  if (!actions.length && runs.length)
    actions.push("All connections are healthy — no action needed right now.");

  return (
    <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="surface-card p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Integration status timeline</h2>
          <ToneBadge tone={failed.length ? "danger" : "success"} size="sm" dot>
            {failed.length
              ? `${failed.length} failed run${failed.length > 1 ? "s" : ""}`
              : "Healthy"}
          </ToneBadge>
        </div>

        {runs.length === 0 ? (
          <p className="mt-6 text-xs text-muted-foreground">
            No sync runs yet. Once you connect an account, every import appears here with its
            outcome.
          </p>
        ) : (
          <ol className="mt-5 space-y-4">
            {runs.slice(0, 8).map((run) => {
              const tone =
                run.status === "success" ? "success" : run.status === "failed" ? "danger" : "brand";
              const Icon =
                run.status === "success"
                  ? CheckCircle2
                  : run.status === "failed"
                    ? AlertTriangle
                    : Loader2;
              return (
                <li key={run.id} className="relative flex gap-3 pl-1">
                  <span className="flex flex-col items-center">
                    <Icon
                      className={`size-4 ${tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "animate-spin text-primary"}`}
                    />
                    <span className="mt-1 w-px flex-1 bg-border" />
                  </span>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {providerMeta(run.provider)?.name ?? run.provider} import
                      </p>
                      <ToneBadge tone={tone} size="sm">
                        {run.status}
                      </ToneBadge>
                      <span className="text-xs text-muted-foreground">
                        {when(run.startedAt)} · {duration(run)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {run.invoices} invoices · {run.payments} payments · {run.vendors} vendors ·{" "}
                      {run.contracts} contracts
                    </p>
                    {run.error && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-destructive/10 p-2">
                        <p className="min-w-0 flex-1 text-xs text-destructive">{run.error}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={retryingId === run.connectionId}
                          onClick={() => onRetry(run.connectionId)}
                        >
                          <RefreshCw
                            className={`size-3.5 ${retryingId === run.connectionId ? "animate-spin" : ""}`}
                          />
                          Retry
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="surface-card p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Next recommended actions</h2>
        </div>
        <ul className="mt-4 space-y-3 text-xs">
          {actions.map((a) => (
            <li key={a} className="flex gap-2 rounded-md bg-muted/40 p-3 text-muted-foreground">
              <Clock className="mt-0.5 size-3.5 shrink-0" />
              <span>{a}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-md border border-border p-3">
            <dt className="text-muted-foreground">Connections</dt>
            <dd className="mt-1 text-lg font-semibold">{connections.length}</dd>
          </div>
          <div className="rounded-md border border-border p-3">
            <dt className="text-muted-foreground">Issues detected</dt>
            <dd className="mt-1 text-lg font-semibold text-destructive">
              {errored.length + failed.length}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
