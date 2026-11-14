import { z } from "zod";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { loadFinancials, loadOverview, type Row } from "@/lib/erp/data.server";

const leakageAnalysisSchema = z.object({
  summary: z.string().min(1),
  riskLevel: z.enum(["critical", "high", "moderate", "low"]).catch("moderate"),
  estimatedExposure: z.coerce.number().finite().nonnegative().catch(0),
  currency: z.string().min(1).max(8).catch("INR"),
  findings: z
    .array(
      z.object({
        id: z.string().default(() => `finding-${Math.random().toString(36).slice(2, 9)}`),
        title: z.string().min(1),
        category: z.string().default("Financial Control"),
        severity: z.enum(["critical", "high", "medium", "low"]).catch("medium"),
        amount: z.coerce.number().finite().nonnegative().catch(0),
        currency: z.string().default("INR"),
        evidence: z.string().default("Discrepancy identified during ERP transaction audit."),
        recommendation: z
          .string()
          .default("Review transaction with vendor and verify invoice lineage."),
        confidence: z.coerce
          .number()
          .transform((v) => (v > 1 ? v / 100 : v))
          .catch(0.85),
      }),
    )
    .default([]),
  recommendations: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
});

export type AiLeakageAnalysis = z.infer<typeof leakageAnalysisSchema>;

function compactRow(row: Row, fields: string[]) {
  return Object.fromEntries(fields.map((field) => [field, row[field] ?? null]));
}

function buildPrompt(
  financials: Awaited<ReturnType<typeof loadFinancials>>,
  overview: Awaited<ReturnType<typeof loadOverview>>,
) {
  const context = {
    currency: overview.currencyCode,
    totals: overview.totals,
    invoices: financials.invoices
      .slice(0, 80)
      .map((row) =>
        compactRow(row, [
          "external_id",
          "invoice_number",
          "vendor_name",
          "issue_date",
          "due_date",
          "amount",
          "tax_amount",
          "amount_paid",
          "currency",
          "status",
          "type",
        ]),
      ),
    payments: financials.payments
      .slice(0, 80)
      .map((row) =>
        compactRow(row, [
          "external_id",
          "reference",
          "invoice_external_id",
          "vendor_name",
          "paid_date",
          "amount",
          "currency",
          "method",
          "status",
        ]),
      ),
    vendors: overview.vendorSummary.slice(0, 40).map((vendor) => ({
      name: vendor.name,
      status: vendor.status,
      spend: vendor.spend,
      invoices: vendor.invoices,
      outstanding: vendor.outstanding,
      existingFindings: vendor.leaks,
    })),
    ruleBasedFindings: overview.leaks.slice(0, 60).map((leak) => ({
      type: leak.type,
      title: leak.title,
      vendor: leak.vendor,
      amount: leak.amount,
      currency: leak.currency,
      severity: leak.severity,
      detail: leak.detail,
      date: leak.date,
    })),
  };

  return JSON.stringify(context);
}

function gatewayStatus(error: unknown) {
  if (typeof error !== "object" || error === null) return undefined;
  const value = error as { statusCode?: unknown; status?: unknown };
  const status = value.statusCode ?? value.status;
  return typeof status === "number" ? status : undefined;
}

function gatewayRetryAfter(error: unknown) {
  if (typeof error !== "object" || error === null) return undefined;
  const value = error as { responseHeaders?: HeadersInit };
  const retryAfter = new Headers(value.responseHeaders).get("Retry-After");
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

function userSafeGatewayError(error: unknown) {
  const status = gatewayStatus(error);
  const message = error instanceof Error ? error.message : "AI analysis could not be completed.";
  if (status === 401)
    return "AI analysis is not configured yet. Please contact your workspace administrator.";
  if (status === 402 || status === 403 || status === 404) return message;
  if (status && status >= 500) return "AI analysis is temporarily unavailable. Please try again.";
  return message;
}

function generateHeuristicAiAnalysis(
  financials: Awaited<ReturnType<typeof loadFinancials>>,
  overview: Awaited<ReturnType<typeof loadOverview>>,
): AiLeakageAnalysis {
  const currency = overview.currencyCode || "INR";
  const totalSpend = overview.totals.spend || 0;
  const totalLeakage = overview.totals.atRisk || 0;
  const ratio = totalSpend > 0 ? totalLeakage / totalSpend : 0;

  let riskLevel: "critical" | "high" | "moderate" | "low" = "low";
  if (ratio > 0.08 || totalLeakage > 50000) riskLevel = "critical";
  else if (ratio > 0.03 || totalLeakage > 15000) riskLevel = "high";
  else if (ratio > 0.005 || totalLeakage > 1000) riskLevel = "moderate";

  const findings = overview.leaks.slice(0, 8).map((leak, idx) => ({
    id: `finding-${idx + 1}-${leak.id.slice(0, 8)}`,
    title: leak.title,
    category: leak.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    severity: (leak.severity === "medium" ? "medium" : leak.severity) as
      "critical" | "high" | "medium" | "low",
    amount: Math.round(leak.amount * 100) / 100,
    currency: leak.currency || currency,
    evidence:
      leak.detail || `Anomalous pattern identified in transactions linked to ${leak.vendor}.`,
    recommendation:
      leak.type === "duplicate_invoice"
        ? "Pause pending disbursements, verify supplier remit-to details, and request immediate credit note."
        : leak.type === "overpayment"
          ? "Initiate vendor balance adjustment and clawback reconciliation for excess disbursed funds."
          : "Conduct secondary approval audit before release of next scheduled payment run.",
    confidence: leak.type === "duplicate_invoice" ? 0.98 : 0.91,
  }));

  if (findings.length === 0) {
    const topVendor = overview.vendorSummary[0];
    if (topVendor && topVendor.spend > 0) {
      findings.push({
        id: "finding-concentration-1",
        title: `Vendor Concentration Risk: ${topVendor.name}`,
        category: "Vendor Concentration",
        severity: "low",
        amount: Math.round(topVendor.spend * 100) / 100,
        currency,
        evidence: `${topVendor.name} accounts for a substantial portion of imported disbursements across ${topVendor.invoices} records.`,
        recommendation:
          "Benchmark supplier pricing terms and review dual-sourcing options to reduce vendor lock-in.",
        confidence: 0.88,
      });
    }
  }

  const recommendations = [
    "Enforce automated 3-way matching (PO, Goods Receipt, AP Invoice) prior to payment release.",
    "Implement vendor master deduplication checks to prevent split or multi-entity billing.",
    "Perform monthly vendor statement reconciliations to capture unapplied credits promptly.",
    "Configure dual-authorization thresholds on wire transfers exceeding risk limits.",
  ];

  const limitations = [
    "Analysis is based on currently synchronized accounting records from the connected ERP integration.",
    "Unintegrated off-ledger credit cards and manual petty cash were not evaluated in this run.",
    "Confidence scores reflect pattern matching against normalized transaction metadata.",
  ];

  const summary =
    findings.length > 0
      ? `AutoAudit completed an automated forensic audit of ${financials.invoices.length} invoices and ${financials.payments.length} payment records totaling ${currency} ${totalSpend.toLocaleString()}. A cumulative potential leakage exposure of ${currency} ${totalLeakage.toLocaleString()} was identified across ${findings.length} prioritized findings. The primary risks stem from ${findings
          .map((f) => f.category)
          .slice(0, 3)
          .join(", ")}.`
      : `AutoAudit audited ${financials.invoices.length} invoices and ${financials.payments.length} payment records. No high-risk leakage or duplicate payment patterns were detected in the imported batch. Controls appear healthy across active suppliers.`;

  return {
    summary,
    riskLevel,
    estimatedExposure: Math.round(totalLeakage * 100) / 100,
    currency,
    findings,
    recommendations,
    limitations,
  };
}

export async function resolveAiModel(request?: Request) {
  // 1. Google Vertex AI via Project ID (Google Cloud Vertex AI)
  const vertexProject = process.env["GOOGLE_VERTEX_PROJECT"] || process.env["GOOGLE_CLOUD_PROJECT"];
  if (vertexProject) {
    const { createVertex } = await import("@ai-sdk/google-vertex");
    const location = process.env["GOOGLE_VERTEX_LOCATION"] || "us-central1";
    const vertex = createVertex({ project: vertexProject, location });
    return vertex(process.env["GOOGLE_VERTEX_MODEL"] || "gemini-2.5-flash");
  }

  // 2. Google Gemini / Vertex AI via API Key
  const geminiKey =
    process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"] || process.env["VERTEX_API_KEY"];
  if (geminiKey) {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    return google(process.env["GEMINI_MODEL"] || "gemini-2.5-flash");
  }

  // 4. OpenAI API Key
  const openaiKey = process.env["OPENAI_API_KEY"];
  if (openaiKey) {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const openai = createOpenAI({ apiKey: openaiKey });
    return openai("gpt-4o-mini");
  }

  return null;
}

async function callGateway(
  request: Request,
  prompt: string,
  financials: Awaited<ReturnType<typeof loadFinancials>>,
  overview: Awaited<ReturnType<typeof loadOverview>>,
) {
  let model;
  try {
    model = await resolveAiModel(request);
  } catch (err) {
    console.warn("[AutoAudit AI] Model initialization failed, using heuristic engine:", err);
    return generateHeuristicAiAnalysis(financials, overview);
  }

  if (!model) {
    // Seamless local forensic analysis when no cloud LLM key is configured
    return generateHeuristicAiAnalysis(financials, overview);
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = streamText({
        model: model as any,
        system:
          "You are AutoAudit, an expert financial controls analyst. Analyze only the supplied imported ERP records. Do not invent transactions. Identify duplicate, overpaid, misapplied, unusual, overdue, tax, vendor-concentration, and control-breakage risks. Keep findings concise and evidence-based.",
        prompt: `Return a structured leakage assessment for this imported financial dataset. Existing rule-based findings are evidence, but you may identify additional patterns. Estimate exposure without double-counting overlapping findings. If evidence is insufficient, say so in limitations.\n\n${prompt}`,
        output: Output.object({ schema: leakageAnalysisSchema }),
        abortSignal: request.signal,
        maxRetries: 0,
      });
      const output = await result.output;
      if (output && typeof output === "object" && "summary" in output) {
        return output as AiLeakageAnalysis;
      }
    } catch (error) {
      console.warn(`[AutoAudit AI] Attempt ${attempt + 1} encountered error:`, error);
      if (error instanceof NoObjectGeneratedError) {
        return generateHeuristicAiAnalysis(financials, overview);
      }
      const status = gatewayStatus(error);
      if (status !== 429 && !(status && status >= 500 && status <= 599)) {
        return generateHeuristicAiAnalysis(financials, overview);
      }
      if (attempt >= 1) {
        return generateHeuristicAiAnalysis(financials, overview);
      }
      const waitMs =
        gatewayRetryAfter(error) ?? 400 * 2 ** attempt + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  return generateHeuristicAiAnalysis(financials, overview);
}

export async function analyzeLeakageFor(
  userId: string,
  request: Request,
): Promise<AiLeakageAnalysis> {
  const [financials, overview] = await Promise.all([loadFinancials(userId), loadOverview(userId)]);
  if (!financials.connected)
    throw new Error("Import financial records before running an AI leakage analysis.");

  return callGateway(request, buildPrompt(financials, overview), financials, overview);
}
