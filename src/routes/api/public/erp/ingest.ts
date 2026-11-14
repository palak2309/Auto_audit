import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const VendorSchema = z.object({
  external_id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  raw: z.unknown().optional(),
});

const InvoiceSchema = z.object({
  external_id: z.string().min(1),
  invoice_number: z.string().optional().nullable(),
  vendor_name: z.string().min(1),
  vendor_external_id: z.string().optional().nullable(),
  issue_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  amount: z.number(),
  tax_amount: z.number().optional().nullable(),
  amount_paid: z.number().optional().nullable(),
  currency: z.string().optional().nullable().default("INR"),
  status: z.string().optional().nullable().default("OPEN"),
  type: z.string().optional().nullable().default("bill"),
  raw: z.unknown().optional(),
});

const PaymentSchema = z.object({
  external_id: z.string().min(1),
  reference: z.string().optional().nullable(),
  invoice_external_id: z.string().optional().nullable(),
  vendor_name: z.string().optional().nullable(),
  paid_date: z.string().optional().nullable(),
  amount: z.number(),
  currency: z.string().optional().nullable().default("INR"),
  method: z.string().optional().nullable().default("BANK_TRANSFER"),
  status: z.string().optional().nullable().default("PAID"),
  type: z.string().optional().nullable().default("payment"),
  raw: z.unknown().optional(),
});

const IngestPayloadSchema = z.object({
  apiKey: z.string().optional(),
  accountName: z.string().optional().default("Custom ERP System"),
  vendors: z.array(VendorSchema).optional().default([]),
  invoices: z.array(InvoiceSchema).optional().default([]),
  payments: z.array(PaymentSchema).optional().default([]),
});

export const Route = createFileRoute("/api/public/erp/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader =
            request.headers.get("authorization") || request.headers.get("x-api-key") || "";
          const headerKey = authHeader.replace(/^Bearer\s+/i, "").trim();

          const json = await request.json().catch(() => ({}));
          const parsed = IngestPayloadSchema.safeParse(json);

          if (!parsed.success) {
            return new Response(
              JSON.stringify({
                error: "Invalid request payload",
                details: parsed.error.issues,
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const apiKey = headerKey || (parsed.data.apiKey ? parsed.data.apiKey.trim() : "");
          if (!apiKey) {
            return new Response(
              JSON.stringify({
                error: "Unauthorized",
                message:
                  "A valid Bearer token or tenant API key is required to ingest ERP records.",
              }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Cryptographically verify caller token against Supabase Auth:
          let targetUserId: string | null = null;
          try {
            const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(apiKey);
            if (!authErr && authData?.user?.id) {
              targetUserId = authData.user.id;
            }
          } catch {
            // Token verification failed
          }

          // Strict fail-closed: Reject unauthorized requests immediately
          if (!targetUserId) {
            return new Response(
              JSON.stringify({
                error: "Unauthorized",
                message: "Invalid or expired authentication credentials. Access denied.",
              }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          // Ensure an active ERP connection exists for "custom_api"
          let connectionId: string;
          const { data: existingConn } = await supabaseAdmin
            .from("erp_connections")
            .select("id")
            .eq("user_id", targetUserId)
            .eq("provider", "custom_api")
            .maybeSingle();

          if (existingConn?.id) {
            connectionId = existingConn.id;
            await supabaseAdmin
              .from("erp_connections")
              .update({
                account_name: parsed.data.accountName,
                status: "connected",
                last_sync_at: new Date().toISOString(),
                last_error: null,
              })
              .eq("id", connectionId);
          } else {
            const { data: newConn, error: connErr } = await supabaseAdmin
              .from("erp_connections")
              .insert({
                user_id: targetUserId,
                provider: "custom_api",
                account_name: parsed.data.accountName,
                status: "connected",
                last_sync_at: new Date().toISOString(),
                credentials_ciphertext: "direct_api_ingestion",
              })
              .select("id")
              .single();

            if (connErr || !newConn) {
              throw new Error(`Failed to create connection: ${connErr?.message || "unknown"}`);
            }
            connectionId = newConn.id;
          }

          // Format rows for upsert
          const vendorRows = parsed.data.vendors.map((v) => ({
            user_id: targetUserId,
            connection_id: connectionId,
            external_id: v.external_id,
            name: v.name,
            email: v.email ?? null,
            phone: v.phone ?? null,
            status: v.status ?? "ACTIVE",
            raw: (v.raw ?? v) as never,
          }));

          const invoiceRows = parsed.data.invoices.map((i) => ({
            user_id: targetUserId,
            connection_id: connectionId,
            external_id: i.external_id,
            invoice_number: i.invoice_number ?? i.external_id,
            vendor_name: i.vendor_name,
            vendor_external_id: i.vendor_external_id ?? null,
            issue_date: i.issue_date ?? new Date().toISOString().slice(0, 10),
            due_date: i.due_date ?? null,
            amount: i.amount,
            tax_amount: i.tax_amount ?? 0,
            amount_paid: i.amount_paid ?? 0,
            currency: i.currency ?? "INR",
            status: i.status ?? "OPEN",
            type: i.type ?? "bill",
            raw: (i.raw ?? i) as never,
          }));

          const paymentRows = parsed.data.payments.map((p) => ({
            user_id: targetUserId,
            connection_id: connectionId,
            external_id: p.external_id,
            reference: p.reference ?? p.external_id,
            invoice_external_id: p.invoice_external_id ?? null,
            vendor_name: p.vendor_name ?? "Unknown Vendor",
            paid_date: p.paid_date ?? new Date().toISOString().slice(0, 10),
            amount: p.amount,
            currency: p.currency ?? "INR",
            method: p.method ?? "BANK_TRANSFER",
            status: p.status ?? "PAID",
            type: p.type ?? "payment",
            raw: (p.raw ?? p) as never,
          }));

          // Upsert data idempotently
          if (vendorRows.length > 0) {
            const { error: vErr } = await supabaseAdmin
              .from("erp_vendors")
              .upsert(vendorRows, { onConflict: "connection_id,external_id" });
            if (vErr) throw new Error(`Vendor ingest error: ${vErr.message}`);
          }

          if (invoiceRows.length > 0) {
            const { error: iErr } = await supabaseAdmin
              .from("erp_invoices")
              .upsert(invoiceRows, { onConflict: "connection_id,external_id" });
            if (iErr) throw new Error(`Invoice ingest error: ${iErr.message}`);
          }

          if (paymentRows.length > 0) {
            const { error: pErr } = await supabaseAdmin
              .from("erp_payments")
              .upsert(paymentRows as any, { onConflict: "connection_id,external_id" });
            if (pErr) throw new Error(`Payment ingest error: ${pErr.message}`);
          }

          // Record sync run
          const { error: runErr } = await supabaseAdmin.from("erp_sync_runs").insert({
            connection_id: connectionId,
            user_id: targetUserId,
            status: "success",
            started_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
            vendors_synced: vendorRows.length,
            invoices_synced: invoiceRows.length,
            payments_synced: paymentRows.length,
          });

          if (runErr) {
            console.warn("[AutoAudit Ingest] Failed to record sync run:", runErr.message);
          }

          // Execute automated audit leak detection & persistence immediately
          const { detectAndPersistLeaksForUser } =
            await import("@/lib/erp/leak-persistence.server");
          const auditResult = await detectAndPersistLeaksForUser(targetUserId);

          return new Response(
            JSON.stringify({
              success: true,
              message: "Custom ERP financial batch ingested and audited successfully",
              connectionId,
              counts: {
                vendors: vendorRows.length,
                invoices: invoiceRows.length,
                payments: paymentRows.length,
              },
              auditSummary: {
                totalLeaksDetected: auditResult.total,
                newLeaksInserted: auditResult.inserted,
                leaksUpdated: auditResult.updated,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[AutoAudit Ingest] Ingestion failed:", message);
          return new Response(
            JSON.stringify({
              success: false,
              error: message,
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },
  },
});
