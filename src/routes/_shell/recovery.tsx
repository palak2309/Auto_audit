import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Columns3,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FilterX,
  Kanban,
  LayoutGrid,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/common/permission-gate";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge, ToneBadge } from "@/components/common/tone-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  listRecoveryCases,
  updateRecoveryCase,
  listDurableLeaks,
  openRecoveryCase,
  generateRecoveryClaimNotice,
} from "@/lib/leak.functions";
import type {
  DurableRecoveryCaseItem,
  RecoveryStage,
} from "@/lib/erp/leak-workflow.server";
import { currency } from "@/lib/format";
import { LeakActionDrawer } from "@/components/leaks/leak-action-drawer";
import { useMockAuth } from "@/providers/mock-auth-provider";

export const Route = createFileRoute("/_shell/recovery")({
  head: () => ({
    meta: [
      { title: "Recovery Center — AutoAudit" },
      {
        name: "description",
        content:
          "Track and progress durable recovery claims from initial vendor contact through credit issued and cash returned.",
      },
      { property: "og:title", content: "Recovery Center — AutoAudit" },
      {
        property: "og:description",
        content:
          "Operational recovery case management with stage progression and audit integrity.",
      },
    ],
  }),
  component: () => (
    <PermissionGate permission="recover">
      <RecoveryPage />
    </PermissionGate>
  ),
});

const PIPELINE_COLUMNS: { id: RecoveryStage; label: string; tone: "info" | "warning" | "caution" | "accent" | "success"; description: string }[] = [
  { id: "identified", label: "Identified", tone: "info", description: "Audit anomaly confirmed; claim initialized" },
  { id: "vendor_contacted", label: "Vendor Contacted", tone: "warning", description: "Dispute notice dispatched to supplier" },
  { id: "claim_filed", label: "Claim Filed", tone: "caution", description: "Formal recovery docket opened with AP/AR" },
  { id: "credit_issued", label: "Credit Issued", tone: "accent", description: "Vendor credit note or remittance advice pending" },
  { id: "recovered", label: "Recovered", tone: "success", description: "Cash refunded or credit applied in ledger" },
];

const STAGES: { id: RecoveryStage | "all"; label: string }[] = [
  { id: "all", label: "All Stages" },
  { id: "identified", label: "Identified" },
  { id: "vendor_contacted", label: "Vendor Contacted" },
  { id: "claim_filed", label: "Claim Filed" },
  { id: "credit_issued", label: "Credit Issued" },
  { id: "recovered", label: "Recovered" },
];

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

// Server state machine: valid next stages
function getNextAllowedStages(current: RecoveryStage): RecoveryStage[] {
  switch (current) {
    case "identified":
      return ["vendor_contacted", "claim_filed"];
    case "vendor_contacted":
      return ["claim_filed", "credit_issued", "recovered"];
    case "claim_filed":
      return ["credit_issued", "recovered"];
    case "credit_issued":
      return ["recovered"];
    case "recovered":
      return [];
    default:
      return [];
  }
}

function RecoveryPage() {
  const queryClient = useQueryClient();
  const { can } = useMockAuth();

  const fetchCases = useServerFn(listRecoveryCases);
  const mutateRecovery = useServerFn(updateRecoveryCase);
  const fetchLeaks = useServerFn(listDurableLeaks);
  const mutateOpenClaim = useServerFn(openRecoveryCase);
  const callGenerateNotice = useServerFn(generateRecoveryClaimNotice);

  // Main UI State
  const [activeTab, setActiveTab] = useState<"pipeline" | "unclaimed">("pipeline");
  const [viewMode, setViewMode] = useState<"kanban" | "grid">("kanban");
  const [stageFilter, setStageFilter] = useState<RecoveryStage | "all">("all");
  const [search, setSearch] = useState<string>("");
  const [selectedCase, setSelectedCase] = useState<DurableRecoveryCaseItem | null>(null);
  const [selectedLeakId, setSelectedLeakId] = useState<string | null>(null);

  // Stage update modal
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [targetStage, setTargetStage] = useState<RecoveryStage | "">("");
  const [recoveredAmountInput, setRecoveredAmountInput] = useState<string>("");
  const [notesInput, setNotesInput] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // AI Notice Modal
  const [aiNoticeDialogOpen, setAiNoticeDialogOpen] = useState(false);
  const [noticeCase, setNoticeCase] = useState<DurableRecoveryCaseItem | null>(null);
  const [noticeTone, setNoticeTone] = useState<"formal" | "firm" | "collaborative">("formal");
  const [noticeCustomNotes, setNoticeCustomNotes] = useState("");
  const [noticeLoading, setNoticeLoading] = useState(false);
  const [generatedNotice, setGeneratedNotice] = useState<{
    subject: string;
    letter: string;
    recipientEmail?: string | null | undefined;
  } | null>(null);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedLetter, setCopiedLetter] = useState(false);

  // Fast Claim Intake Modal
  const [intakeModalOpen, setIntakeModalOpen] = useState(false);
  const [selectedUnclaimedLeak, setSelectedUnclaimedLeak] = useState<any | null>(null);
  const [claimRefInput, setClaimRefInput] = useState("");
  const [targetClaimAmount, setTargetClaimAmount] = useState("");
  const [claimNotesInput, setClaimNotesInput] = useState("");
  const [isIntaking, setIsIntaking] = useState(false);

  // Fetch active recovery cases
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["recovery-cases", { stage: stageFilter, search }],
    queryFn: () => {
      const input: {
        stage?: RecoveryStage;
        search?: string;
      } = {};
      if (stageFilter !== "all") input.stage = stageFilter as RecoveryStage;
      if (search.trim()) input.search = search.trim();

      return fetchCases({ data: input });
    },
  });

  // Fetch unclaimed leaks for the Intake tab
  const { data: leaksData, isLoading: isLoadingLeaks, refetch: refetchLeaks } = useQuery({
    queryKey: ["unclaimed-leaks-for-recovery"],
    queryFn: () => fetchLeaks({ data: { limit: 100 } }),
  });

  const cases = data?.cases ?? [];
  const total = data?.total ?? 0;

  // Filter out leaks that are already in active recovery or recovered
  const allLeaks = leaksData?.leaks ?? [];
  const activeLeakIds = new Set(cases.map((c: DurableRecoveryCaseItem) => c.leakId));
  const unclaimedLeaks = allLeaks.filter(
    (l) =>
      (l.status === "detected" || l.status === "investigating") &&
      !activeLeakIds.has(l.id) &&
      Number(l.amount) > 0,
  );

  // Key summaries
  const totalTarget = cases.reduce((acc: number, c: DurableRecoveryCaseItem) => acc + c.targetAmount, 0);
  const totalRecovered = cases.reduce((acc: number, c: DurableRecoveryCaseItem) => acc + c.recoveredAmount, 0);
  const totalRemaining = Math.max(0, totalTarget - totalRecovered);
  const recoveryRate = totalTarget > 0 ? Math.round((totalRecovered / totalTarget) * 100) : 0;
  const activeCasesCount = cases.filter((c: DurableRecoveryCaseItem) => c.stage !== "recovered").length;

  // Handlers
  const handleOpenUpdateDialog = (recCase: DurableRecoveryCaseItem) => {
    setSelectedCase(recCase);
    const nexts = getNextAllowedStages(recCase.stage);
    setTargetStage(nexts[0] ?? "");
    setRecoveredAmountInput(String(recCase.recoveredAmount || ""));
    setNotesInput("");
    setUpdateDialogOpen(true);
  };

  const handleProgressStage = async () => {
    if (!selectedCase || !targetStage) return;
    setIsUpdating(true);
    try {
      const updatePayload: {
        recoveryCaseId: string;
        stage?: RecoveryStage;
        recoveredAmount?: number;
        notes?: string;
      } = {
        recoveryCaseId: selectedCase.id,
        stage: targetStage as RecoveryStage,
      };
      const recAmt = recoveredAmountInput ? parseFloat(recoveredAmountInput) : undefined;
      if (recAmt !== undefined && !isNaN(recAmt)) updatePayload.recoveredAmount = recAmt;
      if (notesInput.trim()) updatePayload.notes = notesInput.trim();

      await mutateRecovery({
        data: updatePayload,
      });

      if (targetStage === "recovered") {
        toast.success("Recovery marked complete. Parent leak case has been automatically resolved.");
      } else {
        toast.success(`Recovery case progressed to ${targetStage.replace(/_/g, " ")}.`);
      }

      setUpdateDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["recovery-cases"] });
      void queryClient.invalidateQueries({ queryKey: ["durable-leaks"] });
      void queryClient.invalidateQueries({ queryKey: ["durable-metrics"] });
      void queryClient.invalidateQueries({ queryKey: ["erp", "overview"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Concurrency conflict")) {
        toast.error("This recovery case was updated by another user. Reloading latest state.");
        void refetch();
      } else {
        toast.error(`Failed to update recovery stage: ${msg}`);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // AI Notice Generator Handlers
  const handleOpenAiNoticeDialog = async (c: DurableRecoveryCaseItem) => {
    setNoticeCase(c);
    setGeneratedNotice(null);
    setNoticeCustomNotes("");
    setNoticeTone("formal");
    setAiNoticeDialogOpen(true);
    await triggerGenerateNotice(c, "formal", "");
  };

  const triggerGenerateNotice = async (
    c: DurableRecoveryCaseItem,
    tone: "formal" | "firm" | "collaborative",
    notes?: string,
  ) => {
    setNoticeLoading(true);
    try {
      const res = await callGenerateNotice({
        data: {
          recoveryCaseId: c.id,
          tone,
          customNotes: notes?.trim() || undefined,
        },
      });
      setGeneratedNotice({
        subject: res.subject,
        letter: res.letter,
        recipientEmail: res.recipientEmail,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to generate claim notice: ${msg}`);
    } finally {
      setNoticeLoading(false);
    }
  };

  // Open Claim from Unclaimed Leak Handlers
  const handleOpenIntakeModal = (leak: any) => {
    setSelectedUnclaimedLeak(leak);
    const sanitizedVendor = (leak.vendor_name || "VND").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setClaimRefInput(`CLM-${sanitizedVendor}-${randomSuffix}`);
    setTargetClaimAmount(String(leak.amount || 0));
    setClaimNotesInput(`Initiated from ${leak.type} detection in ERP audit.`);
    setIntakeModalOpen(true);
  };

  const handleConfirmIntake = async () => {
    if (!selectedUnclaimedLeak) return;
    setIsIntaking(true);
    try {
      const amt = parseFloat(targetClaimAmount);
      await mutateOpenClaim({
        data: {
          leakId: selectedUnclaimedLeak.id,
          claimReference: claimRefInput.trim() || undefined,
          targetAmount: !isNaN(amt) && amt > 0 ? amt : undefined,
          notes: claimNotesInput.trim() || undefined,
        },
      });

      toast.success(`Recovery claim opened for ${selectedUnclaimedLeak.vendor_name}.`);
      setIntakeModalOpen(false);
      setActiveTab("pipeline");
      void queryClient.invalidateQueries({ queryKey: ["recovery-cases"] });
      void queryClient.invalidateQueries({ queryKey: ["unclaimed-leaks-for-recovery"] });
      void queryClient.invalidateQueries({ queryKey: ["durable-leaks"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to open claim: ${msg}`);
    } finally {
      setIsIntaking(false);
    }
  };

  // CSV Export Handler
  const handleExportCsv = () => {
    if (cases.length === 0) {
      toast.error("No recovery cases available to export.");
      return;
    }
    const headers = [
      "Claim Reference",
      "Vendor",
      "Leak Title",
      "Stage",
      "Target Amount",
      "Recovered Amount",
      "Currency",
      "Progress %",
      "Owner",
      "Opened Date",
      "Closed Date",
    ];
    const rows = cases.map((c: DurableRecoveryCaseItem) => [
      `"${c.claimReference || c.id}"`,
      `"${(c.vendorName || "").replace(/"/g, '""')}"`,
      `"${(c.leakTitle || "").replace(/"/g, '""')}"`,
      `"${c.stage}"`,
      c.targetAmount,
      c.recoveredAmount,
      `"${c.currency || "USD"}"`,
      c.progress,
      `"${(c.ownerName || "Unassigned").replace(/"/g, '""')}"`,
      `"${c.openedAt || ""}"`,
      `"${c.closedAt || ""}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `autoaudit-recovery-claims-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${cases.length} recovery claims to CSV.`);
  };

  return (
    <>
      <PageHeader
        title="Recovery Center"
        description="Operational financial recovery management. Track claims from identification through credit issued and verified cash returned."
        crumbs={[{ label: "Recovery Center" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={handleExportCsv}
              disabled={cases.length === 0}
            >
              <FileSpreadsheet className="size-4" /> Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={() => {
                void refetch();
                void refetchLeaks();
              }}
              disabled={isFetching || isLoadingLeaks}
            >
              <RefreshCw className={`size-4 ${isFetching || isLoadingLeaks ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        }
      />

      {/* Metric Cards Summary */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface-card p-4 transition-all hover:border-primary/40">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Target Exposure</span>
            <ShieldAlert className="size-4 text-warning" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
            {currency(totalTarget)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{total} total recovery cases</p>
        </div>

        <div className="surface-card p-4 transition-all hover:border-success/40">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Cash Recovered</span>
            <CheckCircle2 className="size-4 text-success" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-success">
            {currency(totalRecovered)}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-semibold text-success">{recoveryRate}%</span> recovered to date
          </div>
        </div>

        <div className="surface-card p-4 transition-all hover:border-warning/40">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Outstanding Balance</span>
            <TrendingUp className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-warning">
            {currency(totalRemaining)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Actively in negotiation / disputed</p>
        </div>

        <div className="surface-card p-4 transition-all hover:border-accent/40">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Unclaimed Opportunities</span>
            <Sparkles className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
            {unclaimedLeaks.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {unclaimedLeaks.length > 0 ? "Leaks ready to open recovery" : "All leaks currently assigned"}
          </p>
        </div>
      </section>

      {/* Main Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "pipeline" | "unclaimed")}
        className="space-y-4"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <TabsList className="h-9">
            <TabsTrigger value="pipeline" className="gap-2 text-xs">
              <Kanban className="size-3.5" />
              Active Pipeline
              <span className="rounded-full bg-muted-foreground/15 px-1.5 py-0.2 text-[10px] font-bold">
                {cases.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="unclaimed" className="gap-2 text-xs">
              <Sparkles className="size-3.5 text-primary" />
              Unclaimed Opportunities
              {unclaimedLeaks.length > 0 && (
                <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-bold">
                  {unclaimedLeaks.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {activeTab === "pipeline" && (
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-[11px] font-medium text-muted-foreground mr-1">View:</span>
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() => setViewMode("kanban")}
              >
                <Columns3 className="size-3.5" /> Pipeline Board
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="size-3.5" /> Detailed Cards
              </Button>
            </div>
          )}
        </div>

        {/* TAB 1: ACTIVE CLAIMS PIPELINE */}
        <TabsContent value="pipeline" className="space-y-4 m-0">
          {/* Filter and Search Bar */}
          <section className="surface-card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Stage Filter</Label>
              <Select
                value={stageFilter}
                onValueChange={(val) => setStageFilter(val as RecoveryStage | "all")}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs capitalize">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 lg:col-span-3">
              <Label className="text-xs">Search Recovery Claims</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by vendor, claim reference, finding title or owner…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 pl-8 text-xs"
                  />
                </div>
                {(stageFilter !== "all" || !!search) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0"
                    onClick={() => {
                      setStageFilter("all");
                      setSearch("");
                    }}
                    aria-label="Clear filters"
                  >
                    <FilterX className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </section>

          {/* Loading or Empty State */}
          {isLoading ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs text-muted-foreground">Loading durable recovery claims…</p>
              </div>
            </div>
          ) : cases.length === 0 ? (
            <section className="surface-card flex flex-col items-center gap-3 p-12 text-center">
              <ShieldCheck className="size-10 text-muted-foreground" />
              <h3 className="text-base font-semibold">No recovery claims found</h3>
              <p className="max-w-md text-xs text-muted-foreground">
                {stageFilter !== "all" || search
                  ? "No cases match the selected stage filter or search criteria."
                  : "Recovery claims are created from audit findings when an anomalous transaction enters active vendor negotiation."}
              </p>
              {unclaimedLeaks.length > 0 && (
                <Button
                  size="sm"
                  className="mt-2 gap-1.5 text-xs"
                  onClick={() => setActiveTab("unclaimed")}
                >
                  <Sparkles className="size-3.5" /> View {unclaimedLeaks.length} Unclaimed Leak Opportunities
                </Button>
              )}
            </section>
          ) : viewMode === "kanban" ? (
            /* KANBAN PIPELINE BOARD */
            <div className="grid grid-cols-1 gap-4 overflow-x-auto pb-4 md:grid-cols-2 lg:grid-cols-5">
              {PIPELINE_COLUMNS.map((col) => {
                const colCases = cases.filter((c: DurableRecoveryCaseItem) => c.stage === col.id);
                const colTotal = colCases.reduce((sum: number, c: DurableRecoveryCaseItem) => sum + c.targetAmount, 0);

                return (
                  <div
                    key={col.id}
                    className="flex flex-col rounded-xl border border-border bg-muted/20 p-3 min-w-[260px]"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{col.label}</span>
                        <span className="rounded-full bg-background border px-1.5 py-0.2 text-[10px] font-bold text-muted-foreground">
                          {colCases.length}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold tabular-nums text-foreground/80">
                        {currency(colTotal)}
                      </span>
                    </div>

                    {/* Column Cards */}
                    <div className="mt-3 flex flex-1 flex-col gap-3">
                      {colCases.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/80 p-6 text-center text-[11px] text-muted-foreground">
                          No claims in {col.label.toLowerCase()}
                        </div>
                      ) : (
                        colCases.map((c: DurableRecoveryCaseItem) => {
                          const nextStages = getNextAllowedStages(c.stage);
                          const isTerminal = c.stage === "recovered";

                          return (
                            <div
                              key={c.id}
                              className="surface-card group relative flex flex-col justify-between p-3.5 shadow-sm transition-all hover:shadow-md hover:border-primary/40"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-1">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                                    {c.claimReference || `CASE-${c.id.slice(0, 6)}`}
                                  </span>
                                  <StatusBadge status={c.stage} />
                                </div>

                                <h5 className="mt-1 font-bold text-xs text-foreground truncate" title={c.vendorName}>
                                  {c.vendorName}
                                </h5>
                                <p className="text-[11px] text-muted-foreground line-clamp-1 truncate" title={c.leakTitle}>
                                  {c.leakTitle}
                                </p>

                                <div className="mt-2.5 flex items-baseline justify-between rounded-lg bg-muted/30 p-2 text-xs">
                                  <div>
                                    <span className="block text-[9px] uppercase text-muted-foreground">Target</span>
                                    <span className="font-bold tabular-nums">
                                      {formatMoney(c.targetAmount, c.currency)}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="block text-[9px] uppercase text-muted-foreground">Recovered</span>
                                    <span className="font-bold tabular-nums text-success">
                                      {formatMoney(c.recoveredAmount, c.currency)}
                                    </span>
                                  </div>
                                </div>

                                {/* Progress */}
                                <div className="mt-2 space-y-1">
                                  <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>Recovered</span>
                                    <span className="font-bold tabular-nums">{c.progress}%</span>
                                  </div>
                                  <Progress value={c.progress} className="h-1" />
                                </div>
                              </div>

                              {/* Card Action Footer */}
                              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-[10px] text-primary hover:text-primary gap-1"
                                  onClick={() => handleOpenAiNoticeDialog(c)}
                                  title="Generate AI Vendor Dispute Notice"
                                >
                                  <Sparkles className="size-3" /> AI Notice
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-[10px] gap-1"
                                  onClick={() => setSelectedLeakId(c.leakId)}
                                  title="View Evidence & Invoices"
                                >
                                  <ExternalLink className="size-3" /> Details
                                </Button>

                                {!isTerminal && can("recover") && nextStages.length > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="ml-auto h-7 px-2 text-[10px] font-semibold gap-1 text-foreground"
                                    onClick={() => handleOpenUpdateDialog(c)}
                                  >
                                    Progress <ArrowRight className="size-2.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* DETAILED CARDS GRID */
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {cases.map((c: DurableRecoveryCaseItem) => {
                const nextStages = getNextAllowedStages(c.stage);
                const isTerminal = c.stage === "recovered";

                return (
                  <article
                    key={c.id}
                    className="surface-card flex flex-col justify-between p-5 transition-shadow hover:shadow-lifted"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {c.claimReference || `CASE-${c.id.slice(0, 8)}`}
                          </span>
                          <h4 className="truncate text-base font-bold text-foreground">
                            {c.vendorName}
                          </h4>
                          <p className="truncate text-xs text-muted-foreground">{c.leakTitle}</p>
                        </div>
                        <StatusBadge status={c.stage} />
                      </div>

                      {/* Financial Targets */}
                      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/20 p-3 text-xs">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Target Claim
                          </span>
                          <p className="text-lg font-bold tabular-nums">
                            {formatMoney(c.targetAmount, c.currency)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Recovered
                          </span>
                          <p className="text-lg font-bold tabular-nums text-success">
                            {formatMoney(c.recoveredAmount, c.currency)}
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>Progress</span>
                          <span className="font-semibold tabular-nums">{c.progress}%</span>
                        </div>
                        <Progress value={c.progress} className="h-1.5" />
                      </div>

                      {/* Meta details */}
                      <div className="mt-4 space-y-1 text-[11px] text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Owner:</span>
                          <span className="font-medium text-foreground">{c.ownerName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Opened:</span>
                          <span>{formatDate(c.openedAt)}</span>
                        </div>
                        {c.closedAt && (
                          <div className="flex justify-between">
                            <span>Closed:</span>
                            <span>{formatDate(c.closedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs text-primary"
                        onClick={() => handleOpenAiNoticeDialog(c)}
                      >
                        <Sparkles className="size-3.5" /> AI Dispute Notice
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setSelectedLeakId(c.leakId)}
                      >
                        Details
                      </Button>

                      {!isTerminal && can("recover") && nextStages.length > 0 && (
                        <Button
                          size="sm"
                          className="ml-auto gap-1 text-xs"
                          onClick={() => handleOpenUpdateDialog(c)}
                        >
                          Progress <ArrowRight className="size-3" />
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: UNCLAIMED LEAK OPPORTUNITIES */}
        <TabsContent value="unclaimed" className="space-y-4 m-0">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="size-4 text-primary" /> Unclaimed Audit Opportunities
              </h4>
              <p className="text-xs text-muted-foreground">
                These anomalous disbursements were identified by AutoAudit rule & AI scans, but do not yet have a recovery case opened.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-background border text-primary">
              {unclaimedLeaks.length} Actionable Opportunities
            </span>
          </div>

          {isLoadingLeaks ? (
            <div className="flex min-h-[25vh] items-center justify-center">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : unclaimedLeaks.length === 0 ? (
            <section className="surface-card flex flex-col items-center gap-3 p-12 text-center">
              <ShieldCheck className="size-10 text-success" />
              <h3 className="text-base font-semibold">All Leaks Are Active</h3>
              <p className="max-w-md text-xs text-muted-foreground">
                Great work! Every detected anomaly in your financial ledger is already assigned to a recovery docket or resolved.
              </p>
            </section>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {unclaimedLeaks.map((leak: any) => (
                <div
                  key={leak.id}
                  className="surface-card flex flex-col justify-between p-4 transition-all hover:border-primary/50"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <ToneBadge tone={leak.severity === "critical" ? "danger" : leak.severity === "high" ? "warning" : "accent"}>
                        {leak.severity.toUpperCase()}
                      </ToneBadge>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(leak.detected_at)}
                      </span>
                    </div>

                    <h4 className="mt-2.5 font-bold text-sm text-foreground truncate">
                      {leak.vendor_name || "Unknown Vendor"}
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {leak.title}
                    </p>

                    <div className="mt-3 rounded-lg bg-muted/30 p-2.5 flex items-baseline justify-between">
                      <span className="text-[11px] text-muted-foreground">Disputed Exposure:</span>
                      <span className="text-base font-bold tabular-nums text-foreground">
                        {formatMoney(Number(leak.amount) || 0, leak.currency || "USD")}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2 border-t border-border pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setSelectedLeakId(leak.id)}
                    >
                      Inspect
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 gap-1 text-xs"
                      onClick={() => handleOpenIntakeModal(leak)}
                    >
                      <Plus className="size-3.5" /> Start Recovery Claim
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* AI VENDOR DISPUTE NOTICE DIALOG */}
      <Dialog open={aiNoticeDialogOpen} onOpenChange={setAiNoticeDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> AI Vendor Recovery Notice
            </DialogTitle>
            <DialogDescription>
              Draft an executive, evidence-backed demand letter for {noticeCase?.vendorName} powered by Google Gemini.
            </DialogDescription>
          </DialogHeader>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 border-y border-border py-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-muted-foreground">Tone:</span>
              <Select
                value={noticeTone}
                onValueChange={(val) => {
                  const newTone = val as "formal" | "firm" | "collaborative";
                  setNoticeTone(newTone);
                  if (noticeCase) void triggerGenerateNotice(noticeCase, newTone, noticeCustomNotes);
                }}
              >
                <SelectTrigger className="h-7 text-xs w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collaborative" className="text-xs">Collaborative (Partner)</SelectItem>
                  <SelectItem value="formal" className="text-xs">Formal (Audit Standard)</SelectItem>
                  <SelectItem value="firm" className="text-xs">Firm / Legal (7-Day Term)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {generatedNotice?.recipientEmail && (
              <div className="flex items-center gap-1 text-muted-foreground ml-auto">
                <Mail className="size-3 text-primary" />
                <span className="font-medium text-foreground">{generatedNotice.recipientEmail}</span>
              </div>
            )}
          </div>

          {/* Letter Body or Loading */}
          <div className="flex-1 overflow-y-auto space-y-3 py-2">
            {noticeLoading ? (
              <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-center">
                <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs text-muted-foreground">
                  Analyzing audit transactions and drafting claim letter with Gemini 2.5 Flash…
                </p>
              </div>
            ) : generatedNotice ? (
              <>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Subject Line</Label>
                  <div className="flex gap-2">
                    <Input
                      value={generatedNotice.subject}
                      readOnly
                      className="text-xs font-semibold bg-muted/30"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs shrink-0"
                      onClick={() => {
                        void navigator.clipboard.writeText(generatedNotice.subject);
                        setCopiedSubject(true);
                        setTimeout(() => setCopiedSubject(false), 2000);
                        toast.success("Subject copied!");
                      }}
                    >
                      {copiedSubject ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Dispute Notice Body</Label>
                  <Textarea
                    value={generatedNotice.letter}
                    readOnly
                    rows={12}
                    className="font-mono text-xs leading-relaxed bg-muted/20"
                  />
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs mr-auto"
              onClick={() => {
                if (noticeCase) void triggerGenerateNotice(noticeCase, noticeTone, noticeCustomNotes);
              }}
              disabled={noticeLoading}
            >
              <RefreshCw className={`size-3.5 ${noticeLoading ? "animate-spin" : ""}`} /> Regenerate
            </Button>

            {generatedNotice && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => {
                    const text = `Subject: ${generatedNotice.subject}\n\n${generatedNotice.letter}`;
                    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `claim-notice-${noticeCase?.claimReference || "notice"}.txt`;
                    link.click();
                    URL.revokeObjectURL(url);
                    toast.success("Notice downloaded as text.");
                  }}
                >
                  <Download className="size-3.5" /> Download (.txt)
                </Button>

                {generatedNotice.recipientEmail && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => {
                      const mailto = `mailto:${encodeURIComponent(generatedNotice.recipientEmail!)}?subject=${encodeURIComponent(generatedNotice.subject)}&body=${encodeURIComponent(generatedNotice.letter)}`;
                      window.open(mailto, "_blank");
                    }}
                  >
                    <Mail className="size-3.5" /> Open in Mail Client
                  </Button>
                )}

                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    const fullText = `Subject: ${generatedNotice.subject}\n\n${generatedNotice.letter}`;
                    void navigator.clipboard.writeText(fullText);
                    setCopiedLetter(true);
                    setTimeout(() => setCopiedLetter(false), 2000);
                    toast.success("Full notice copied to clipboard!");
                  }}
                >
                  {copiedLetter ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                  Copy Full Letter
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FAST CLAIM INTAKE MODAL */}
      <Dialog open={intakeModalOpen} onOpenChange={setIntakeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Initiate Durable Recovery Claim</DialogTitle>
            <DialogDescription>
              Open a tracked recovery docket for {selectedUnclaimedLeak?.vendor_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Claim Reference</Label>
              <Input
                value={claimRefInput}
                onChange={(e) => setClaimRefInput(e.target.value)}
                placeholder="e.g. CLM-ACME-102"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Target Claim Amount ({selectedUnclaimedLeak?.currency || "USD"})</Label>
              <Input
                type="number"
                step="0.01"
                value={targetClaimAmount}
                onChange={(e) => setTargetClaimAmount(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Initial Recovery Notes</Label>
              <Textarea
                value={claimNotesInput}
                onChange={(e) => setClaimNotesInput(e.target.value)}
                placeholder="Action items, contact person, or dispute summary…"
                className="text-xs"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIntakeModalOpen(false)}
              disabled={isIntaking}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmIntake}
              disabled={isIntaking || !claimRefInput.trim()}
            >
              {isIntaking ? "Opening Claim…" : "Open Recovery Claim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STAGE PROGRESSION DIALOG */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Progress Recovery Stage</DialogTitle>
            <DialogDescription>
              {selectedCase?.vendorName} · Case {selectedCase?.claimReference || selectedCase?.id}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Next Stage</Label>
              <Select
                value={targetStage}
                onValueChange={(val) => setTargetStage(val as RecoveryStage)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select target stage" />
                </SelectTrigger>
                <SelectContent>
                  {selectedCase &&
                    getNextAllowedStages(selectedCase.stage).map((stg) => (
                      <SelectItem key={stg} value={stg} className="text-xs capitalize">
                        {stg.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {targetStage === "recovered" && (
                <p className="text-[11px] text-success font-medium">
                  ✓ Moving to "Recovered" will automatically mark the parent audit leak as fully resolved.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rec-recovered-amount" className="text-xs">
                Total Cash Recovered to Date ({selectedCase?.currency || "USD"})
              </Label>
              <Input
                id="rec-recovered-amount"
                type="number"
                step="0.01"
                placeholder={String(selectedCase?.targetAmount || 0)}
                value={recoveredAmountInput}
                onChange={(e) => setRecoveredAmountInput(e.target.value)}
                className="text-xs"
              />
              {selectedCase && recoveredAmountInput && (
                <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                  <span>Target: {formatMoney(selectedCase.targetAmount, selectedCase.currency)}</span>
                  <span className="font-semibold text-foreground">
                    Remaining: {formatMoney(Math.max(0, selectedCase.targetAmount - (parseFloat(recoveredAmountInput) || 0)), selectedCase.currency)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rec-progress-notes" className="text-xs">
                Stage Transition Note
              </Label>
              <Textarea
                id="rec-progress-notes"
                placeholder="e.g. Vendor accepted dispute claim and issued credit note…"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                className="text-xs"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUpdateDialogOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleProgressStage}
              disabled={isUpdating || !targetStage}
            >
              {isUpdating ? "Updating…" : "Confirm Progress"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leak Action Drawer connected to recovery case view */}
      <LeakActionDrawer
        leakId={selectedLeakId}
        open={Boolean(selectedLeakId)}
        onOpenChange={(open) => {
          if (!open) setSelectedLeakId(null);
        }}
        onMutated={() => {
          void refetch();
          void refetchLeaks();
        }}
      />
    </>
  );
}
