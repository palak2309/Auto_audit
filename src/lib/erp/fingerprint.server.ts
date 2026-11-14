import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function normalizeStr(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function normalizeMoney(v: unknown): string {
  const n = Number(v);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

function normalizeDate(v: unknown): string {
  const s = String(v ?? "").trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export interface FingerprintEntityRow {
  [key: string]: unknown;
}

/**
 * Deterministically computes a stable, collision-resistant fingerprint for a leak finding.
 *
 * Requirements satisfied:
 * - Deterministic & order-invariant: Evidence collections (invoices, payments) are sorted
 *   and normalized before hashing so [A, B] and [B, A] produce identical hashes.
 * - Independent of database-generated IDs: Uses source ERP business keys (external_id, invoice_number).
 * - Independent of persistence-time timestamps: Uses ERP transaction dates (issue_date, paid_date, due_date).
 * - Collision-resistant: SHA-256 over canonical namespaced strings.
 */
export function computeLeakFingerprint(params: {
  type: string;
  connectionId?: string | null;
  vendor?: string | null;
  amount: number;
  date?: string | null;
  invoices?: FingerprintEntityRow[];
  payments?: FingerprintEntityRow[];
}): string {
  const normType = normalizeStr(params.type);
  const normConn = normalizeStr(params.connectionId);
  const normVendor = normalizeStr(params.vendor);
  const normDate = normalizeDate(params.date);

  if (normType.includes("duplicate invoice") || normType === "duplicate_invoice") {
    // Duplicate invoice:
    // Identity: connection_id + vendor + invoice amount + issue date + sorted invoice identities
    const invRows = params.invoices ?? [];
    const invoiceIdentities = invRows
      .map((i) => String(i["external_id"] ?? i["invoice_number"] ?? "").trim())
      .filter(Boolean)
      .sort()
      .join(",");
    const singleAmount = normalizeMoney(invRows[0]?.["amount"] ?? params.amount);
    const rawKey = `duplicate_invoice|${normConn}|${normVendor}|${singleAmount}|${normDate}|${invoiceIdentities}`;
    return sha256(rawKey);
  }

  if (normType.includes("duplicate payment") || normType === "duplicate_payment") {
    // Duplicate payment:
    // Identity: connection_id + vendor + payment amount + payment date + sorted payment/reference identities
    const payRows = params.payments ?? [];
    const paymentIdentities = payRows
      .map((p) => String(p["external_id"] ?? p["reference"] ?? "").trim())
      .filter(Boolean)
      .sort()
      .join(",");
    const singleAmount = normalizeMoney(payRows[0]?.["amount"] ?? params.amount);
    const rawKey = `duplicate_payment|${normConn}|${normVendor}|${singleAmount}|${normDate}|${paymentIdentities}`;
    return sha256(rawKey);
  }

  if (normType.includes("overpayment")) {
    // Overpayment:
    // Identity: connection_id + invoice external identity + overpayment difference
    const inv = params.invoices?.[0];
    const invoiceExternalId = String(inv?.["external_id"] ?? "").trim();
    const diff = normalizeMoney(params.amount);
    const rawKey = `overpayment|${normConn}|${invoiceExternalId}|${diff}`;
    return sha256(rawKey);
  }

  if (normType.includes("overdue") || normType.includes("liability")) {
    // Overdue liability:
    // Identity: connection_id + invoice external identity + due date
    const inv = params.invoices?.[0];
    const invoiceExternalId = String(inv?.["external_id"] ?? "").trim();
    const rawKey = `overdue_liability|${normConn}|${invoiceExternalId}|${normDate}`;
    return sha256(rawKey);
  }

  // Fallback for any other rule finding
  const rawKey = `generic_leak|${normType}|${normConn}|${normVendor}|${normalizeMoney(params.amount)}|${normDate}`;
  return sha256(rawKey);
}
