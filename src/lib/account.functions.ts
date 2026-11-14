import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccountState = "unknown" | "unconfirmed" | "confirmed" | "blocked";

export interface AccountStatus {
  state: AccountState;
  email: string;
}

/**
 * Looks up the sign-in readiness of an email address so the login screen can
 * tell the user exactly what to do next.
 */
export const getAccountStatus = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => ({
    email: String(input.email ?? "")
      .trim()
      .toLowerCase(),
  }))
  .handler(async ({ data }): Promise<AccountStatus> => {
    if (!data.email || !data.email.includes("@")) return { state: "unknown", email: data.email };
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"] && !process.env["SUPABASE_SECRET_KEY"]) {
      // In environments without service role key, skip admin user lookup
      // and allow standard password authentication to proceed.
      return { state: "unknown", email: data.email };
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const user = list?.users?.find((u) => (u.email ?? "").toLowerCase() === data.email);
      if (!user) return { state: "unknown", email: data.email };

      if (user.banned_until && new Date(user.banned_until as string).getTime() > Date.now()) {
        return { state: "blocked", email: data.email };
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("status")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.status && profile.status !== "active")
        return { state: "blocked", email: data.email };

      return { state: user.email_confirmed_at ? "confirmed" : "unconfirmed", email: data.email };
    } catch (error) {
      // Account lookup is only guidance for the sign-in form. If Cloud is
      // briefly unavailable, let password auth return its normal error rather
      // than blanking the page because this optional lookup failed.
      console.error("Account status lookup unavailable", error);
      return { state: "unknown", email: data.email };
    }
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      fullName?: string | undefined;
      department?: string | undefined;
      jobTitle?: string | undefined;
      company?: string | undefined;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.fullName !== undefined) updates["full_name"] = data.fullName.trim();
    if (data.department !== undefined) updates["department"] = data.department.trim();
    if (data.jobTitle !== undefined) updates["job_title"] = data.jobTitle.trim();
    if (data.company !== undefined) updates["company"] = data.company.trim();

    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, ...updates }, { onConflict: "id" });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Permanently deletes the authenticated user's account and all associated tenant data.
 * Complies with Apple App Store Account Deletion guidelines & GDPR/DPDP Right to Erasure.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    if (!userId) {
      throw new Error("Unauthorized: Invalid user session");
    }

    // Explicitly delete user record from Supabase Auth admin API.
    // Foreign key constraints on all 27 tables have ON DELETE CASCADE,
    // which automatically purges all invoices, bills, payments, customers, leaks, and profiles.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("[Account Deletion Error]:", error);
      throw new Error(`Failed to delete account: ${error.message}`);
    }

    return { success: true };
  });
