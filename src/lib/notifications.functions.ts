import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface LiveNotificationItem {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: "Leak Alert" | "Recovery" | "Investigation" | "ERP Sync" | "System";
  timestamp: string;
  link?: string | undefined;
  leakId?: string | undefined;
}

export const getLiveNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ notifications: LiveNotificationItem[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const items: LiveNotificationItem[] = [];

    // 1. Fetch recent real leaks (up to 20 most recent)
    const { data: leaks } = await supabaseAdmin
      .from("erp_leaks")
      .select(
        "id, title, vendor_name, amount, currency, severity, status, detected_at, created_at, type",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    for (const leak of leaks ?? []) {
      const isCritical = leak.severity === "critical";
      const isHigh = leak.severity === "high";
      const sev = (leak.severity as "critical" | "high" | "medium" | "low") || "medium";
      const amountFmt = `${leak.currency || "USD"} ${Number(leak.amount || 0).toLocaleString()}`;

      items.push({
        id: `leak-${leak.id}`,
        title: isCritical
          ? `Critical Leak: ${leak.title}`
          : isHigh
            ? `High Severity: ${leak.title}`
            : leak.title,
        description: `${leak.vendor_name || "Unknown vendor"} · ${amountFmt} · Status: ${leak.status}`,
        severity: sev,
        category: "Leak Alert",
        timestamp: leak.detected_at || leak.created_at || new Date().toISOString(),
        link: `/leaks`,
        leakId: leak.id,
      });
    }

    // 2. Fetch recent leak workflow activity (up to 15 most recent)
    const { data: activities } = await supabaseAdmin
      .from("erp_leak_activity")
      .select("id, leak_id, action, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15);

    for (const act of activities ?? []) {
      const meta = (act.metadata ?? {}) as Record<string, any>;
      let title = "Leak workflow update";
      let desc = `Action performed on leak case`;
      let cat: LiveNotificationItem["category"] = "Investigation";

      if (act.action === "recovery_opened") {
        title = "Recovery claim opened";
        desc = `Target amount: ${meta["currency"] || "USD"} ${Number(meta["target_amount"] || 0).toLocaleString()}`;
        cat = "Recovery";
      } else if (act.action === "status_changed") {
        title = `Status updated to ${meta["to_status"] || "new status"}`;
        desc = meta["notes"]
          ? `Note: "${meta["notes"]}"`
          : `Transitioned from ${meta["from_status"] || "previous"}`;
      } else if (act.action === "assigned") {
        title = `Leak assigned to ${meta["assignee_name"] || "team member"}`;
        desc = `Assigned on ${new Date(act.created_at).toLocaleDateString()}`;
      } else if (act.action === "investigation_note") {
        title = "Investigation note added";
        desc = meta["note"]
          ? `"${String(meta["note"]).slice(0, 100)}..."`
          : "Note recorded on case";
      }

      items.push({
        id: `act-${act.id}`,
        title,
        description: desc,
        severity: "info",
        category: cat,
        timestamp: act.created_at || new Date().toISOString(),
        link: `/leaks`,
        leakId: act.leak_id,
      });
    }

    // 3. Fetch ERP connection alerts (sync issues, successful syncs)
    const { data: connections } = await supabaseAdmin
      .from("erp_connections")
      .select("id, provider, status, account_name, last_sync_at, last_error, created_at")
      .eq("user_id", userId)
      .limit(10);

    for (const conn of connections ?? []) {
      const provName =
        conn.provider === "zoho_books"
          ? "Zoho Books"
          : conn.provider === "quickbooks"
            ? "QuickBooks"
            : conn.provider === "xero"
              ? "Xero"
              : conn.provider;
      if (conn.last_error) {
        items.push({
          id: `conn-err-${conn.id}`,
          title: `Sync Error on ${provName}`,
          description: conn.last_error,
          severity: "critical",
          category: "ERP Sync",
          timestamp: conn.last_sync_at || conn.created_at || new Date().toISOString(),
          link: "/integrations",
        });
      } else if (conn.last_sync_at) {
        items.push({
          id: `conn-sync-${conn.id}`,
          title: `${provName} synchronized`,
          description: `${conn.account_name || "Organisation"} records are up-to-date`,
          severity: "info",
          category: "ERP Sync",
          timestamp: conn.last_sync_at,
          link: "/integrations",
        });
      }
    }

    // 4. If user has no connections or leaks yet, provide system onboarding notification
    if (items.length === 0) {
      items.push({
        id: "sys-welcome",
        title: "Welcome to AutoAudit",
        description:
          "Connect your accounting software (Zoho Books, Xero, or QuickBooks) to automatically detect duplicate payments and overcharges.",
        severity: "info",
        category: "System",
        timestamp: new Date().toISOString(),
        link: "/integrations",
      });
    }

    // Sort all by timestamp descending
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      notifications: items,
    };
  });
