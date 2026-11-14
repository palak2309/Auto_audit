import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const APP_ROLES = [
  "admin",
  "cfo",
  "finance_manager",
  "accountant",
  "procurement_manager",
  "auditor",
  "viewer",
] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const APP_PERMISSIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "recover",
  "manage_users",
  "manage_roles",
  "export",
  "configure",
] as const;
export type AppPermission = (typeof APP_PERMISSIONS)[number];

export interface Member {
  id: string;
  email: string;
  fullName: string | null;
  department: string | null;
  jobTitle: string | null;
  company: string | null;
  status: string;
  role: AppRole;
  lastSignInAt: string | null;
  createdAt: string | null;
}

export type Ctx = { supabase: SupabaseClient<Database>; userId: string };

export async function roleOf(context: Ctx): Promise<AppRole> {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Admin] Failed to load user role:", error);
    throw new Error(`Could not load user role: ${error.message}`);
  }

  return ((data as { role?: AppRole } | null)?.role ?? "viewer") as AppRole;
}

export async function requireAdmin(context: Ctx) {
  const role = await roleOf(context);
  if (role !== "admin") throw new Error("Forbidden: admin role required");
  return role;
}

export async function hasPermission(context: Ctx, permission: AppPermission): Promise<boolean> {
  const role = await roleOf(context);
  if (role === "admin") return true;
  const { data } = await context.supabase
    .from("role_permissions")
    .select("permission")
    .eq("role", role)
    .eq("permission", permission)
    .maybeSingle();
  return Boolean(data);
}

export async function requirePermission(context: Ctx, permission: AppPermission): Promise<AppRole> {
  const allowed = await hasPermission(context, permission);
  if (!allowed) {
    throw new Error(`Forbidden: '${permission}' permission required`);
  }
  return roleOf(context);
}

/** Current user's role, permissions and profile. */
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await roleOf(context as unknown as Ctx);
    const [{ data: perms }, { data: profile }] = await Promise.all([
      context.supabase.from("role_permissions").select("permission").eq("role", role),
      context.supabase
        .from("profiles")
        .select("full_name, company, department, job_title, status, email")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);
    return {
      userId: context.userId,
      role,
      permissions: ((perms ?? []) as { permission: AppPermission }[]).map((p) => p.permission),
      profile: (profile ?? null) as {
        full_name: string | null;
        company: string | null;
        department: string | null;
        job_title: string | null;
        status: string | null;
        email: string | null;
      } | null,
    };
  });

/** Full permission matrix (readable by any signed-in user). */
export const getPermissionMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("role_permissions")
      .select("role, permission");
    if (error) throw new Error(error.message);
    return (data ?? []) as { role: AppRole; permission: AppPermission }[];
  });

export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { role: AppRole; permission: AppPermission; enabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context as unknown as Ctx);
    if (data.role === "admin") throw new Error("The Admin role always keeps every permission.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enabled) {
      const { error } = await supabaseAdmin
        .from("role_permissions")
        .upsert(
          { role: data.role, permission: data.permission },
          { onConflict: "role,permission" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("role_permissions")
        .delete()
        .eq("role", data.role)
        .eq("permission", data.permission);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Everyone with access to this deployment. Admin only. */
export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: authUsers, error: authErr }, { data: profiles }, { data: roles }] =
      await Promise.all([
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        supabaseAdmin.from("profiles").select("*"),
        supabaseAdmin.from("user_roles").select("user_id, role"),
      ]);
    if (authErr) throw new Error(authErr.message);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id as string, p]));
    const roleMap = new Map(
      (roles ?? []).map((r: any) => [r.user_id as string, r.role as AppRole]),
    );

    const members: Member[] = (authUsers?.users ?? []).map((u) => {
      const p: any = profileMap.get(u.id) ?? {};
      return {
        id: u.id,
        email: u.email ?? p.email ?? "—",
        fullName: p.full_name ?? (u.user_metadata?.["full_name"] as string | undefined) ?? null,
        department: p.department ?? null,
        jobTitle: p.job_title ?? null,
        company: p.company ?? null,
        status: p.status ?? "active",
        role: roleMap.get(u.id) ?? "viewer",
        lastSignInAt: u.last_sign_in_at ?? null,
        createdAt: u.created_at ?? null,
      };
    });
    members.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    return members;
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string; role: AppRole }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.role !== "admin" && data.userId === context.userId) {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1)
        throw new Error("You are the last admin — promote someone else first.");
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setMemberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string; status: "active" | "suspended" }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context as unknown as Ctx);
    if (data.userId === context.userId) throw new Error("You cannot suspend your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ status: data.status })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    // Suspended users lose their active sessions immediately.
    if (data.status === "suspended") await supabaseAdmin.auth.admin.signOut(data.userId, "global");
    return { ok: true };
  });

export const updateMemberProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      userId: string;
      fullName?: string | undefined;
      department?: string | undefined;
      jobTitle?: string | undefined;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        ...(data.fullName !== undefined ? { full_name: data.fullName } : {}),
        ...(data.department !== undefined ? { department: data.department } : {}),
        ...(data.jobTitle !== undefined ? { job_title: data.jobTitle } : {}),
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      email: string;
      role: AppRole;
      fullName?: string | undefined;
      department?: string | undefined;
      password?: string | undefined;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");

    const password = data.password?.trim() || crypto.randomUUID() + "Aa1!";
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName ?? null },
    });
    if (error || !created?.user) throw new Error(error?.message ?? "Could not create the account.");

    const userId = created.user.id;
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email,
      full_name: data.fullName ?? null,
      department: data.department ?? null,
      status: "active",
    });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });

    return { ok: true, userId, email, temporaryPassword: data.password?.trim() ? null : password };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context as unknown as Ctx);
    if (data.userId === context.userId) throw new Error("You cannot remove your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
