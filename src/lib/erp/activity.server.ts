// Server-only reads for sync activity: recent runs, per-connection record counts.

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface SyncRunView {
  id: string;
  connectionId: string;
  provider: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  invoices: number;
  payments: number;
  vendors: number;
  contracts: number;
  error: string | null;
}

export interface ConnectionCounts {
  connectionId: string;
  invoices: number;
  payments: number;
  vendors: number;
  contracts: number;
}

export interface ActivityPayload {
  runs: SyncRunView[];
  counts: ConnectionCounts[];
  running: boolean;
}

export async function loadActivity(userId: string): Promise<ActivityPayload> {
  const db = await admin();

  const [runsRes, connRes, inv, pay, ven, con] = await Promise.all([
    db
      .from("erp_sync_runs")
      .select(
        "id, connection_id, status, started_at, finished_at, invoices_synced, payments_synced, vendors_synced, contracts_synced, error",
      )
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(25),
    db.from("erp_connections").select("id, provider").eq("user_id", userId),
    db.from("erp_invoices").select("connection_id").eq("user_id", userId).limit(5000),
    db.from("erp_payments").select("connection_id").eq("user_id", userId).limit(5000),
    db.from("erp_vendors").select("connection_id").eq("user_id", userId).limit(5000),
    db.from("erp_contracts").select("connection_id").eq("user_id", userId).limit(5000),
  ]);

  const providerById = new Map(
    (connRes.data ?? []).map((c) => [c.id as string, c.provider as string]),
  );

  const tally = (rows: Array<{ connection_id: string }> | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.connection_id, (m.get(r.connection_id) ?? 0) + 1);
    return m;
  };
  const invM = tally(inv.data as never);
  const payM = tally(pay.data as never);
  const venM = tally(ven.data as never);
  const conM = tally(con.data as never);

  const runs: SyncRunView[] = (runsRes.data ?? []).map((r) => ({
    id: r.id as string,
    connectionId: r.connection_id as string,
    provider: providerById.get(r.connection_id as string) ?? "unknown",
    status: r.status as string,
    startedAt: r.started_at as string,
    finishedAt: (r.finished_at as string | null) ?? null,
    invoices: (r.invoices_synced as number) ?? 0,
    payments: (r.payments_synced as number) ?? 0,
    vendors: (r.vendors_synced as number) ?? 0,
    contracts: (r.contracts_synced as number) ?? 0,
    error: (r.error as string | null) ?? null,
  }));

  return {
    runs,
    counts: [...providerById.keys()].map((id) => ({
      connectionId: id,
      invoices: invM.get(id) ?? 0,
      payments: payM.get(id) ?? 0,
      vendors: venM.get(id) ?? 0,
      contracts: conM.get(id) ?? 0,
    })),
    running: runs.some((r) => r.status === "running"),
  };
}
