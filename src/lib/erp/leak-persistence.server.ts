import type { Database, Json } from "@/integrations/supabase/types";
import {
  type DetectedLeak,
  type SyncRunOption,
  loadFinancials,
  detectLeaksFromFinancials,
} from "@/lib/erp/data.server";
import { computeLeakFingerprint, sha256 } from "@/lib/erp/fingerprint.server";

export { computeLeakFingerprint, sha256 };

type LeakInsert = Database["public"]["Tables"]["erp_leaks"]["Insert"];

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface PersistableLeak {
  fingerprint: string;
  connectionId: string | null;
  type: string;
  title: string;
  vendorName: string;
  amount: number;
  currency: string;
  severity: "critical" | "high" | "medium" | "low";
  source: "rule_engine" | "ai_scan";
  evidence: Record<string, unknown>;
  detectedAt: string;
}

export interface PersistenceResult {
  total: number;
  inserted: number;
  updated: number;
}

export interface DetectionAndPersistenceResult extends PersistenceResult {
  userId: string;
  error?: string | null;
}

/**
 * Normalizes a detected leak finding into an internal persistable leak model.
 */
export function normalizeLeakFinding(finding: DetectedLeak): PersistableLeak {
  const fingerprint =
    finding.fingerprint ||
    computeLeakFingerprint({
      type: finding.type,
      connectionId: finding.connectionId,
      vendor: finding.vendor,
      amount: finding.amount,
      date: finding.date,
      invoices: finding.evidence?.invoices,
      payments: finding.evidence?.payments,
    });

  return {
    fingerprint,
    connectionId: finding.connectionId || null,
    type: finding.type,
    title: finding.title,
    vendorName: finding.vendor || "Unknown",
    amount: Number(finding.amount) || 0,
    currency: finding.currency || "USD",
    severity: finding.severity,
    source: "rule_engine",
    evidence: (finding.evidence ?? {}) as unknown as Record<string, unknown>,
    detectedAt: new Date().toISOString(),
  };
}

/**
 * Idempotently persists a collection of detected leaks into `erp_leaks`.
 *
 * Critical guarantees:
 * - Scoped by (user_id, fingerprint) unique constraint.
 * - On conflict (re-detection): Only detection-derived fields are refreshed:
 *   title, vendor_name, amount, currency, severity, source, evidence, connection_id, updated_at.
 * - Lifecycle fields are STRICTLY preserved:
 *   status (e.g. 'investigating', 'recovering', 'recovered', 'dismissed'),
 *   assigned_to, resolution_notes, resolved_at, and original detected_at.
 * - Order invariance: Findings are deduplicated by fingerprint before batch persistence.
 */
export async function persistLeakFindings(
  userId: string,
  leaks: DetectedLeak[],
): Promise<PersistenceResult> {
  if (!userId || typeof userId !== "string") {
    throw new Error("Missing or invalid authenticated user identity for leak persistence");
  }

  if (leaks.length === 0) {
    return { total: 0, inserted: 0, updated: 0 };
  }

  const persistableList = leaks.map(normalizeLeakFinding);

  // Deduplicate by fingerprint in memory before query/upsert
  const uniqueByFingerprint = new Map<string, PersistableLeak>();
  for (const item of persistableList) {
    if (!uniqueByFingerprint.has(item.fingerprint)) {
      uniqueByFingerprint.set(item.fingerprint, item);
    }
  }
  const deduplicated = Array.from(uniqueByFingerprint.values());

  const db = await admin();
  let totalInserted = 0;
  let totalUpdated = 0;

  // Process in chunks of 100 to stay well within query parameter limits
  const CHUNK_SIZE = 100;
  for (let i = 0; i < deduplicated.length; i += CHUNK_SIZE) {
    const chunk = deduplicated.slice(i, i + CHUNK_SIZE);
    const chunkFps = chunk.map((c) => c.fingerprint);

    // 1. Fetch existing leaks for this user matching the current chunk's fingerprints
    const { data: existingRows, error: fetchErr } = await db
      .from("erp_leaks")
      .select("id, fingerprint, status, assigned_to, resolution_notes, resolved_at, detected_at")
      .eq("user_id", userId)
      .in("fingerprint", chunkFps);

    if (fetchErr) {
      throw new Error(`Failed to query existing leaks: ${fetchErr.message}`);
    }

    const existingMap = new Map((existingRows ?? []).map((r) => [r.fingerprint, r]));
    const now = new Date().toISOString();

    const upsertRows: LeakInsert[] = chunk.map((item) => {
      const existing = existingMap.get(item.fingerprint);
      if (existing) {
        totalUpdated++;
        return {
          user_id: userId,
          connection_id: item.connectionId,
          fingerprint: item.fingerprint,
          type: item.type,
          title: item.title,
          vendor_name: item.vendorName,
          amount: item.amount,
          currency: item.currency,
          severity: item.severity,
          source: item.source,
          evidence: item.evidence as Json,
          // PRESERVE LIFECYCLE FIELDS:
          status: existing.status,
          assigned_to: existing.assigned_to,
          resolution_notes: existing.resolution_notes,
          resolved_at: existing.resolved_at,
          detected_at: existing.detected_at,
          updated_at: now,
        };
      } else {
        totalInserted++;
        return {
          user_id: userId,
          connection_id: item.connectionId,
          fingerprint: item.fingerprint,
          type: item.type,
          title: item.title,
          vendor_name: item.vendorName,
          amount: item.amount,
          currency: item.currency,
          severity: item.severity,
          source: item.source,
          evidence: item.evidence as Json,
          // DEFAULT LIFECYCLE FOR NEW DETECTION:
          status: "detected",
          assigned_to: null,
          resolution_notes: null,
          resolved_at: null,
          detected_at: now,
          updated_at: now,
        };
      }
    });

    const { error: upsertErr } = await db
      .from("erp_leaks")
      .upsert(upsertRows, { onConflict: "user_id,fingerprint" });

    if (upsertErr) {
      throw new Error(`Failed to upsert leak findings: ${upsertErr.message}`);
    }
  }

  return {
    total: leaks.length,
    inserted: totalInserted,
    updated: totalUpdated,
  };
}

/**
 * Runs the single source of truth leak detection on the user's ERP data and
 * idempotently persists all findings to `erp_leaks`.
 *
 * Should be called upon successful completion of an ERP sync run.
 */
export async function detectAndPersistLeaksForUser(
  userId: string,
): Promise<DetectionAndPersistenceResult> {
  if (!userId || typeof userId !== "string") {
    throw new Error("Missing or invalid authenticated user identity");
  }

  const financials = await loadFinancials(userId);
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

  const providerById = new Map(
    (connRes.data ?? []).map((c) => [c.id as string, c.provider as string]),
  );
  const syncRuns: SyncRunOption[] = (runsRes.data ?? []).map((r) => ({
    id: r.id as string,
    connectionId: r.connection_id as string,
    provider: providerById.get(r.connection_id as string) ?? "unknown",
    status: r.status as string,
    startedAt: r.started_at as string,
  }));

  const leaks = detectLeaksFromFinancials({
    invoices: financials.invoices,
    payments: financials.payments,
    vendors: financials.vendors,
    syncRuns,
  });

  const persistence = await persistLeakFindings(userId, leaks);

  return {
    userId,
    ...persistence,
  };
}
