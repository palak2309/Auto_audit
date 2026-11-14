import { createFileRoute, useSearch } from "@tanstack/react-router";
import { PermissionGate } from "@/components/common/permission-gate";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Code2, Plus, RefreshCw, Settings } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/tone-badge";
import { Button } from "@/components/ui/button";
import { ConnectWizard } from "@/components/erp/connect-wizard";
import { ProviderConfigDialog } from "@/components/erp/provider-config-dialog";
import { CustomApiDialog } from "@/components/erp/custom-api-dialog";
import { SyncTimeline } from "@/components/erp/sync-timeline";
import { ImportDashboard } from "@/components/erp/import-dashboard";
import { ERP_PROVIDERS, type ErpConnectionView } from "@/lib/erp/providers";
import {
  disconnectErp,
  getErpActivity,
  getErpStatus,
  startErpConnect,
  syncErpConnection,
} from "@/lib/erp.functions";

export const Route = createFileRoute("/_shell/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — AutoAudit" },
      {
        name: "description",
        content:
          "Connect your real accounting and ERP accounts so AutoAudit can analyse live financial data.",
      },
      { property: "og:title", content: "Integrations — AutoAudit" },
      {
        property: "og:description",
        content:
          "Connect your real accounting and ERP accounts so AutoAudit can analyse live financial data.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    connect: typeof s["connect"] === "string" ? (s["connect"] as string) : undefined,
    message: typeof s["message"] === "string" ? (s["message"] as string) : undefined,
  }),
  component: () => (
    <PermissionGate permission="configure">
      <IntegrationsPage />
    </PermissionGate>
  ),
});

function IntegrationsPage() {
  const search = useSearch({ from: "/_shell/integrations" });
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getErpStatus);
  const fetchActivity = useServerFn(getErpActivity);
  const connectFn = useServerFn(startErpConnect);
  const syncFn = useServerFn(syncErpConnection);
  const disconnectFn = useServerFn(disconnectErp);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardProvider, setWizardProvider] = useState<string | undefined>(undefined);
  const [configOpen, setConfigOpen] = useState(false);
  const [configProvider, setConfigProvider] = useState<string | undefined>(undefined);
  const [customApiOpen, setCustomApiOpen] = useState(false);
  const [activeSync, setActiveSync] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["erp-status"],
    queryFn: () => fetchStatus({}),
  });

  const connections = (data?.connections ?? []) as ErpConnectionView[];
  const configured = data?.configured ?? [];

  const activity = useQuery({
    queryKey: ["erp-activity"],
    queryFn: () => fetchActivity({}),
    refetchInterval: (q) => (activeSync || q.state.data?.running ? 1500 : false),
  });

  const importing = !!activeSync || !!activity.data?.running;

  useEffect(() => {
    if (search.connect === "success") toast.success("Account connected — importing your data now.");
    if (search.connect === "error") toast.error(search.message ?? "Connection failed");
  }, [search.connect, search.message]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["erp-status"] });
    void qc.invalidateQueries({ queryKey: ["erp-activity"] });
    void qc.invalidateQueries({ queryKey: ["erp-financials"] });
    void qc.invalidateQueries({ queryKey: ["erp-overview"] });
  };

  const sync = useMutation({
    mutationFn: (connectionId: string) => {
      setActiveSync(connectionId);
      return syncFn({ data: { connectionId } });
    },
    onSuccess: (r) => {
      toast.success(
        `Imported ${r.invoices} invoices, ${r.payments} payments, ${r.vendors} vendors.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      setActiveSync(null);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (connectionId: string) => disconnectFn({ data: { connectionId } }),
    onSuccess: () => {
      toast.success("Account disconnected.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startConnect = async (provider: string) => {
    const { url } = await connectFn({ data: { provider } });
    window.location.href = url;
  };

  const openWizard = (provider?: string) => {
    setWizardProvider(provider);
    setWizardOpen(true);
  };

  const openConfig = (provider: string) => {
    setConfigProvider(provider);
    setConfigOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Connect your real accounting or ERP account. AutoAudit imports invoices, payments and vendors directly from the source system."
        crumbs={[{ label: "Integrations" }]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!connections.length || sync.isPending}
              onClick={() => connections.forEach((c) => sync.mutate(c.id))}
            >
              <RefreshCw className={`size-4 ${importing ? "animate-spin" : ""}`} />
              Re-sync all
            </Button>
            <Button size="sm" onClick={() => openWizard()}>
              <Plus className="size-4" /> Connect account
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        <ImportDashboard
          connections={connections}
          counts={activity.data?.counts ?? []}
          importing={importing}
          runs={activity.data?.runs ?? []}
        />

        <SyncTimeline
          runs={activity.data?.runs ?? []}
          connections={connections}
          onRetry={(id) => sync.mutate(id)}
          retryingId={activeSync}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ERP_PROVIDERS.map((p) => {
            const conn = connections.find((c) => c.provider === p.id);
            const ready = configured.includes(p.id);
            return (
              <article key={p.id} className="surface-card flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category}</p>
                  </div>
                  <StatusBadge
                    status={
                      conn ? (conn.status === "error" ? "error" : "connected") : "disconnected"
                    }
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{p.blurb}</p>

                <dl className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Account</dt>
                    <dd className="truncate">{conn?.accountName ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Last sync</dt>
                    <dd>
                      {conn?.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : "Never"}
                    </dd>
                  </div>
                </dl>

                {conn?.lastError ? (
                  <div className="mt-3 rounded-md bg-destructive/10 p-2">
                    <p className="text-xs text-destructive">{conn.lastError}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      disabled={activeSync === conn.id}
                      onClick={() => sync.mutate(conn.id)}
                    >
                      <RefreshCw
                        className={`size-3.5 ${activeSync === conn.id ? "animate-spin" : ""}`}
                      />
                      Retry failed sync
                    </Button>
                  </div>
                ) : null}

                {p.id === "custom_api" ? (
                  <p className="mt-4 rounded-md bg-primary/10 p-2 text-xs text-primary font-medium">
                    Direct HTTP POST endpoint ready. Push bills and ledgers via REST API.
                  </p>
                ) : !p.oauth ? (
                  <p className="mt-4 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                    Enterprise onboarding required — your administrator provisions this connection.
                  </p>
                ) : !ready ? (
                  <div className="mt-4 space-y-2">
                    <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                      Add your {p.name} developer app credentials to enable one-click connection.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => openConfig(p.id)}
                    >
                      <Settings className="size-3.5" /> Configure {p.name}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-xs text-muted-foreground"
                      onClick={() => openConfig(p.id)}
                    >
                      <Settings className="size-3" /> Edit credentials
                    </Button>
                  </div>
                )}

                <div className="mt-auto flex gap-2 pt-4">
                  {p.id === "custom_api" ? (
                    <>
                      <Button
                        size="sm"
                        variant={conn ? "outline" : "default"}
                        className="flex-1 text-xs gap-1.5"
                        onClick={() => setCustomApiOpen(true)}
                      >
                        <Code2 className="size-3.5" /> API Specs & Snippets
                      </Button>
                      {conn && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-destructive hover:bg-destructive/10"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(conn.id)}
                        >
                          Disconnect
                        </Button>
                      )}
                    </>
                  ) : conn ? (
                    <>
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={activeSync === conn.id}
                        onClick={() => sync.mutate(conn.id)}
                      >
                        {activeSync === conn.id ? "Syncing…" : "Sync now"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(conn.id)}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={!p.oauth || !ready || isLoading}
                      onClick={() => openWizard(p.id)}
                    >
                      Connect {p.name}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <ConnectWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        configured={configured}
        connectedProviders={connections.map((c) => c.provider)}
        onConnect={startConnect}
        initialProvider={wizardProvider}
      />

      <ProviderConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        initialProvider={configProvider}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["erp-status"] })}
      />

      <CustomApiDialog
        open={customApiOpen}
        onOpenChange={setCustomApiOpen}
        onDataIngested={invalidate}
      />
    </>
  );
}
