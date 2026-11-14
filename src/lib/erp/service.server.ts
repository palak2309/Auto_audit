// Server-only orchestration for ERP/accounting connections.
import { randomBytes } from "node:crypto";
import {
  buildAuthorizeUrl,
  dbConfiguredProviderIds,
  envProviderConfigured,
  packTokens,
  providerConfigured,
  unpackTokens,
  type StoredTokens,
} from "./oauth.server";
import { pullProviderData } from "./sync.server";
import { ERP_PROVIDERS } from "./providers";
import { detectAndPersistLeaksForUser } from "./leak-persistence.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function configuredProviders(): Promise<string[]> {
  const dbIds = await dbConfiguredProviderIds();
  const envIds = ERP_PROVIDERS.filter((p) => p.oauth && envProviderConfigured(p.id)).map(
    (p) => p.id,
  );
  return [...new Set([...dbIds, ...envIds])];
}

export async function providerConfigStatus(): Promise<
  Array<{ provider: string; configured: boolean; source: "database" | "env" | "none" }>
> {
  const dbIds = new Set(await dbConfiguredProviderIds());
  return ERP_PROVIDERS.filter((p) => p.oauth).map((p) => ({
    provider: p.id,
    configured: dbIds.has(p.id) || envProviderConfigured(p.id),
    source: dbIds.has(p.id)
      ? ("database" as const)
      : envProviderConfigured(p.id)
        ? ("env" as const)
        : ("none" as const),
  }));
}

export async function listConnectionsFor(userId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("erp_connections")
    .select("id, provider, account_name, status, last_sync_at, last_error")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    provider: r.provider as string,
    accountName: (r.account_name as string | null) ?? null,
    status: r.status as string,
    lastSyncAt: (r.last_sync_at as string | null) ?? null,
    lastError: (r.last_error as string | null) ?? null,
  }));
}

export async function beginOAuth(userId: string, provider: string, origin: string) {
  if (!(await providerConfigured(provider))) {
    throw new Error(
      `${provider} is not configured yet. Add the developer app credentials for this provider before connecting.`,
    );
  }
  const state = randomBytes(24).toString("hex");
  const db = await admin();
  const safeOrigin =
    origin && origin !== "null" && origin !== "undefined"
      ? origin
      : "https://auto-audit-nu.vercel.app";
  const { error } = await db.from("erp_oauth_states").insert({
    state,
    user_id: userId,
    provider,
    origin: safeOrigin,
  });
  if (error) throw new Error(error.message);
  return { url: await buildAuthorizeUrl(provider, state, safeOrigin) };
}

export async function completeOAuth(params: {
  state: string;
  code: string;
  origin: string;
  realmId?: string | undefined;
  location?: string | undefined;
  accountsServer?: string | undefined;
}) {
  const db = await admin();
  const { data: stateRow } = await db
    .from("erp_oauth_states")
    .select("state, user_id, provider, origin, created_at")
    .eq("state", params.state)
    .maybeSingle();
  if (!stateRow) throw new Error("This connection request expired. Start the connection again.");
  await db.from("erp_oauth_states").delete().eq("state", params.state);

  const provider = stateRow.provider as string;
  const userId = stateRow.user_id as string;
  const effectiveOrigin =
    params.origin || (stateRow.origin as string) || "https://auto-audit-nu.vercel.app";
  const { exchangeCode } = await import("./oauth.server");
  let tokens: StoredTokens = await exchangeCode(
    provider,
    params.code,
    effectiveOrigin,
    params.accountsServer,
  );
  if (params.realmId) tokens = { ...tokens, realm_id: params.realmId };
  if (params.accountsServer) tokens = { ...tokens, auth_server: params.accountsServer };

  if (provider === "zoho_books") {
    // Priority: 1) api_domain from token response (authoritative for user's account DC)
    //           2) location param from callback URL
    //           3) dc from erp_provider_config extra_config
    const LOCATION_TO_DOMAIN: Record<string, string> = {
      us: "https://www.zohoapis.com",
      com: "https://www.zohoapis.com",
      in: "https://www.zohoapis.in",
      eu: "https://www.zohoapis.eu",
      au: "https://www.zohoapis.com.au",
      jp: "https://www.zohoapis.jp",
      ca: "https://www.zohoapis.ca",
    };
    if (!tokens.api_domain) {
      const locationDomain = params.location
        ? LOCATION_TO_DOMAIN[params.location.toLowerCase()]
        : undefined;
      if (locationDomain) {
        tokens = { ...tokens, api_domain: locationDomain };
      } else {
        const { data: cfg } = await db
          .from("erp_provider_config")
          .select("extra_config")
          .eq("provider", "zoho_books")
          .maybeSingle();
        const dc = (cfg?.extra_config as Record<string, string> | null)?.["dc"] ?? "com";
        tokens = { ...tokens, api_domain: LOCATION_TO_DOMAIN[dc] ?? "https://www.zohoapis.com" };
      }
    }
  }

  const { data: existing } = await db
    .from("erp_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  let connectionId: string;
  if (existing) {
    connectionId = existing.id as string;
    await db
      .from("erp_connections")
      .update({ status: "connected", credentials_ciphertext: packTokens(tokens), last_error: null })
      .eq("id", connectionId);
  } else {
    const { data: inserted, error } = await db
      .from("erp_connections")
      .insert({
        user_id: userId,
        provider,
        status: "connected",
        credentials_ciphertext: packTokens(tokens),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    connectionId = inserted!.id as string;
  }

  // Immediately pull the account's real data so the app is never empty.
  try {
    await syncConnectionFor(userId, connectionId);
  } catch (err) {
    await db
      .from("erp_connections")
      .update({ last_error: err instanceof Error ? err.message : String(err) })
      .eq("id", connectionId);
  }
  return { provider, connectionId };
}

export async function disconnectFor(userId: string, connectionId: string) {
  const db = await admin();
  const { error } = await db
    .from("erp_connections")
    .delete()
    .eq("id", connectionId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function syncConnectionFor(userId: string, connectionId: string) {
  const db = await admin();
  const { data: conn, error } = await db
    .from("erp_connections")
    .select("id, provider, credentials_ciphertext")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!conn) throw new Error("Connection not found");
  if (!conn.credentials_ciphertext)
    throw new Error("This connection has no stored credentials — reconnect it.");

  const { data: run } = await db
    .from("erp_sync_runs")
    .insert({ user_id: userId, connection_id: connectionId, status: "running" })
    .select("id")
    .single();

  try {
    const tokens = unpackTokens(conn.credentials_ciphertext as string);
    const { data } = await pullProviderData(conn.provider as string, tokens);

    const vendorRows = data.vendors.map((v) => ({
      user_id: userId,
      connection_id: connectionId,
      external_id: v.external_id,
      name: v.name,
      email: v.email ?? null,
      phone: v.phone ?? null,
      status: v.status ?? null,
      raw: v.raw as never,
    }));
    const invoiceRows = data.invoices.map((i) => ({
      user_id: userId,
      connection_id: connectionId,
      external_id: i.external_id,
      invoice_number: i.invoice_number ?? null,
      vendor_name: i.vendor_name ?? null,
      vendor_external_id: i.vendor_external_id ?? null,
      issue_date: i.issue_date ?? null,
      due_date: i.due_date ?? null,
      issued_at: i.issue_date ? `${i.issue_date}T00:00:00Z` : null,
      due_at: i.due_date ? `${i.due_date}T00:00:00Z` : null,
      customer_name: i.type === "invoice" ? (i.vendor_name ?? null) : null,
      amount: i.amount ?? 0,
      tax_amount: i.tax_amount ?? null,
      amount_paid: i.amount_paid ?? null,
      currency: i.currency || "USD",
      status: i.status || "OPEN",
      type: i.type ?? null,
      raw: i.raw as never,
    }));
    const paymentRows = data.payments.map((p) => ({
      user_id: userId,
      connection_id: connectionId,
      external_id: p.external_id,
      reference: p.reference ?? null,
      invoice_external_id: p.invoice_external_id ?? null,
      vendor_name: p.vendor_name ?? null,
      contact_name: p.vendor_name ?? null,
      paid_date: p.paid_date ?? null,
      payment_date: p.paid_date ? `${p.paid_date}T00:00:00Z` : null,
      amount: p.amount ?? 0,
      currency: p.currency || "USD",
      method: p.method ?? null,
      status: p.status || "PAID",
      type: p.type ?? "payment",
      raw: p.raw as never,
    }));

    if (vendorRows.length) {
      const { error: e } = await db
        .from("erp_vendors")
        .upsert(vendorRows, { onConflict: "connection_id,external_id" });
      if (e) throw new Error(e.message);
    }
    if (invoiceRows.length) {
      const { error: e } = await db
        .from("erp_invoices")
        .upsert(invoiceRows as any, { onConflict: "connection_id,external_id" });
      if (e) throw new Error(e.message);
    }
    if (paymentRows.length) {
      const { error: e } = await db
        .from("erp_payments")
        .upsert(paymentRows as any, { onConflict: "connection_id,external_id" });
      if (e) throw new Error(e.message);
    }

    await db
      .from("erp_connections")
      .update({
        status: "connected",
        account_name: data.accountName,
        last_sync_at: new Date().toISOString(),
        last_error: null,
        credentials_ciphertext: packTokens(data.tokens),
      })
      .eq("id", connectionId);

    if (run) {
      await db
        .from("erp_sync_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          vendors_synced: vendorRows.length,
          invoices_synced: invoiceRows.length,
          payments_synced: paymentRows.length,
        })
        .eq("id", run.id);
    }

    // Run idempotent leak detection and persistence on the freshly synced records
    let persistenceResult = { total: 0, inserted: 0, updated: 0, error: null as string | null };
    try {
      const res = await detectAndPersistLeaksForUser(userId);
      persistenceResult = {
        total: res.total,
        inserted: res.inserted,
        updated: res.updated,
        error: null,
      };
    } catch (persistErr) {
      const message = persistErr instanceof Error ? persistErr.message : String(persistErr);
      console.error(
        "[AutoAudit Persistence] Failed to persist detected leaks for user:",
        userId,
        message,
      );
      persistenceResult.error = message;
    }

    return {
      vendors: vendorRows.length,
      invoices: invoiceRows.length,
      payments: paymentRows.length,
      accountName: data.accountName,
      leaksDetected: persistenceResult.total,
      leaksPersisted: persistenceResult.inserted + persistenceResult.updated,
      persistenceError: persistenceResult.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .from("erp_connections")
      .update({ status: "error", last_error: message })
      .eq("id", connectionId);
    if (run) {
      await db
        .from("erp_sync_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), error: message })
        .eq("id", run.id);
    }
    throw new Error(message);
  }
}

export async function saveProviderCredentialsFor(
  userId: string,
  provider: string,
  clientId: string,
  clientSecret: string,
  dataCenter?: string,
) {
  const { saveDbConfig } = await import("./oauth.server");
  const extra: Record<string, string> = {};
  if (dataCenter) extra["dc"] = dataCenter;
  await saveDbConfig(provider, clientId, clientSecret, extra, userId);
  return { ok: true };
}
