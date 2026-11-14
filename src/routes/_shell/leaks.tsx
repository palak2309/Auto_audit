import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  FilterX,
  Plug,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, type Column } from "@/components/common/data-table";
import { SeverityBadge, StatusBadge, ToneBadge } from "@/components/common/tone-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listDurableLeaks, listAssignableMembers } from "@/lib/leak.functions";
import { scanAndPersistLeaks, getErpStatus } from "@/lib/erp.functions";
import type { LeakStatus } from "@/lib/erp/leak-workflow.server";
import type { Tables } from "@/integrations/supabase/types";
import { currency } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { toast } from "sonner";
import { LeakActionDrawer } from "@/components/leaks/leak-action-drawer";

type LeakRow = Tables<"erp_leaks">;

export const Route = createFileRoute("/_shell/leaks")({
  head: () => ({
    meta: [
      { title: "Financial Leaks Register — AutoAudit" },
      {
        name: "description",
        content:
          "Triage and manage durable financial leak cases detected from ERP records: duplicate invoices, duplicate payments, overpayments and overdue liabilities.",
      },
      { property: "og:title", content: "Financial Leaks Register — AutoAudit" },
      {
        property: "og:description",
        content: "Operational financial leakage management with audit trails and recovery claims.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaksPage,
});

const TABS = [
  { id: "all", label: "All Types" },
  { id: "Duplicate invoice", label: "Duplicate Invoices" },
  { id: "Duplicate payment", label: "Duplicate Payments" },
  { id: "Overpayment", label: "Overpayments" },
  { id: "Overdue liability", label: "Overdue Liabilities" },
] as const;

const STATUSES: { id: LeakStatus | "all"; label: string }[] = [
  { id: "all", label: "All Statuses" },
  { id: "detected", label: "Detected" },
  { id: "investigating", label: "Investigating" },
  { id: "recovering", label: "Recovering" },
  { id: "recovered", label: "Recovered" },
  { id: "dismissed", label: "Dismissed" },
];

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

function formatMoney(amount: number, code: string) {
  if (!code) return currency(amount);
  try {
    return currency(amount, { currency: code });
  } catch {
    return `${code} ${Math.round(amount).toLocaleString()}`;
  }
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

const PAGE_SIZE = 25;

function LeaksPage() {
  const fetchDurableLeaks = useServerFn(listDurableLeaks);
  const fetchMembers = useServerFn(listAssignableMembers);
  const fetchStatus = useServerFn(getErpStatus);
  const runScan = useServerFn(scanAndPersistLeaks);

  // Connection check
  const { data: erpStatus } = useQuery({
    queryKey: ["erp-status"],
    queryFn: () => fetchStatus(),
    staleTime: 60_000,
  });

  const connected = Boolean(
    erpStatus?.connections && erpStatus.connections.some((c) => c.status === "connected"),
  );

  // Filter states
  const [tab, setTab] = useState<string>("all");
  const [status, setStatus] = useState<LeakStatus | "all">("all");
  const [severity, setSeverity] = useState<string>("all");
  const [assignee, setAssignee] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const [selectedLeakId, setSelectedLeakId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Assignable members query
  const { data: members = [] } = useQuery({
    queryKey: ["assignable-members"],
    queryFn: () => fetchMembers(),
    staleTime: 60_000,
  });

  // Durable leaks query
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: [
      "durable-leaks",
      {
        tab,
        status,
        severity,
        assignee,
        search,
        page,
      },
    ],
    queryFn: () => {
      const input: {
        limit: number;
        offset: number;
        type?: string;
        status?: LeakStatus;
        severity?: "critical" | "high" | "medium" | "low";
        assignedTo?: string;
        search?: string;
      } = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (tab !== "all") input.type = tab;
      if (status !== "all") input.status = status as LeakStatus;
      if (severity !== "all") input.severity = severity as "critical" | "high" | "medium" | "low";
      if (assignee !== "all") input.assignedTo = assignee;
      if (search.trim()) input.search = search.trim();

      return fetchDurableLeaks({ data: input });
    },
  });

  const leaks = data?.leaks ?? [];
  const total = data?.total ?? 0;
  const memberMap = data?.memberMap ?? {};
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filtersActive =
    tab !== "all" || status !== "all" || severity !== "all" || assignee !== "all" || !!search;

  const resetFilters = () => {
    setTab("all");
    setStatus("all");
    setSeverity("all");
    setAssignee("all");
    setSearch("");
    setPage(0);
  };

  const handleReanalyze = async () => {
    setIsScanning(true);
    try {
      const res = await runScan();
      toast.success(
        `Analysis complete: ${res.inserted} new leaks persisted, ${res.updated} existing records refreshed.`,
      );
      void refetch();
    } catch (err) {
      toast.error(`Re-analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleExport = () => {
    if (leaks.length === 0) return;
    downloadCsv(
      `autoaudit-leaks-${new Date().toISOString().slice(0, 10)}.csv`,
      leaks.map((l) => ({
        Type: l.type,
        Title: l.title,
        Vendor: l.vendor_name,
        Amount: l.amount,
        Currency: l.currency,
        Severity: l.severity,
        Status: l.status,
        Assignee:
          l.assigned_to && memberMap[l.assigned_to]
            ? memberMap[l.assigned_to]?.fullName
            : "Unassigned",
        "Detected Date": l.detected_at,
        Source: l.source,
      })),
    );
  };

  const columns: Column<LeakRow>[] = [
    {
      key: "finding",
      header: "Finding",
      render: (r) => (
        <div className="min-w-0 py-1">
          <p className="truncate text-sm font-semibold text-foreground">{r.title}</p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ToneBadge tone="brand" size="sm">
              {r.type}
            </ToneBadge>
            <span>·</span>
            <span>{r.vendor_name}</span>
          </div>
        </div>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      render: (r) => <SeverityBadge severity={r.severity} />,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "assignee",
      header: "Assignee",
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.assigned_to && memberMap[r.assigned_to] ? memberMap[r.assigned_to]?.fullName : "—"}
        </span>
      ),
    },
    {
      key: "detected_at",
      header: "Detected",
      render: (r) => (
        <span className="text-xs text-muted-foreground">{formatDate(r.detected_at)}</span>
      ),
    },
    {
      key: "amount",
      header: "Exposure",
      align: "right",
      render: (r) => (
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatMoney(r.amount, r.currency)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Financial leaks register"
        description={`${total} durable cases tracked across your imported ERP systems. Click any record to triage, investigate, assign, or open recovery claims.`}
        crumbs={[{ label: "Financial Leaks" }]}
        actions={
          <>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleReanalyze}
              disabled={isScanning || isFetching}
            >
              <RefreshCw className={`size-4 ${isScanning || isFetching ? "animate-spin" : ""}`} />
              Re-analyze ERP Data
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={leaks.length === 0}
              onClick={handleExport}
            >
              <Download className="size-4" /> Export Register
            </Button>
          </>
        }
      />

      {!isLoading && !connected && total === 0 ? (
        <section className="surface-card flex flex-col items-center gap-3 p-10 text-center">
          <Plug className="size-6 text-primary" />
          <h2 className="text-base font-semibold">No connected ERP systems</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Connect Zoho Books, Xero, or QuickBooks to sync transactions and run automated leak
            detection into your durable register.
          </p>
          <Button asChild className="mt-2">
            <Link to="/integrations" search={{ connect: undefined, message: undefined }}>
              Go to Integrations
            </Link>
          </Button>
        </section>
      ) : (
        <>
          {/* Category Tabs */}
          <Tabs
            value={tab}
            onValueChange={(val) => {
              setTab(val);
              setPage(0);
            }}
          >
            <TabsList className="flex-wrap">
              {TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="text-xs">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Filter Bar */}
          <section className="surface-card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Status Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs">Workflow Status</Label>
              <Select
                value={status}
                onValueChange={(val) => {
                  setStatus(val as LeakStatus | "all");
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs capitalize">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Severity Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs">Severity</Label>
              <Select
                value={severity}
                onValueChange={(val) => {
                  setSeverity(val);
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Severities
                  </SelectItem>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignee Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs">Assignee</Label>
              <Select
                value={assignee}
                onValueChange={(val) => {
                  setAssignee(val);
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Assignees
                  </SelectItem>
                  <SelectItem value="unassigned" className="text-xs">
                    Unassigned
                  </SelectItem>
                  {members.map((m: { id: string; fullName: string }) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Input */}
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-xs">Search</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search vendor, title, category…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                    className="h-9 pl-8 text-xs"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={resetFilters}
                  disabled={!filtersActive}
                  aria-label="Clear filters"
                >
                  <FilterX className="size-4" />
                </Button>
              </div>
            </div>
          </section>

          {/* Data Table */}
          <DataTable
            data={leaks}
            columns={columns}
            loading={isLoading}
            rowKey={(r) => r.id}
            onRowClick={(r) => setSelectedLeakId(r.id)}
            emptyTitle="No durable leak cases match your filters"
            emptyDescription="Try selecting a different status, severity, or run a fresh scan of your connected ERP records."
          />

          {/* Server-Side Pagination Controls */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}
                </span>{" "}
                of <span className="font-semibold text-foreground">{total}</span> findings
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || isFetching}
                  className="h-8 gap-1 text-xs"
                >
                  <ChevronLeft className="size-3.5" /> Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {Math.max(1, totalPages)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1 || isFetching}
                  className="h-8 gap-1 text-xs"
                >
                  Next <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Action Drawer */}
      <LeakActionDrawer
        leakId={selectedLeakId}
        open={Boolean(selectedLeakId)}
        onOpenChange={(open) => {
          if (!open) setSelectedLeakId(null);
        }}
        onMutated={() => void refetch()}
      />
    </>
  );
}
