import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileCheck,
  FileText,
  History,
  MessageSquare,
  Send,
  ShieldCheck,
  TrendingDown,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getLeakDetails,
  updateLeakStatus,
  assignLeak,
  addLeakNote,
  openRecoveryCase,
  updateRecoveryCase,
  listAssignableMembers,
} from "@/lib/leak.functions";
import type { LeakStatus, RecoveryStage } from "@/lib/erp/leak-workflow.server";
import { SeverityBadge, StatusBadge, ToneBadge } from "@/components/common/tone-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { currency } from "@/lib/format";
import { useMockAuth } from "@/providers/mock-auth-provider";

interface LeakActionDrawerProps {
  leakId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMutated?: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  invoice_number: "Invoice #",
  external_id: "External ID",
  vendor_name: "Vendor",
  issue_date: "Issued",
  due_date: "Due",
  paid_date: "Paid",
  amount: "Amount",
  amount_paid: "Amount paid",
  tax_amount: "Tax",
  invoice_external_id: "Invoice ref",
  currency: "Currency",
  status: "Status",
  method: "Method",
  reference: "Reference",
  name: "Name",
  email: "Email",
  phone: "Phone",
};

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
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function EvidenceTable({
  title,
  rows,
  fields,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  fields: string[];
}) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title} ({rows.length})
      </h5>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              {fields.map((f) => (
                <th
                  key={f}
                  className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground"
                >
                  {FIELD_LABELS[f] ?? f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={String(r["id"] ?? r["external_id"] ?? idx)}
                className="border-t border-border transition-colors hover:bg-muted/30"
              >
                {fields.map((f) => (
                  <td key={f} className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {r[f] === null || r[f] === undefined || r[f] === "" ? "—" : String(r[f])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LeakActionDrawer({ leakId, open, onOpenChange, onMutated }: LeakActionDrawerProps) {
  const queryClient = useQueryClient();
  const { can } = useMockAuth();

  // Server functions
  const fetchDetails = useServerFn(getLeakDetails);
  const fetchMembers = useServerFn(listAssignableMembers);
  const mutateStatus = useServerFn(updateLeakStatus);
  const mutateAssign = useServerFn(assignLeak);
  const mutateNote = useServerFn(addLeakNote);
  const mutateOpenRecovery = useServerFn(openRecoveryCase);
  const mutateUpdateRecovery = useServerFn(updateRecoveryCase);

  // Queries
  const {
    data: details,
    isLoading: detailsLoading,
    error: detailsError,
    refetch: refetchDetails,
  } = useQuery({
    queryKey: ["leak-details", leakId],
    queryFn: () => fetchDetails({ data: { leakId: leakId! } }),
    enabled: Boolean(open && leakId),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["assignable-members"],
    queryFn: () => fetchMembers(),
    enabled: open,
    staleTime: 60_000,
  });

  // Local state
  const [activeTab, setActiveTab] = useState<string>("investigation");
  const [noteText, setNoteText] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isMutatingStatus, setIsMutatingStatus] = useState(false);

  // Dialog states
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [recoveryDialogOpen, setRecoveryDialogOpen] = useState(false);
  const [recoveryTarget, setRecoveryTarget] = useState<string>("");
  const [recoveryClaimRef, setRecoveryClaimRef] = useState("");
  const [recoveryNotes, setRecoveryNotes] = useState("");
  const [isOpeningRecovery, setIsOpeningRecovery] = useState(false);

  // Recovery update dialog
  const [updateRecoveryDialogOpen, setUpdateRecoveryDialogOpen] = useState(false);
  const [recoveryUpdateStage, setRecoveryUpdateStage] = useState<RecoveryStage | "">("");
  const [recoveryAmountInput, setRecoveryAmountInput] = useState<string>("");
  const [recoveryUpdateNotes, setRecoveryUpdateNotes] = useState("");
  const [isUpdatingRecovery, setIsUpdatingRecovery] = useState(false);

  const leak = details?.leak;
  const activities = details?.activities ?? [];
  const recoveryCase = details?.recoveryCase ?? null;
  const memberMap = details?.memberMap ?? {};

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["leak-details", leakId] });
    void queryClient.invalidateQueries({ queryKey: ["durable-leaks"] });
    void queryClient.invalidateQueries({ queryKey: ["recovery-cases"] });
    void queryClient.invalidateQueries({ queryKey: ["durable-metrics"] });
    void queryClient.invalidateQueries({ queryKey: ["erp", "overview"] });
    onMutated?.();
  };

  const handleMutationError = (err: unknown, defaultMessage: string) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Concurrency conflict")) {
      toast.error("This leak was updated by another user. The latest version has been loaded.");
      void refetchDetails();
      void queryClient.invalidateQueries({ queryKey: ["durable-leaks"] });
    } else if (msg.includes("Forbidden")) {
      toast.error("You do not have permission to perform this action.");
    } else {
      toast.error(`${defaultMessage}: ${msg}`);
    }
  };

  // Status transitions
  const handleTransition = async (nextStatus: LeakStatus, notes?: string) => {
    if (!leak) return;
    setIsMutatingStatus(true);
    try {
      await mutateStatus({
        data: {
          leakId: leak.id,
          status: nextStatus,
          expectedStatus: leak.status as LeakStatus,
          notes: notes ?? null,
        },
      });
      toast.success(`Leak status updated to ${nextStatus}.`);
      invalidateAll();
    } catch (err) {
      handleMutationError(err, "Failed to update status");
    } finally {
      setIsMutatingStatus(false);
    }
  };

  // Assignment
  const handleAssign = async (memberUserId: string | null) => {
    if (!leak) return;
    setIsAssigning(true);
    try {
      await mutateAssign({
        data: {
          leakId: leak.id,
          memberUserId: memberUserId === "none" ? null : memberUserId,
        },
      });
      toast.success(
        memberUserId && memberUserId !== "none"
          ? "Case assigned successfully."
          : "Case unassigned.",
      );
      invalidateAll();
    } catch (err) {
      handleMutationError(err, "Failed to assign case");
    } finally {
      setIsAssigning(false);
    }
  };

  // Notes
  const handleAddNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!leak || !noteText.trim()) return;
    setIsSubmittingNote(true);
    try {
      await mutateNote({
        data: {
          leakId: leak.id,
          note: noteText.trim(),
        },
      });
      toast.success("Investigation note recorded.");
      setNoteText("");
      invalidateAll();
    } catch (err) {
      handleMutationError(err, "Failed to record note");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Open Recovery
  const handleOpenRecovery = async () => {
    if (!leak) return;
    setIsOpeningRecovery(true);
    try {
      const target = recoveryTarget ? parseFloat(recoveryTarget) : leak.amount;
      const recPayload: {
        leakId: string;
        targetAmount?: number;
        claimReference?: string;
        notes?: string;
      } = {
        leakId: leak.id,
        targetAmount: isNaN(target) ? leak.amount : target,
      };
      if (recoveryClaimRef.trim()) recPayload.claimReference = recoveryClaimRef.trim();
      if (recoveryNotes.trim()) recPayload.notes = recoveryNotes.trim();
      await mutateOpenRecovery({
        data: recPayload,
      });
      toast.success("Recovery claim successfully opened.");
      setRecoveryDialogOpen(false);
      setRecoveryTarget("");
      setRecoveryClaimRef("");
      setRecoveryNotes("");
      setActiveTab("recovery");
      invalidateAll();
    } catch (err) {
      handleMutationError(err, "Failed to open recovery claim");
    } finally {
      setIsOpeningRecovery(false);
    }
  };

  // Update Recovery
  const handleUpdateRecoveryStage = async () => {
    if (!recoveryCase) return;
    setIsUpdatingRecovery(true);
    try {
      const updatePayload: {
        recoveryCaseId: string;
        stage?: RecoveryStage;
        recoveredAmount?: number;
        notes?: string;
      } = {
        recoveryCaseId: recoveryCase.id,
      };
      if (recoveryUpdateStage) updatePayload.stage = recoveryUpdateStage;
      const recAmt = recoveryAmountInput ? parseFloat(recoveryAmountInput) : undefined;
      if (recAmt !== undefined && !isNaN(recAmt)) updatePayload.recoveredAmount = recAmt;
      if (recoveryUpdateNotes.trim()) updatePayload.notes = recoveryUpdateNotes.trim();
      await mutateUpdateRecovery({
        data: updatePayload,
      });
      toast.success("Recovery progress updated.");
      setUpdateRecoveryDialogOpen(false);
      setRecoveryAmountInput("");
      setRecoveryUpdateNotes("");
      invalidateAll();
    } catch (err) {
      handleMutationError(err, "Failed to update recovery claim");
    } finally {
      setIsUpdatingRecovery(false);
    }
  };

  // Dismissal
  const handleDismiss = async () => {
    if (!leak) return;
    await handleTransition("dismissed", dismissReason.trim() || "Dismissed by reviewer");
    setDismissDialogOpen(false);
    setDismissReason("");
  };

  const evidence = (leak?.evidence as Record<string, unknown>) ?? {};
  const evidenceInvoices = (evidence["invoices"] as Array<Record<string, unknown>>) ?? [];
  const evidencePayments = (evidence["payments"] as Array<Record<string, unknown>>) ?? [];
  const evidenceVendors = (evidence["vendors"] as Array<Record<string, unknown>>) ?? [];

  // Allowed next recovery stages
  const getNextRecoveryStages = (current: RecoveryStage): RecoveryStage[] => {
    switch (current) {
      case "identified":
        return ["vendor_contacted", "claim_filed"];
      case "vendor_contacted":
        return ["claim_filed", "credit_issued", "recovered"];
      case "claim_filed":
        return ["credit_issued", "recovered"];
      case "credit_issued":
        return ["recovered"];
      default:
        return [];
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-3xl">
          {detailsLoading ? (
            <div className="flex flex-1 items-center justify-center p-12">
              <div className="flex flex-col items-center gap-3">
                <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs text-muted-foreground">Loading durable case details…</p>
              </div>
            </div>
          ) : detailsError || !leak ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <AlertTriangle className="size-10 text-destructive" />
              <h3 className="mt-3 text-base font-semibold">Unable to load leak details</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {detailsError instanceof Error ? detailsError.message : "Record not found"}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => void refetchDetails()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              {/* Header */}
              <SheetHeader className="border-b border-border pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ToneBadge tone="brand">{leak.type}</ToneBadge>
                  <SeverityBadge severity={leak.severity} />
                  <StatusBadge status={leak.status} />
                </div>
                <SheetTitle className="mt-2 text-left text-xl font-bold">{leak.title}</SheetTitle>
                <SheetDescription className="text-left text-xs text-muted-foreground">
                  Vendor: <span className="font-semibold text-foreground">{leak.vendor_name}</span>{" "}
                  · Detected: {formatDate(leak.detected_at)}
                  {leak.source ? ` · Source: ${leak.source}` : ""}
                </SheetDescription>

                {/* Amount Header Banner */}
                <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
                  <div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Recoverable Exposure
                    </span>
                    <p className="text-2xl font-bold tabular-nums text-foreground">
                      {formatMoney(leak.amount, leak.currency)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Assigned To
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      {leak.assigned_to && memberMap[leak.assigned_to]
                        ? memberMap[leak.assigned_to]?.fullName
                        : "Unassigned"}
                    </p>
                  </div>
                </div>
              </SheetHeader>

              {/* Navigation Tabs */}
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="mt-4 flex flex-1 flex-col"
              >
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="investigation" className="gap-1.5 text-xs">
                    <FileCheck className="size-3.5" /> Investigation
                  </TabsTrigger>
                  <TabsTrigger value="evidence" className="gap-1.5 text-xs">
                    <FileText className="size-3.5" /> Evidence
                  </TabsTrigger>
                  <TabsTrigger
                    value="recovery"
                    className="gap-1.5 text-xs"
                    disabled={!recoveryCase && leak.status !== "recovering"}
                  >
                    <ShieldCheck className="size-3.5" /> Recovery
                    {recoveryCase && <span className="ml-1 size-1.5 rounded-full bg-primary" />}
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="gap-1.5 text-xs">
                    <History className="size-3.5" /> Audit History
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: INVESTIGATION */}
                <TabsContent value="investigation" className="flex-1 space-y-6 pt-4">
                  {/* Current Status Card */}
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Workflow State
                        </h4>
                        <div className="mt-1 flex items-center gap-2">
                          <StatusBadge status={leak.status} />
                          <span className="text-xs text-muted-foreground">
                            {leak.status === "detected" && "Awaiting triage and investigation."}
                            {leak.status === "investigating" &&
                              "Under active investigation by team."}
                            {leak.status === "recovering" && "Recovery claim active with vendor."}
                            {leak.status === "recovered" && "Successfully recovered and resolved."}
                            {leak.status === "dismissed" &&
                              "Dismissed as false positive or approved exception."}
                          </span>
                        </div>
                      </div>

                      {/* Primary Actions based on State */}
                      <div className="flex flex-wrap items-center gap-2">
                        {leak.status === "detected" && (
                          <>
                            <Button
                              size="sm"
                              className="gap-1.5"
                              disabled={isMutatingStatus || !can("edit")}
                              onClick={() => handleTransition("investigating")}
                            >
                              <CheckCircle2 className="size-3.5" /> Start Investigation
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-destructive hover:bg-destructive/10"
                              disabled={isMutatingStatus || !can("approve")}
                              onClick={() => setDismissDialogOpen(true)}
                            >
                              <XCircle className="size-3.5" /> Dismiss
                            </Button>
                          </>
                        )}

                        {leak.status === "investigating" && (
                          <>
                            <Button
                              size="sm"
                              className="gap-1.5"
                              disabled={isOpeningRecovery || !can("recover")}
                              onClick={() => {
                                setRecoveryTarget(String(leak.amount));
                                setRecoveryDialogOpen(true);
                              }}
                            >
                              <ShieldCheck className="size-3.5" /> Open Recovery Claim
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-destructive hover:bg-destructive/10"
                              disabled={isMutatingStatus || !can("approve")}
                              onClick={() => setDismissDialogOpen(true)}
                            >
                              <XCircle className="size-3.5" /> Dismiss
                            </Button>
                          </>
                        )}

                        {leak.status === "recovering" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => setActiveTab("recovery")}
                            >
                              <ShieldCheck className="size-3.5" /> View Claim Details
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1.5 bg-success text-success-foreground hover:bg-success/90"
                              disabled={isMutatingStatus || (!can("recover") && !can("approve"))}
                              onClick={() => handleTransition("recovered", "Confirmed recovered")}
                            >
                              <CheckCircle2 className="size-3.5" /> Mark Recovered
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Resolution details for resolved leaks */}
                    {(leak.status === "recovered" || leak.status === "dismissed") && (
                      <div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs">
                        <span className="font-semibold text-muted-foreground">
                          Resolution notes:{" "}
                        </span>
                        <span>{leak.resolution_notes || "No notes recorded"}</span>
                        {leak.resolved_at && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Resolved on {formatDate(leak.resolved_at)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Assignee Selection */}
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Case Assignee
                        </h4>
                        <p className="mt-1 text-sm font-medium">
                          {leak.assigned_to && memberMap[leak.assigned_to] ? (
                            <span className="flex items-center gap-1.5 text-foreground">
                              <UserCheck className="size-4 text-primary" />
                              {memberMap[leak.assigned_to]?.fullName}
                              <span className="text-xs text-muted-foreground">
                                ({memberMap[leak.assigned_to]?.role})
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </p>
                      </div>

                      {can("edit") && (
                        <div className="w-56">
                          <Select
                            disabled={isAssigning}
                            value={leak.assigned_to ?? "none"}
                            onValueChange={(val) => handleAssign(val)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Assign team member" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Unassigned</SelectItem>
                              {members.map((m: { id: string; fullName: string; role: string }) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.fullName} ({m.role})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add Note Section */}
                  <div className="rounded-xl border border-border p-4">
                    <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <MessageSquare className="size-3.5" /> Investigation Notes
                    </h4>
                    <form onSubmit={handleAddNote} className="mt-3 space-y-2">
                      <Textarea
                        placeholder="Add an immutable investigation note (e.g. verified duplicate invoice with procurement)…"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        disabled={isSubmittingNote || !can("edit")}
                        maxLength={1000}
                        rows={3}
                        className="text-xs"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">
                          {1000 - noteText.length} characters remaining
                        </span>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!noteText.trim() || isSubmittingNote || !can("edit")}
                          className="gap-1.5 text-xs"
                        >
                          <Send className="size-3" /> Record Note
                        </Button>
                      </div>
                    </form>
                  </div>
                </TabsContent>

                {/* TAB 2: EVIDENCE */}
                <TabsContent value="evidence" className="flex-1 space-y-5 pt-4">
                  <div>
                    <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                      <TrendingDown className="size-4 text-primary" /> Detection Rationale
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {leak.evidence &&
                      typeof leak.evidence === "object" &&
                      "detail" in leak.evidence
                        ? String((leak.evidence as any).detail)
                        : `Rule-based finding flagged by AutoAudit detection engine. Category: ${leak.type}.`}
                    </p>
                  </div>

                  {/* Matched Records */}
                  <div className="space-y-4">
                    <EvidenceTable
                      title="Matched Invoices"
                      rows={evidenceInvoices}
                      fields={[
                        "invoice_number",
                        "vendor_name",
                        "issue_date",
                        "due_date",
                        "amount",
                        "amount_paid",
                        "currency",
                        "status",
                      ]}
                    />

                    <EvidenceTable
                      title="Matched Payments"
                      rows={evidencePayments}
                      fields={[
                        "reference",
                        "invoice_external_id",
                        "vendor_name",
                        "paid_date",
                        "amount",
                        "currency",
                        "method",
                        "status",
                      ]}
                    />

                    <EvidenceTable
                      title="Matched Vendors"
                      rows={evidenceVendors}
                      fields={["name", "email", "phone", "external_id", "status"]}
                    />

                    {!evidenceInvoices.length &&
                      !evidencePayments.length &&
                      !evidenceVendors.length && (
                        <p className="text-xs text-muted-foreground">
                          No underlying transaction snapshot was captured for this finding.
                        </p>
                      )}
                  </div>
                </TabsContent>

                {/* TAB 3: RECOVERY */}
                <TabsContent value="recovery" className="flex-1 space-y-5 pt-4">
                  {recoveryCase ? (
                    <div className="space-y-5">
                      {/* Recovery Progress Header */}
                      <div className="rounded-xl border border-border bg-muted/20 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Recovery Stage
                            </span>
                            <div className="mt-1">
                              <StatusBadge status={recoveryCase.stage} />
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Case Reference
                            </span>
                            <p className="mt-1 text-sm font-semibold">
                              {recoveryCase.claim_reference || `REC-${recoveryCase.id.slice(0, 8)}`}
                            </p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4 space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Cash Recovered</span>
                            <span className="font-semibold tabular-nums">
                              {formatMoney(
                                Number(recoveryCase.recovered_amount) || 0,
                                leak.currency,
                              )}{" "}
                              of{" "}
                              {formatMoney(Number(recoveryCase.target_amount) || 0, leak.currency)}{" "}
                              (
                              {Number(recoveryCase.target_amount) > 0
                                ? Math.round(
                                    ((Number(recoveryCase.recovered_amount) || 0) /
                                      Number(recoveryCase.target_amount)) *
                                      100,
                                  )
                                : 0}
                              %)
                            </span>
                          </div>
                          <Progress
                            value={
                              Number(recoveryCase.target_amount) > 0
                                ? Math.min(
                                    100,
                                    ((Number(recoveryCase.recovered_amount) || 0) /
                                      Number(recoveryCase.target_amount)) *
                                      100,
                                  )
                                : 0
                            }
                            className="h-2"
                          />
                        </div>

                        {/* Financial breakdown */}
                        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
                          <div>
                            <span className="text-[11px] text-muted-foreground">Target</span>
                            <p className="text-base font-semibold tabular-nums">
                              {formatMoney(Number(recoveryCase.target_amount) || 0, leak.currency)}
                            </p>
                          </div>
                          <div>
                            <span className="text-[11px] text-muted-foreground">Recovered</span>
                            <p className="text-base font-semibold tabular-nums text-success">
                              {formatMoney(
                                Number(recoveryCase.recovered_amount) || 0,
                                leak.currency,
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="text-[11px] text-muted-foreground">Remaining</span>
                            <p className="text-base font-semibold tabular-nums text-warning">
                              {formatMoney(
                                Math.max(
                                  0,
                                  (Number(recoveryCase.target_amount) || 0) -
                                    (Number(recoveryCase.recovered_amount) || 0),
                                ),
                                leak.currency,
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Recovery Meta */}
                      <div className="rounded-xl border border-border p-4 text-xs space-y-2">
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Owner</span>
                          <span className="font-medium">
                            {recoveryCase.owner_id && memberMap[recoveryCase.owner_id]
                              ? memberMap[recoveryCase.owner_id]?.fullName
                              : "Unassigned"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Opened On</span>
                          <span>{formatDate(recoveryCase.opened_at)}</span>
                        </div>
                        {recoveryCase.closed_at && (
                          <div className="flex justify-between py-1 border-b border-border/50">
                            <span className="text-muted-foreground">Closed On</span>
                            <span>{formatDate(recoveryCase.closed_at)}</span>
                          </div>
                        )}
                        {recoveryCase.notes && (
                          <div className="pt-1">
                            <span className="text-muted-foreground">Notes: </span>
                            <span>{recoveryCase.notes}</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons for recovery progression */}
                      {recoveryCase.stage !== "recovered" && can("recover") && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="flex-1 gap-1.5"
                            onClick={() => {
                              const nexts = getNextRecoveryStages(
                                recoveryCase.stage as RecoveryStage,
                              );
                              setRecoveryUpdateStage(nexts[0] ?? "");
                              setRecoveryAmountInput(String(recoveryCase.recovered_amount ?? ""));
                              setUpdateRecoveryDialogOpen(true);
                            }}
                          >
                            <ArrowRight className="size-3.5" /> Progress Recovery Stage
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center">
                      <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
                      <h4 className="mt-2 text-sm font-semibold">No recovery claim opened yet</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Move the leak to Investigation and click "Open Recovery Claim" to begin
                        formal recovery.
                      </p>
                      {leak.status === "investigating" && can("recover") && (
                        <Button
                          size="sm"
                          className="mt-4 gap-1.5"
                          onClick={() => {
                            setRecoveryTarget(String(leak.amount));
                            setRecoveryDialogOpen(true);
                          }}
                        >
                          <ShieldCheck className="size-3.5" /> Open Recovery Claim
                        </Button>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* TAB 4: AUDIT HISTORY */}
                <TabsContent value="activity" className="flex-1 space-y-4 pt-4">
                  <div>
                    <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <History className="size-3.5" /> Immutable Audit Log
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Append-only event log protected by database triggers. Cannot be edited or
                      deleted.
                    </p>
                  </div>

                  {activities.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
                  ) : (
                    <div className="relative space-y-4 pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                      {activities.map((act) => {
                        const actorInfo = act.actor_id ? memberMap[act.actor_id] : null;
                        const actorName = actorInfo?.fullName ?? "System";
                        const meta = (act.metadata ?? {}) as Record<string, unknown>;

                        return (
                          <div key={act.id} className="relative pl-3 text-xs">
                            <span className="absolute -left-[14px] top-1.5 size-2 rounded-full border border-background bg-primary" />
                            <div className="rounded-xl border border-border bg-muted/20 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <span className="font-semibold text-foreground">
                                  {actorName}
                                  {actorInfo?.role && (
                                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                                      ({actorInfo.role})
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDate(act.created_at)}
                                </span>
                              </div>

                              <p className="mt-1 font-medium text-foreground">
                                {act.action === "detected" && "Detected financial leak case"}
                                {act.action === "status_changed" && (
                                  <>
                                    Changed status from{" "}
                                    <span className="capitalize">
                                      {String(meta["from_status"] ?? "—")}
                                    </span>{" "}
                                    to{" "}
                                    <span className="font-semibold capitalize text-primary">
                                      {String(meta["to_status"] ?? "—")}
                                    </span>
                                  </>
                                )}
                                {act.action === "assigned" && (
                                  <>
                                    Assigned case to{" "}
                                    <span className="font-semibold text-primary">
                                      {meta["assigned_to"] && memberMap[String(meta["assigned_to"])]
                                        ? memberMap[String(meta["assigned_to"])]?.fullName
                                        : meta["assigned_to"]
                                          ? "Team member"
                                          : "Unassigned"}
                                    </span>
                                  </>
                                )}
                                {act.action === "note_added" && "Recorded investigation note"}
                                {act.action === "recovery_opened" && "Opened formal recovery claim"}
                                {act.action === "recovery_stage_changed" && (
                                  <>
                                    Progressed recovery stage to{" "}
                                    <span className="font-semibold text-primary capitalize">
                                      {String(meta["to_stage"] ?? meta["stage"] ?? "")}
                                    </span>
                                  </>
                                )}
                                {act.action === "leak_resolved" && "Marked leak as recovered"}
                              </p>

                              {/* Details / Notes snippet */}
                              {Boolean(meta["note"]) && (
                                <p className="mt-2 rounded-md bg-background/80 p-2 text-xs italic text-foreground">
                                  "{String(meta["note"])}"
                                </p>
                              )}
                              {Boolean(meta["target_amount"]) && (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Target claim:{" "}
                                  {formatMoney(Number(meta["target_amount"]), leak.currency)}
                                </p>
                              )}
                              {Boolean(meta["recovered_amount"]) && (
                                <p className="mt-1 text-[11px] text-success">
                                  Recovered amount:{" "}
                                  {formatMoney(Number(meta["recovered_amount"]), leak.currency)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* DISMISS CONFIRMATION DIALOG */}
      <Dialog open={dismissDialogOpen} onOpenChange={setDismissDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dismiss Leak Finding</DialogTitle>
            <DialogDescription>
              Dismissing marks this leak finding as an approved business exception or false
              positive. An immutable audit log entry will record your action.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="dismiss-reason" className="text-xs">
              Reason for Dismissal
            </Label>
            <Textarea
              id="dismiss-reason"
              placeholder="e.g. Approved vendor credit or legitimate contract variation…"
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              className="text-xs"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDismissDialogOpen(false)}
              disabled={isMutatingStatus}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDismiss}
              disabled={isMutatingStatus}
            >
              {isMutatingStatus ? "Dismissing…" : "Confirm Dismissal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OPEN RECOVERY CLAIM DIALOG */}
      <Dialog open={recoveryDialogOpen} onOpenChange={setRecoveryDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" /> Open Recovery Claim
            </DialogTitle>
            <DialogDescription>
              Create a durable financial recovery case to track reclaiming overbilled cash or vendor
              credits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rec-target" className="text-xs">
                Target Recovery Amount ({leak?.currency || "USD"})
              </Label>
              <Input
                id="rec-target"
                type="number"
                step="0.01"
                value={recoveryTarget}
                onChange={(e) => setRecoveryTarget(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-claim-ref" className="text-xs">
                Vendor / Claim Reference (Optional)
              </Label>
              <Input
                id="rec-claim-ref"
                placeholder="e.g. DISPUTE-2026-091"
                value={recoveryClaimRef}
                onChange={(e) => setRecoveryClaimRef(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-notes" className="text-xs">
                Recovery Notes / Instructions
              </Label>
              <Textarea
                id="rec-notes"
                placeholder="Instructions for procurement or legal contact with vendor…"
                value={recoveryNotes}
                onChange={(e) => setRecoveryNotes(e.target.value)}
                className="text-xs"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRecoveryDialogOpen(false)}
              disabled={isOpeningRecovery}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleOpenRecovery}
              disabled={isOpeningRecovery || !recoveryTarget}
            >
              {isOpeningRecovery ? "Creating Case…" : "Open Recovery Claim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UPDATE RECOVERY STAGE DIALOG */}
      <Dialog open={updateRecoveryDialogOpen} onOpenChange={setUpdateRecoveryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Recovery Case Progress</DialogTitle>
            <DialogDescription>
              Move the recovery case through its state machine and record cash received.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Next Stage</Label>
              <Select
                value={recoveryUpdateStage}
                onValueChange={(val) => setRecoveryUpdateStage(val as RecoveryStage)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select target stage" />
                </SelectTrigger>
                <SelectContent>
                  {recoveryCase &&
                    getNextRecoveryStages(recoveryCase.stage as RecoveryStage).map((stg) => (
                      <SelectItem key={stg} value={stg} className="capitalize">
                        {stg.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-amount-input" className="text-xs">
                Recovered Cash Amount ({leak?.currency || "USD"})
              </Label>
              <Input
                id="rec-amount-input"
                type="number"
                step="0.01"
                placeholder="Total recovered to date"
                value={recoveryAmountInput}
                onChange={(e) => setRecoveryAmountInput(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-update-notes" className="text-xs">
                Stage Update Note
              </Label>
              <Textarea
                id="rec-update-notes"
                placeholder="e.g. Vendor credit memo CM-889 received and verified…"
                value={recoveryUpdateNotes}
                onChange={(e) => setRecoveryUpdateNotes(e.target.value)}
                className="text-xs"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUpdateRecoveryDialogOpen(false)}
              disabled={isUpdatingRecovery}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleUpdateRecoveryStage}
              disabled={isUpdatingRecovery || !recoveryUpdateStage}
            >
              {isUpdatingRecovery ? "Updating…" : "Update Stage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
