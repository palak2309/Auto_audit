// Server-only reads of the user's ingested real ERP data, plus leakage analysis
// computed from those real records.

import { computeLeakFingerprint } from "@/lib/erp/fingerprint.server";

type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface FinancialsPayload {
  connected: boolean;
  invoices: Row[];
  payments: Row[];
  vendors: Row[];
}

export async function loadFinancials(userId: string): Promise<FinancialsPayload> {
  const db = await admin();
  const [invoices, payments, vendors, bills, billingPayments, suppliers] = await Promise.all([
    db
      .from("erp_invoices")
      .select("id, connection_id, created_at, external_id, invoice_number, vendor_name, issue_date, due_date, amount, tax_amount, amount_paid, currency, status, type")
      .eq("user_id", userId)
      .order("issue_date", { ascending: false })
      .limit(1000),
    db
      .from("erp_payments")
      .select("id, connection_id, created_at, external_id, reference, invoice_external_id, vendor_name, paid_date, amount, currency, method, status")
      .eq("user_id", userId)
      .order("paid_date", { ascending: false })
      .limit(1000),
    db
      .from("erp_vendors")
      .select("id, connection_id, created_at, external_id, name, email, phone, status")
      .eq("user_id", userId)
      .order("name", { ascending: true })
      .limit(1000),
    db
      .from("purchase_bills")
      .select("id, created_at, bill_number, supplier_invoice_number, bill_date, due_date, grand_total, total_tax, amount_paid, status, document_type, supplier:suppliers(name)")
      .eq("user_id", userId)
      .neq("status", "cancelled")
      .limit(1000),
    db
      .from("payments")
      .select("id, created_at, payment_number, reference_number, bill_id, payment_date, amount, payment_mode, supplier:suppliers(name)")
      .eq("user_id", userId)
      .eq("party_type", "supplier")
      .limit(1000),
    db
      .from("suppliers")
      .select("id, created_at, name, email, phone, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1000),
  ]);

  const mappedBills: Row[] = (bills.data ?? []).map((b) => ({
    id: b.id,
    connection_id: "billing-system",
    created_at: b.created_at,
    external_id: b.bill_number,
    invoice_number: b.supplier_invoice_number || b.bill_number,
    vendor_name: (b.supplier as any)?.name || "Supplier",
    issue_date: b.bill_date,
    due_date: b.due_date,
    amount: b.grand_total,
    tax_amount: b.total_tax,
    amount_paid: b.amount_paid,
    currency: "INR",
    status: b.status,
    type: b.document_type,
  }));

  const mappedPayments: Row[] = (billingPayments.data ?? []).map((p) => ({
    id: p.id,
    connection_id: "billing-system",
    created_at: p.created_at,
    external_id: p.payment_number,
    reference: p.reference_number || p.payment_number,
    invoice_external_id: p.bill_id,
    vendor_name: (p.supplier as any)?.name || "Supplier",
    paid_date: p.payment_date,
    amount: p.amount,
    currency: "INR",
    method: p.payment_mode,
    status: "completed",
  }));

  const mappedSuppliers: Row[] = (suppliers.data ?? []).map((s) => ({
    id: s.id,
    connection_id: "billing-system",
    created_at: s.created_at,
    external_id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    status: s.status,
  }));

  const mergedInvoices = [...(invoices.data ?? []), ...mappedBills] as Row[];
  const mergedPayments = [...(payments.data ?? []), ...mappedPayments] as Row[];
  const mergedVendors = [...(vendors.data ?? []), ...mappedSuppliers] as Row[];

  return {
    connected: mergedInvoices.length + mergedPayments.length + mergedVendors.length > 0,
    invoices: mergedInvoices,
    payments: mergedPayments,
    vendors: mergedVendors,
  };
}


export interface LeakEvidence {
  invoices: Row[];
  payments: Row[];
  vendors: Row[];
}

export interface DetectedLeak {
  id: string;
  fingerprint: string;
  type: string;
  title: string;
  vendor: string;
  amount: number;
  currency: string;
  severity: "critical" | "high" | "medium" | "low";
  detail: string;
  date: string | null;
  connectionId: string | null;
  syncRunId: string | null;
  evidence: LeakEvidence;
}

export interface SyncRunOption {
  id: string;
  connectionId: string;
  provider: string;
  status: string;
  startedAt: string;
}

export interface VendorSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  spend: number;
  invoices: number;
  outstanding: number;
  leaks: number;
}

export interface GeneratedInsight {
  id: string;
  title: string;
  category: string;
  summary: string;
  impact: number;
  confidence: number;
  count: number;
}

export interface OverviewPayload {
  connected: boolean;
  currencyCode: string;
  totals: {
    invoices: number;
    payments: number;
    vendors: number;
    spend: number;
    outstanding: number;
    atRisk: number;
  };
  spendByMonth: Array<{ month: string; spend: number }>;
  detectedByMonth: Array<{ month: string; detected: number; spend: number }>;
  leakMix: Array<{ name: string; value: number }>;
  severityMix: Array<{ severity: string; count: number; amount: number }>;
  topVendors: Array<{ vendor: string; spend: number }>;
  vendorSummary: VendorSummary[];
  insights: GeneratedInsight[];
  leaks: DetectedLeak[];
  vendorOptions: string[];
  syncRuns: SyncRunOption[];
}



function money(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function detectLeaksFromFinancials(params: {
  invoices: Row[];
  payments: Row[];
  vendors: Row[];
  syncRuns?: SyncRunOption[];
}): DetectedLeak[] {
  const { invoices, payments, vendors, syncRuns = [] } = params;

  const vendorByName = new Map<string, Row>();
  for (const v of vendors) vendorByName.set(String(v["name"] ?? "").toLowerCase(), v);

  const attribute = (rows: Row[]) => {
    const connectionId = (rows.find((r) => r["connection_id"])?.["connection_id"] as string) ?? null;
    let syncRunId: string | null = null;
    const created = rows
      .map((r) => String(r["created_at"] ?? ""))
      .filter(Boolean)
      .sort()
      .at(-1);
    if (connectionId && created) {
      syncRunId =
        syncRuns.find((r) => r.connectionId === connectionId && r.startedAt <= created)?.id ?? null;
    }
    return { connectionId, syncRunId };
  };

  const evidenceFor = (inv: Row[], pay: Row[]): LeakEvidence => {
    const names = new Set(
      [...inv, ...pay].map((r) => String(r["vendor_name"] ?? "").toLowerCase()).filter(Boolean),
    );
    const ven = [...names].map((n) => vendorByName.get(n)).filter(Boolean) as Row[];
    return { invoices: inv, payments: pay, vendors: ven };
  };

  const leaks: DetectedLeak[] = [];

  // 1. Duplicate invoices: same vendor + same amount + same date.
  const dupKey = new Map<string, Row[]>();
  for (const i of invoices) {
    const key = `${i["vendor_name"]}|${money(i["amount"]).toFixed(2)}|${i["issue_date"]}`;
    dupKey.set(key, [...(dupKey.get(key) ?? []), i]);
  }
  for (const [key, group] of dupKey) {
    if (group.length < 2) continue;
    const first = group[0]!;
    const evidence = evidenceFor(group, []);
    const { connectionId, syncRunId } = attribute(group);
    const amount = money(first["amount"]) * (group.length - 1);
    const date = (first["issue_date"] as string | null) ?? null;
    const vendor = String(first["vendor_name"] ?? "Unknown");
    const currency = String(first["currency"] ?? "");
    const fingerprint = computeLeakFingerprint({
      type: "Duplicate invoice",
      connectionId,
      vendor,
      amount,
      date,
      invoices: group,
      payments: [],
    });

    leaks.push({
      id: `dup-${key}`,
      fingerprint,
      type: "Duplicate invoice",
      title: `${group.length} identical invoices from ${first["vendor_name"] ?? "vendor"}`,
      vendor,
      amount,
      currency,
      severity: "critical",
      detail: `Invoices ${group.map((g) => g["invoice_number"] ?? g["external_id"]).join(", ")} share the same vendor, amount and date.`,
      date,
      connectionId,
      syncRunId,
      evidence,
    });
  }

  // 2. Overpayments: paid more than the invoice total.
  const invoiceByExternal = new Map(invoices.map((i) => [String(i["external_id"]), i]));
  const paidByInvoice = new Map<string, number>();
  for (const p of payments) {
    const ref = String(p["invoice_external_id"] ?? "");
    if (!ref) continue;
    paidByInvoice.set(ref, (paidByInvoice.get(ref) ?? 0) + money(p["amount"]));
  }
  for (const [ref, paid] of paidByInvoice) {
    const inv = invoiceByExternal.get(ref);
    if (!inv) continue;
    const total = money(inv["amount"]);
    if (total > 0 && paid - total > 0.5) {
      const matchedPayments = payments.filter((p) => String(p["invoice_external_id"] ?? "") === ref);
      const evidence = evidenceFor([inv], matchedPayments);
      const { connectionId, syncRunId } = attribute([inv]);
      const amount = paid - total;
      const date = (inv["issue_date"] as string | null) ?? null;
      const vendor = String(inv["vendor_name"] ?? "Unknown");
      const currency = String(inv["currency"] ?? "");
      const fingerprint = computeLeakFingerprint({
        type: "Overpayment",
        connectionId,
        vendor,
        amount,
        date,
        invoices: [inv],
        payments: matchedPayments,
      });

      leaks.push({
        id: `over-${ref}`,
        fingerprint,
        type: "Overpayment",
        title: `Overpaid invoice ${inv["invoice_number"] ?? ref}`,
        vendor,
        amount,
        currency,
        severity: "high",
        detail: `Payments total ${paid.toFixed(2)} against an invoice of ${total.toFixed(2)}.`,
        date,
        connectionId,
        syncRunId,
        evidence,
      });
    }
  }

  // 3. Duplicate payments: same vendor, amount and date.
  const payKey = new Map<string, Row[]>();
  for (const p of payments) {
    const key = `${p["vendor_name"]}|${money(p["amount"]).toFixed(2)}|${p["paid_date"]}`;
    payKey.set(key, [...(payKey.get(key) ?? []), p]);
  }
  for (const [key, group] of payKey) {
    if (group.length < 2) continue;
    const first = group[0]!;
    const matchedInvoices = invoices.filter(
      (i) =>
        String(i["vendor_name"] ?? "") === String(first["vendor_name"] ?? "") &&
        money(i["amount"]) === money(first["amount"]),
    );
    const evidence = evidenceFor(matchedInvoices, group);
    const { connectionId, syncRunId } = attribute(group);
    const amount = money(first["amount"]) * (group.length - 1);
    const date = (first["paid_date"] as string | null) ?? null;
    const vendor = String(first["vendor_name"] ?? "Unknown");
    const currency = String(first["currency"] ?? "");
    const fingerprint = computeLeakFingerprint({
      type: "Duplicate payment",
      connectionId,
      vendor,
      amount,
      date,
      invoices: matchedInvoices,
      payments: group,
    });

    leaks.push({
      id: `dpay-${key}`,
      fingerprint,
      type: "Duplicate payment",
      title: `${group.length} identical payments to ${first["vendor_name"] ?? "vendor"}`,
      vendor,
      amount,
      currency,
      severity: "critical",
      detail: `Same vendor, amount and payment date recorded ${group.length} times.`,
      date,
      connectionId,
      syncRunId,
      evidence,
    });
  }

  // 4. Overdue unpaid invoices — cash and penalty exposure.
  const today = new Date().toISOString().slice(0, 10);
  for (const i of invoices) {
    const due = String(i["due_date"] ?? "");
    const balance = money(i["amount"]) - money(i["amount_paid"]);
    if (due && due < today && balance > 0.5) {
      const matchedPayments = payments.filter((p) => String(p["invoice_external_id"] ?? "") === String(i["external_id"] ?? ""));
      const evidence = evidenceFor([i], matchedPayments);
      const { connectionId, syncRunId } = attribute([i]);
      const vendor = String(i["vendor_name"] ?? "Unknown");
      const currency = String(i["currency"] ?? "");
      const fingerprint = computeLeakFingerprint({
        type: "Overdue liability",
        connectionId,
        vendor,
        amount: balance,
        date: due,
        invoices: [i],
        payments: matchedPayments,
      });

      leaks.push({
        id: `late-${i["external_id"]}`,
        fingerprint,
        type: "Overdue liability",
        title: `Invoice ${i["invoice_number"] ?? i["external_id"]} past due`,
        vendor,
        amount: balance,
        currency,
        severity: "medium",
        detail: `Due ${due} with ${balance.toFixed(2)} still outstanding.`,
        date: due,
        connectionId,
        syncRunId,
        evidence,
      });
    }
  }

  leaks.sort((a, b) => b.amount - a.amount);
  return leaks;
}

export async function loadOverview(userId: string): Promise<OverviewPayload> {
  const { invoices, payments, vendors, connected } = await loadFinancials(userId);
  const db = await admin();
  const [runsRes, connRes] = await Promise.all([
    db
      .from("erp_sync_runs")
      .select("id, connection_id, status, started_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(50),
    db.from("erp_connections").select("id, provider").eq("user_id", userId),
  ]);
  const providerById = new Map((connRes.data ?? []).map((c) => [c.id as string, c.provider as string]));
  const syncRuns: SyncRunOption[] = (runsRes.data ?? []).map((r) => ({
    id: r.id as string,
    connectionId: r.connection_id as string,
    provider: providerById.get(r.connection_id as string) ?? "unknown",
    status: r.status as string,
    startedAt: r.started_at as string,
  }));

  const spend = invoices.reduce((s, i) => s + money(i["amount"]), 0);
  const outstanding = invoices.reduce((s, i) => s + Math.max(money(i["amount"]) - money(i["amount_paid"]), 0), 0);

  const byMonth = new Map<string, number>();
  for (const i of invoices) {
    const d = String(i["issue_date"] ?? "").slice(0, 7);
    if (!d) continue;
    byMonth.set(d, (byMonth.get(d) ?? 0) + money(i["amount"]));
  }
  const spendByMonth = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, s]) => ({ month, spend: Math.round(s) }));

  const byVendor = new Map<string, number>();
  for (const i of invoices) {
    const v = String(i["vendor_name"] ?? "Unknown");
    byVendor.set(v, (byVendor.get(v) ?? 0) + money(i["amount"]));
  }
  const topVendors = [...byVendor.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([vendor, s]) => ({ vendor, spend: Math.round(s) }));

  const leaks = detectLeaksFromFinancials({ invoices, payments, vendors, syncRuns });
  const atRisk = leaks.reduce((s, l) => s + l.amount, 0);

  // Most frequently used currency across the imported invoices.
  const currencyCount = new Map<string, number>();
  for (const i of invoices) {
    const c = String(i["currency"] ?? "").trim();
    if (c) currencyCount.set(c, (currencyCount.get(c) ?? 0) + 1);
  }
  const currencyCode = [...currencyCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

  // Detected exposure per month, aligned with the spend series.
  const leaksByMonth = new Map<string, number>();
  for (const l of leaks) {
    const m = String(l.date ?? "").slice(0, 7);
    if (!m) continue;
    leaksByMonth.set(m, (leaksByMonth.get(m) ?? 0) + l.amount);
  }
  const detectedByMonth = spendByMonth.map(({ month, spend: s }) => ({
    month,
    spend: s,
    detected: Math.round(leaksByMonth.get(month) ?? 0),
  }));

  const mix = new Map<string, number>();
  const sev = new Map<string, { count: number; amount: number }>();
  for (const l of leaks) {
    mix.set(l.type, (mix.get(l.type) ?? 0) + l.amount);
    const s = sev.get(l.severity) ?? { count: 0, amount: 0 };
    sev.set(l.severity, { count: s.count + 1, amount: s.amount + l.amount });
  }
  const leakMix = [...mix.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Math.round(value) }));
  const severityMix = [...sev.entries()].map(([severity, s]) => ({
    severity,
    count: s.count,
    amount: Math.round(s.amount),
  }));

  const leaksPerVendor = new Map<string, number>();
  for (const l of leaks) leaksPerVendor.set(l.vendor.toLowerCase(), (leaksPerVendor.get(l.vendor.toLowerCase()) ?? 0) + 1);

  const invStatsByVendor = new Map<string, { spend: number; count: number; outstanding: number }>();
  for (const i of invoices) {
    const key = String(i["vendor_name"] ?? "Unknown").toLowerCase();
    const cur = invStatsByVendor.get(key) ?? { spend: 0, count: 0, outstanding: 0 };
    invStatsByVendor.set(key, {
      spend: cur.spend + money(i["amount"]),
      count: cur.count + 1,
      outstanding: cur.outstanding + Math.max(money(i["amount"]) - money(i["amount_paid"]), 0),
    });
  }

  const vendorSummary: VendorSummary[] = vendors.map((v) => {
    const key = String(v["name"] ?? "").toLowerCase();
    const stats = invStatsByVendor.get(key) ?? { spend: 0, count: 0, outstanding: 0 };
    return {
      id: String(v["id"]),
      name: String(v["name"] ?? "Unknown"),
      email: (v["email"] as string | null) ?? null,
      phone: (v["phone"] as string | null) ?? null,
      status: (v["status"] as string | null) ?? null,
      spend: Math.round(stats.spend),
      invoices: stats.count,
      outstanding: Math.round(stats.outstanding),
      leaks: leaksPerVendor.get(key) ?? 0,
    };
  });
  vendorSummary.sort((a, b) => b.spend - a.spend);

  // Plain-language insights derived from the real findings.
  const insights: GeneratedInsight[] = [...mix.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([type, amount]) => {
      const group = leaks.filter((l) => l.type === type);
      const vendorsHit = [...new Set(group.map((l) => l.vendor))];
      const top = vendorsHit.slice(0, 3).join(", ");
      const confidence =
        type === "Duplicate invoice" || type === "Duplicate payment" ? 0.94 : type === "Overpayment" ? 0.88 : 0.76;
      return {
        id: `insight-${type.toLowerCase().replace(/\s+/g, "-")}`,
        title: `${type} exposure across ${vendorsHit.length} ${vendorsHit.length === 1 ? "party" : "parties"}`,
        category: type,
        summary: `${group.length} ${type.toLowerCase()} ${group.length === 1 ? "finding" : "findings"} worth ${Math.round(amount).toLocaleString()} ${currencyCode}${top ? `, concentrated on ${top}` : ""}. Review the matched records before the next payment run.`,
        impact: Math.round(amount),
        confidence,
        count: group.length,
      };
    });

  return {
    connected,
    currencyCode,
    totals: {
      invoices: invoices.length,
      payments: payments.length,
      vendors: vendors.length,
      spend: Math.round(spend),
      outstanding: Math.round(outstanding),
      atRisk: Math.round(atRisk),
    },
    spendByMonth,
    detectedByMonth,
    leakMix,
    severityMix,
    topVendors,
    vendorSummary,
    insights,
    leaks: leaks.slice(0, 200),
    vendorOptions: [...new Set(leaks.map((l) => l.vendor))].sort(),

    syncRuns,
  };
}
