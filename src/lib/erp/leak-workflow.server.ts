import type { Database, Json } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/admin.functions";

type LeakRow = Database["public"]["Tables"]["erp_leaks"]["Row"];
type ActivityRow = Database["public"]["Tables"]["erp_leak_activity"]["Row"];
type RecoveryCaseRow = Database["public"]["Tables"]["erp_recovery_cases"]["Row"];

export type LeakStatus = "detected" | "investigating" | "recovering" | "recovered" | "dismissed";
export type RecoveryStage =
  "identified" | "vendor_contacted" | "claim_filed" | "credit_issued" | "recovered";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ---------------------------------------------------------------------------
// Transition Validators
// ---------------------------------------------------------------------------

const ALLOWED_LEAK_TRANSITIONS: Record<LeakStatus, LeakStatus[]> = {
  detected: ["investigating", "dismissed"],
  investigating: ["recovering", "dismissed"],
  recovering: ["recovered"],
  recovered: [],
  dismissed: [],
};

export function isValidLeakTransition(from: LeakStatus, to: LeakStatus): boolean {
  if (from === to) return true;
  return ALLOWED_LEAK_TRANSITIONS[from]?.includes(to) ?? false;
}

const ALLOWED_RECOVERY_TRANSITIONS: Record<RecoveryStage, RecoveryStage[]> = {
  identified: ["vendor_contacted", "claim_filed"],
  vendor_contacted: ["claim_filed", "credit_issued", "recovered"],
  claim_filed: ["credit_issued", "recovered"],
  credit_issued: ["recovered"],
  recovered: [],
};

export function isValidRecoveryTransition(from: RecoveryStage, to: RecoveryStage): boolean {
  if (from === to) return true;
  return ALLOWED_RECOVERY_TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// Tenancy & Authorization Checks
// ---------------------------------------------------------------------------

/**
 * Validates that the authenticated caller has access to the specified leak.
 * Strict Tenancy Rule:
 * In accordance with Step 1 and the application's user_id ownership model,
 * financial leak records are strictly scoped to the owning tenant (user_id)
 * or a member explicitly assigned to the case (assigned_to).
 * Cross-user access (even for admins) is prohibited to prevent tenant leakage.
 */
async function getAuthorizedLeak(
  leakId: string,
  userId: string,
  _role: AppRole,
  requireModify = false,
): Promise<LeakRow> {
  const db = await admin();
  const { data: leak, error } = await db
    .from("erp_leaks")
    .select("*")
    .eq("id", leakId)
    .maybeSingle();

  if (error || !leak) {
    throw new Error("Leak finding not found");
  }

  const isOwner = leak.user_id === userId;
  const isAssignee = leak.assigned_to === userId;

  if (requireModify) {
    if (!isOwner && !isAssignee) {
      throw new Error("Forbidden: You do not have permission to modify this leak");
    }
  } else {
    if (!isOwner && !isAssignee) {
      throw new Error("Forbidden: Access denied to this leak");
    }
  }

  return leak;
}

/**
 * Validates that the authenticated caller has access to the specified recovery case.
 * Strictly scoped to the owning tenant (user_id) or the recovery owner (owner_id).
 */
async function getAuthorizedRecoveryCase(
  recoveryCaseId: string,
  userId: string,
  _role: AppRole,
  requireModify = false,
): Promise<RecoveryCaseRow> {
  const db = await admin();
  const { data: recoveryCase, error } = await db
    .from("erp_recovery_cases")
    .select("*")
    .eq("id", recoveryCaseId)
    .maybeSingle();

  if (error || !recoveryCase) {
    throw new Error("Recovery case not found");
  }

  const isOwner = recoveryCase.user_id === userId;
  const isCaseOwner = recoveryCase.owner_id === userId;

  if (requireModify) {
    if (!isOwner && !isCaseOwner) {
      throw new Error("Forbidden: You do not have permission to modify this recovery case");
    }
  } else {
    if (!isOwner && !isCaseOwner) {
      throw new Error("Forbidden: Access denied to this recovery case");
    }
  }

  return recoveryCase;
}

// ---------------------------------------------------------------------------
// Workflow Mutations
// ---------------------------------------------------------------------------

export interface UpdateLeakStatusInput {
  userId: string;
  role: AppRole;
  leakId: string;
  status: LeakStatus;
  expectedStatus?: LeakStatus | undefined;
  notes?: string | null | undefined;
}

/**
 * Transitions a leak status with strict state validation and atomic audit logging.
 * Uses atomic PostgreSQL database function (workflow_update_leak_status) with row lock (FOR UPDATE),
 * preventing lost updates and race conditions under concurrent requests.
 */
export async function updateLeakStatusForUser(
  input: UpdateLeakStatusInput,
): Promise<{ leak: LeakRow; activityId: string }> {
  const { userId, role, leakId, status: nextStatus, expectedStatus, notes } = input;
  const db = await admin();

  const currentLeak = await getAuthorizedLeak(leakId, userId, role, true);
  const currentStatus = currentLeak.status as LeakStatus;

  if (currentStatus === nextStatus) {
    return { leak: currentLeak, activityId: "" };
  }

  if (!isValidLeakTransition(currentStatus, nextStatus)) {
    throw new Error(
      `Cannot transition leak from ${currentStatus} to ${nextStatus}. Allowed transitions: ${(ALLOWED_LEAK_TRANSITIONS[currentStatus] || []).join(", ") || "none"}`,
    );
  }

  // 1. Attempt single-transaction database RPC with row locking
  try {
    const { data: rpcResult, error: rpcErr } = await db.rpc(
      "workflow_update_leak_status" as any,
      {
        p_leak_id: leakId,
        p_actor_id: userId,
        p_next_status: nextStatus,
        p_expected_status: expectedStatus ?? currentStatus,
        p_notes: notes ?? null,
      } as any,
    );

    if (!rpcErr && rpcResult && (rpcResult as any).success) {
      return {
        leak: (rpcResult as any).leak as LeakRow,
        activityId: ((rpcResult as any).activity_id as string) ?? "",
      };
    }

    if (rpcErr) {
      if (rpcErr.code === "40001" || rpcErr.code === "22023" || rpcErr.code === "P0002") {
        throw new Error(rpcErr.message);
      }
    }
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes("Concurrency conflict") ||
        err.message.includes("Cannot transition") ||
        err.message.includes("Leak finding not found"))
    ) {
      throw err;
    }
  }

  // 2. Application-level fallback with strict optimistic concurrency check
  const now = new Date().toISOString();
  const isTerminal = nextStatus === "recovered" || nextStatus === "dismissed";
  const resolvedAt = isTerminal ? now : null;
  const resolutionNotes = isTerminal && notes ? notes.trim() : currentLeak.resolution_notes;
  const expStatus = expectedStatus ?? currentStatus;

  const { data: updatedLeak, error: updateErr } = await db
    .from("erp_leaks")
    .update({
      status: nextStatus,
      resolved_at: resolvedAt,
      resolution_notes: resolutionNotes,
      updated_at: now,
    })
    .eq("id", leakId)
    .eq("status", expStatus) // Conditional update prevents concurrent stale overwrite
    .select()
    .single();

  if (updateErr || !updatedLeak) {
    const { data: checkLeak } = await db
      .from("erp_leaks")
      .select("status")
      .eq("id", leakId)
      .maybeSingle();
    if (checkLeak && checkLeak.status !== expStatus) {
      throw new Error(
        `Concurrency conflict: Leak status was modified from ${expStatus} to ${checkLeak.status} by another request`,
      );
    }
    throw new Error(`Failed to update leak status: ${updateErr?.message ?? "unknown error"}`);
  }

  const { data: activity, error: auditErr } = await db
    .from("erp_leak_activity")
    .insert({
      leak_id: leakId,
      user_id: currentLeak.user_id,
      actor_id: userId,
      action: "status_change",
      metadata: {
        from: expStatus,
        to: nextStatus,
        notes: notes ? notes.trim() : null,
      } as Json,
    })
    .select("id")
    .single();

  if (auditErr || !activity) {
    // Immediate compensating rollback on audit insertion failure
    await db
      .from("erp_leaks")
      .update({
        status: expStatus,
        resolved_at: currentLeak.resolved_at,
        resolution_notes: currentLeak.resolution_notes,
        updated_at: currentLeak.updated_at,
      })
      .eq("id", leakId);

    throw new Error(
      `Failed to record audit trail: ${auditErr?.message ?? "unknown error"}. Mutation was rolled back.`,
    );
  }

  return { leak: updatedLeak, activityId: activity.id };
}

export interface AssignLeakInput {
  userId: string;
  role: AppRole;
  leakId: string;
  memberUserId: string | null;
}

/**
 * Assigns or reassigns a leak to an active member within the workspace.
 * Uses atomic PostgreSQL database function (workflow_assign_leak) with row lock.
 */
export async function assignLeakForUser(
  input: AssignLeakInput,
): Promise<{ leak: LeakRow; activityId: string }> {
  const { userId, role, leakId, memberUserId } = input;
  const db = await admin();

  const currentLeak = await getAuthorizedLeak(leakId, userId, role, true);

  // Ownership enforcement: Only the owner of the leak can assign it to team members
  if (currentLeak.user_id !== userId) {
    throw new Error("Forbidden: Only the leak owner can assign this leak");
  }

  const previousAssignee = currentLeak.assigned_to;

  if (memberUserId === previousAssignee) {
    return { leak: currentLeak, activityId: "" };
  }

  // 1. Attempt database RPC
  try {
    const { data: rpcResult, error: rpcErr } = await db.rpc(
      "workflow_assign_leak" as any,
      {
        p_leak_id: leakId,
        p_actor_id: userId,
        p_new_assignee: memberUserId,
      } as any,
    );

    if (!rpcErr && rpcResult && (rpcResult as any).success) {
      return {
        leak: (rpcResult as any).leak as LeakRow,
        activityId: ((rpcResult as any).activity_id as string) ?? "",
      };
    }

    if (rpcErr && (rpcErr.code === "P0002" || rpcErr.code === "22023")) {
      throw new Error(rpcErr.message);
    }
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes("Target assignee") ||
        err.message.includes("suspended member") ||
        err.message.includes("Leak finding not found"))
    ) {
      throw err;
    }
  }

  // 2. Fallback
  if (memberUserId) {
    const { data: memberProfile, error: profileErr } = await db
      .from("profiles")
      .select("id, status")
      .eq("id", memberUserId)
      .maybeSingle();

    if (profileErr || !memberProfile) {
      throw new Error("Target assignee does not exist in this workspace");
    }
    if (memberProfile.status === "suspended") {
      throw new Error("Cannot assign leak to a suspended member");
    }
  }

  const now = new Date().toISOString();

  const { data: updatedLeak, error: assignErr } = await db
    .from("erp_leaks")
    .update({
      assigned_to: memberUserId,
      updated_at: now,
    })
    .eq("id", leakId)
    .select()
    .single();

  if (assignErr || !updatedLeak) {
    throw new Error(`Failed to assign leak: ${assignErr?.message ?? "unknown error"}`);
  }

  const { data: activity, error: auditErr } = await db
    .from("erp_leak_activity")
    .insert({
      leak_id: leakId,
      user_id: currentLeak.user_id,
      actor_id: userId,
      action: "assigned",
      metadata: {
        previous_assignee: previousAssignee,
        new_assignee: memberUserId,
      } as Json,
    })
    .select("id")
    .single();

  if (auditErr || !activity) {
    await db
      .from("erp_leaks")
      .update({
        assigned_to: previousAssignee,
        updated_at: currentLeak.updated_at,
      })
      .eq("id", leakId);

    throw new Error(
      `Failed to record audit trail: ${auditErr?.message ?? "unknown error"}. Assignment was rolled back.`,
    );
  }

  return { leak: updatedLeak, activityId: activity.id };
}

export interface AddLeakNoteInput {
  userId: string;
  role: AppRole;
  leakId: string;
  note: string;
}

/**
 * Appends an investigation note to the immutable audit activity trail.
 * Preserves all historical notes without overwriting resolution_notes.
 */
export async function addLeakNoteForUser(
  input: AddLeakNoteInput,
): Promise<{ activity: ActivityRow }> {
  const { userId, role, leakId, note } = input;
  const trimmed = note?.trim();

  if (!trimmed) {
    throw new Error("Note content cannot be empty");
  }

  const currentLeak = await getAuthorizedLeak(leakId, userId, role, true);
  const db = await admin();

  // 1. Attempt database RPC
  try {
    const { data: rpcResult, error: rpcErr } = await db.rpc(
      "workflow_add_leak_note" as any,
      {
        p_leak_id: leakId,
        p_actor_id: userId,
        p_note: trimmed,
      } as any,
    );

    if (!rpcErr && rpcResult) {
      return { activity: rpcResult as unknown as ActivityRow };
    }
  } catch {
    // Proceed to fallback
  }

  // 2. Fallback
  const { data: activity, error } = await db
    .from("erp_leak_activity")
    .insert({
      leak_id: leakId,
      user_id: currentLeak.user_id,
      actor_id: userId,
      action: "note_added",
      metadata: { note: trimmed } as Json,
    })
    .select()
    .single();

  if (error || !activity) {
    throw new Error(`Failed to record note: ${error?.message ?? "unknown error"}`);
  }

  return { activity };
}

export interface OpenRecoveryCaseInput {
  userId: string;
  role: AppRole;
  leakId: string;
  targetAmount?: number | undefined;
  notes?: string | undefined;
  claimReference?: string | undefined;
}

/**
 * Opens a durable recovery case for an actionable leak and transitions the leak
 * to 'recovering'. Enforces the single active recovery case constraint in a single transaction.
 */
export async function openRecoveryCaseForUser(
  input: OpenRecoveryCaseInput,
): Promise<{ recoveryCase: RecoveryCaseRow; leak: LeakRow }> {
  const { userId, role, leakId, targetAmount, notes, claimReference } = input;
  const db = await admin();

  const currentLeak = await getAuthorizedLeak(leakId, userId, role, true);
  const currentStatus = currentLeak.status as LeakStatus;

  if (currentStatus === "recovered" || currentStatus === "dismissed") {
    throw new Error(`Cannot open recovery on a ${currentStatus} leak`);
  }

  // 1. Attempt database RPC
  try {
    const { data: rpcResult, error: rpcErr } = await db.rpc(
      "workflow_open_recovery_case" as any,
      {
        p_leak_id: leakId,
        p_actor_id: userId,
        p_target_amount: targetAmount ?? null,
        p_notes: notes ?? null,
        p_claim_reference: claimReference ?? null,
      } as any,
    );

    if (!rpcErr && rpcResult && (rpcResult as any).recovery_case) {
      return {
        recoveryCase: (rpcResult as any).recovery_case as RecoveryCaseRow,
        leak: (rpcResult as any).leak as LeakRow,
      };
    }

    if (rpcErr && (rpcErr.code === "23505" || rpcErr.code === "22023" || rpcErr.code === "P0002")) {
      throw new Error(rpcErr.message);
    }
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes("active recovery case already exists") ||
        err.message.includes("Cannot open recovery"))
    ) {
      const { data: existingActive } = await db
        .from("erp_recovery_cases")
        .select("*")
        .eq("leak_id", leakId)
        .is("closed_at", null)
        .neq("stage", "recovered")
        .maybeSingle();

      if (existingActive) {
        return {
          recoveryCase: existingActive as RecoveryCaseRow,
          leak: currentLeak,
        };
      }
      throw err;
    }
  }

  // 2. Fallback
  const { data: existingActive } = await db
    .from("erp_recovery_cases")
    .select("*")
    .eq("leak_id", leakId)
    .is("closed_at", null)
    .neq("stage", "recovered")
    .maybeSingle();

  if (existingActive) {
    return {
      recoveryCase: existingActive as RecoveryCaseRow,
      leak: currentLeak,
    };
  }

  const finalTarget =
    typeof targetAmount === "number" && targetAmount > 0
      ? targetAmount
      : Number(currentLeak.amount) || 0;

  const now = new Date().toISOString();

  const { data: recoveryCase, error: caseErr } = await db
    .from("erp_recovery_cases")
    .insert({
      leak_id: leakId,
      user_id: currentLeak.user_id,
      owner_id: userId,
      stage: "identified",
      target_amount: finalTarget,
      recovered_amount: 0.0,
      currency: currentLeak.currency,
      claim_reference: claimReference?.trim() || null,
      notes: notes?.trim() || null,
      opened_at: now,
    })
    .select()
    .single();

  if (caseErr || !recoveryCase) {
    throw new Error(`Failed to open recovery case: ${caseErr?.message ?? "unknown error"}`);
  }

  let updatedLeak = currentLeak;
  if (currentStatus !== "recovering") {
    const { data: lk, error: leakErr } = await db
      .from("erp_leaks")
      .update({
        status: "recovering",
        updated_at: now,
      })
      .eq("id", leakId)
      .select()
      .single();

    if (leakErr || !lk) {
      await db.from("erp_recovery_cases").delete().eq("id", recoveryCase.id);
      throw new Error(
        `Failed to transition leak to recovering: ${leakErr?.message ?? "unknown error"}`,
      );
    }
    updatedLeak = lk;
  }

  const { error: auditErr } = await db.from("erp_leak_activity").insert({
    leak_id: leakId,
    user_id: currentLeak.user_id,
    actor_id: userId,
    action: "recovery_opened",
    metadata: {
      recovery_case_id: recoveryCase.id,
      target_amount: finalTarget,
      currency: currentLeak.currency,
      claim_reference: claimReference?.trim() || null,
    } as Json,
  });

  if (auditErr) {
    await db.from("erp_recovery_cases").delete().eq("id", recoveryCase.id);
    if (currentStatus !== "recovering") {
      await db
        .from("erp_leaks")
        .update({ status: currentStatus, updated_at: currentLeak.updated_at })
        .eq("id", leakId);
    }
    throw new Error(
      `Failed to record audit trail: ${auditErr.message}. Recovery creation rolled back.`,
    );
  }

  return { recoveryCase, leak: updatedLeak };
}

export interface UpdateRecoveryCaseInput {
  userId: string;
  role: AppRole;
  recoveryCaseId: string;
  stage?: RecoveryStage | undefined;
  recoveredAmount?: number | undefined;
  claimReference?: string | null | undefined;
  notes?: string | null | undefined;
  ownerId?: string | null | undefined;
}

/**
 * Updates stage, recovery amounts, claim references or assignee of a recovery case.
 * If stage is transitioned to 'recovered', marks case closed and resolves parent leak.
 * Atomic execution in a single PostgreSQL transaction via workflow_update_recovery_case.
 */
export async function updateRecoveryCaseForUser(
  input: UpdateRecoveryCaseInput,
): Promise<{ recoveryCase: RecoveryCaseRow; leak?: LeakRow | undefined }> {
  const {
    userId,
    role,
    recoveryCaseId,
    stage: nextStage,
    recoveredAmount,
    claimReference,
    notes,
    ownerId,
  } = input;
  const db = await admin();

  const currentCase = await getAuthorizedRecoveryCase(recoveryCaseId, userId, role, true);
  const currentStage = currentCase.stage as RecoveryStage;

  if (nextStage && !isValidRecoveryTransition(currentStage, nextStage)) {
    throw new Error(
      `Cannot transition recovery stage from '${currentStage}' to '${nextStage}'. Allowed transitions: ${(ALLOWED_RECOVERY_TRANSITIONS[currentStage] || []).join(", ") || "none"}`,
    );
  }

  // 1. Attempt database RPC
  try {
    const { data: rpcResult, error: rpcErr } = await db.rpc(
      "workflow_update_recovery_case" as any,
      {
        p_recovery_case_id: recoveryCaseId,
        p_actor_id: userId,
        p_next_stage: nextStage ?? null,
        p_recovered_amount: recoveredAmount ?? null,
        p_claim_reference: claimReference ?? null,
        p_notes: notes ?? null,
        p_owner_id: ownerId ?? null,
      } as any,
    );

    if (!rpcErr && rpcResult && (rpcResult as any).recovery_case) {
      return {
        recoveryCase: (rpcResult as any).recovery_case as RecoveryCaseRow,
        leak: ((rpcResult as any).leak as LeakRow | null) ?? undefined,
      };
    }

    if (rpcErr && (rpcErr.code === "22023" || rpcErr.code === "P0002")) {
      throw new Error(rpcErr.message);
    }
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes("Cannot transition recovery stage") ||
        err.message.includes("Recovery case not found"))
    ) {
      throw err;
    }
  }

  // 2. Fallback
  if (ownerId && ownerId !== currentCase.owner_id) {
    const { data: ownerProfile } = await db
      .from("profiles")
      .select("id, status")
      .eq("id", ownerId)
      .maybeSingle();

    if (!ownerProfile || ownerProfile.status === "suspended") {
      throw new Error("Specified recovery owner is not a valid active workspace user");
    }
  }

  const now = new Date().toISOString();
  const willBeRecovered = nextStage === "recovered";
  const closedAt = willBeRecovered ? now : currentCase.closed_at;

  const updatePayload: Partial<RecoveryCaseRow> = {
    updated_at: now,
  };
  if (nextStage) updatePayload.stage = nextStage;
  if (typeof recoveredAmount === "number") updatePayload.recovered_amount = recoveredAmount;
  if (claimReference !== undefined) updatePayload.claim_reference = claimReference;
  if (notes !== undefined) updatePayload.notes = notes;
  if (ownerId !== undefined) updatePayload.owner_id = ownerId;
  if (closedAt !== undefined) updatePayload.closed_at = closedAt;

  const { data: updatedCase, error: updateErr } = await db
    .from("erp_recovery_cases")
    .update(updatePayload)
    .eq("id", recoveryCaseId)
    .select()
    .single();

  if (updateErr || !updatedCase) {
    throw new Error(`Failed to update recovery case: ${updateErr?.message ?? "unknown error"}`);
  }

  let updatedLeak: LeakRow | undefined;
  if (willBeRecovered) {
    const { data: lk, error: lkErr } = await db
      .from("erp_leaks")
      .update({
        status: "recovered",
        resolved_at: now,
        resolution_notes: notes ?? currentCase.notes ?? "Recovered via recovery case",
        updated_at: now,
      })
      .eq("id", currentCase.leak_id)
      .select()
      .single();

    if (lkErr || !lk) {
      await db
        .from("erp_recovery_cases")
        .update({
          stage: currentStage,
          recovered_amount: currentCase.recovered_amount,
          closed_at: currentCase.closed_at,
          updated_at: currentCase.updated_at,
        })
        .eq("id", recoveryCaseId);

      throw new Error(`Failed to resolve parent leak: ${lkErr?.message ?? "unknown error"}`);
    }
    updatedLeak = lk;
  }

  const { error: auditErr } = await db.from("erp_leak_activity").insert({
    leak_id: currentCase.leak_id,
    user_id: currentCase.user_id,
    actor_id: userId,
    action: nextStage && nextStage !== currentStage ? "recovery_stage_changed" : "recovery_updated",
    metadata: {
      recovery_case_id: recoveryCaseId,
      from_stage: currentStage,
      to_stage: nextStage ?? currentStage,
      recovered_amount: updatePayload.recovered_amount ?? currentCase.recovered_amount,
      claim_reference: updatePayload.claim_reference ?? currentCase.claim_reference,
    } as Json,
  });

  if (auditErr) {
    await db
      .from("erp_recovery_cases")
      .update({
        stage: currentStage,
        recovered_amount: currentCase.recovered_amount,
        closed_at: currentCase.closed_at,
        updated_at: currentCase.updated_at,
      })
      .eq("id", recoveryCaseId);

    if (willBeRecovered) {
      await db
        .from("erp_leaks")
        .update({
          status: "recovering",
          resolved_at: null,
          updated_at: now,
        })
        .eq("id", currentCase.leak_id);
    }

    throw new Error(
      `Failed to record audit trail: ${auditErr.message}. Recovery update rolled back.`,
    );
  }

  return { recoveryCase: updatedCase, leak: updatedLeak };
}

// ---------------------------------------------------------------------------
// Query Operations
// ---------------------------------------------------------------------------

export interface GetLeakDetailsInput {
  userId: string;
  role: AppRole;
  leakId: string;
}

export interface LeakDetailsResult {
  leak: LeakRow;
  activities: ActivityRow[];
  recoveryCase: RecoveryCaseRow | null;
  memberMap: Record<string, LeakMemberInfo>;
}

export interface LeakMemberInfo {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
}

/**
 * Loads a durable leak with its entire append-only audit trail, active recovery case,
 * and user profile details for all relevant actors.
 * Enforces tenant ownership or explicit assignment.
 */
export async function getLeakDetailsForUser(
  input: GetLeakDetailsInput,
): Promise<LeakDetailsResult> {
  const { userId, role, leakId } = input;
  const db = await admin();

  const leak = await getAuthorizedLeak(leakId, userId, role, false);

  const [{ data: activities }, { data: recoveryCases }] = await Promise.all([
    db
      .from("erp_leak_activity")
      .select("*")
      .eq("leak_id", leakId)
      .order("created_at", { ascending: false }),
    db
      .from("erp_recovery_cases")
      .select("*")
      .eq("leak_id", leakId)
      .order("opened_at", { ascending: false })
      .limit(1),
  ]);

  const rawActivities = (activities ?? []) as ActivityRow[];
  const recCase = recoveryCases?.[0] ?? null;

  // Collect relevant user IDs to resolve names & roles
  const userIds = new Set<string>();
  if (leak.user_id) userIds.add(leak.user_id);
  if (leak.assigned_to) userIds.add(leak.assigned_to);
  if (recCase?.owner_id) userIds.add(recCase.owner_id);
  for (const a of rawActivities) {
    if (a.actor_id) userIds.add(a.actor_id);
  }

  const memberMap: Record<string, LeakMemberInfo> = {};
  if (userIds.size > 0) {
    const idList = Array.from(userIds);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      db.from("profiles").select("id, full_name, email").in("id", idList),
      db.from("user_roles").select("user_id, role").in("user_id", idList),
    ]);

    const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as AppRole]));
    for (const p of profiles ?? []) {
      memberMap[p.id] = {
        id: p.id,
        fullName: p.full_name || p.email || "Member",
        email: p.email || "",
        role: roleMap.get(p.id) ?? "viewer",
      };
    }
  }

  return {
    leak,
    activities: rawActivities,
    recoveryCase: recCase,
    memberMap,
  };
}

export interface ListDurableLeaksInput {
  userId: string;
  role: AppRole;
  status?: LeakStatus | undefined;
  severity?: "critical" | "high" | "medium" | "low" | undefined;
  type?: string | undefined;
  search?: string | undefined;
  assignedTo?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface ListDurableLeaksResult {
  leaks: LeakRow[];
  total: number;
  memberMap: Record<string, LeakMemberInfo>;
}

/**
 * Queries persisted durable leaks for the authenticated user, supporting filters,
 * search and pagination. Strictly tenant-scoped (user_id = userId OR assigned_to = userId).
 */
export async function listDurableLeaksForUser(
  input: ListDurableLeaksInput,
): Promise<ListDurableLeaksResult> {
  const { userId, status, severity, type, search, assignedTo, limit = 50, offset = 0 } = input;
  const db = await admin();

  let query = db.from("erp_leaks").select("*", { count: "exact" });

  // Strict tenancy filter: only records owned by caller or explicitly assigned to caller
  query = query.or(`user_id.eq.${userId},assigned_to.eq.${userId}`);

  if (status) {
    query = query.eq("status", status);
  }
  if (severity) {
    query = query.eq("severity", severity);
  }
  if (type && type !== "all") {
    query = query.eq("type", type);
  }
  if (assignedTo) {
    if (assignedTo === "unassigned") {
      query = query.is("assigned_to", null);
    } else {
      query = query.eq("assigned_to", assignedTo);
    }
  }
  if (search && search.trim()) {
    const s = search.trim();
    query = query.or(`title.ilike.%${s}%,vendor_name.ilike.%${s}%,type.ilike.%${s}%`);
  }

  query = query
    .order("detected_at", { ascending: false })
    .range(offset, offset + Math.min(limit, 200) - 1);

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Failed to list leaks: ${error.message}`);
  }

  const leaks = (data ?? []) as LeakRow[];

  // Fetch names for assignees and owners of these leaks
  const memberMap: Record<string, LeakMemberInfo> = {};
  const userIds = new Set<string>();
  for (const l of leaks) {
    if (l.assigned_to) userIds.add(l.assigned_to);
    if (l.user_id) userIds.add(l.user_id);
  }
  if (userIds.size > 0) {
    const idList = Array.from(userIds);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      db.from("profiles").select("id, full_name, email").in("id", idList),
      db.from("user_roles").select("user_id, role").in("user_id", idList),
    ]);
    const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as AppRole]));
    for (const p of profiles ?? []) {
      memberMap[p.id] = {
        id: p.id,
        fullName: p.full_name || p.email || "Member",
        email: p.email || "",
        role: roleMap.get(p.id) ?? "viewer",
      };
    }
  }

  return {
    leaks,
    total: count ?? 0,
    memberMap,
  };
}

export interface ListRecoveryCasesInput {
  userId: string;
  role: AppRole;
  stage?: RecoveryStage | undefined;
  search?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface DurableRecoveryCaseItem {
  id: string;
  leakId: string;
  vendorName: string;
  leakTitle: string;
  currency: string;
  leakStatus: LeakStatus;
  targetAmount: number;
  recoveredAmount: number;
  remainingAmount: number;
  progress: number;
  stage: RecoveryStage;
  ownerId: string | null;
  ownerName: string;
  claimReference: string | null;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListRecoveryCasesResult {
  cases: DurableRecoveryCaseItem[];
  total: number;
}

/**
 * Queries durable recovery cases for the authenticated user, joined with leak details
 * and resolved owner names.
 */
export async function listRecoveryCasesForUser(
  input: ListRecoveryCasesInput,
): Promise<ListRecoveryCasesResult> {
  const { userId, stage, search, limit = 50, offset = 0 } = input;
  const db = await admin();

  let query = db.from("erp_recovery_cases").select("*", { count: "exact" });

  // Strict tenancy: cases belonging to user or where user is designated owner
  query = query.or(`user_id.eq.${userId},owner_id.eq.${userId}`);

  if (stage) {
    query = query.eq("stage", stage);
  }

  query = query
    .order("opened_at", { ascending: false })
    .range(offset, offset + Math.min(limit, 200) - 1);

  const { data: casesData, count, error } = await query;
  if (error) {
    throw new Error(`Failed to list recovery cases: ${error.message}`);
  }

  const rawCases = (casesData ?? []) as RecoveryCaseRow[];
  if (rawCases.length === 0) {
    return { cases: [], total: 0 };
  }

  // Load parent leaks
  const leakIds = Array.from(new Set(rawCases.map((c) => c.leak_id)));
  const { data: leaksData } = await db
    .from("erp_leaks")
    .select("id, title, vendor_name, currency, status")
    .in("id", leakIds);

  const leakMap = new Map((leaksData ?? []).map((l) => [l.id, l]));

  // Load owner profile names
  const ownerIds = Array.from(new Set(rawCases.map((c) => c.owner_id).filter(Boolean) as string[]));
  const ownerMap = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ownerIds);
    for (const p of profiles ?? []) {
      ownerMap.set(p.id, p.full_name || p.email || "Member");
    }
  }

  let items: DurableRecoveryCaseItem[] = rawCases.map((c) => {
    const leak = leakMap.get(c.leak_id);
    const target = Number(c.target_amount) || 0;
    const recovered = Number(c.recovered_amount) || 0;
    const remaining = Math.max(0, target - recovered);
    const progress = target > 0 ? Math.min(100, Math.round((recovered / target) * 100)) : 0;

    return {
      id: c.id,
      leakId: c.leak_id,
      vendorName: leak?.vendor_name || "Unknown vendor",
      leakTitle: leak?.title || "Financial Leak",
      currency: leak?.currency || "USD",
      leakStatus: (leak?.status || "recovering") as LeakStatus,
      targetAmount: target,
      recoveredAmount: recovered,
      remainingAmount: remaining,
      progress,
      stage: c.stage as RecoveryStage,
      ownerId: c.owner_id,
      ownerName: (c.owner_id ? ownerMap.get(c.owner_id) : null) || "Unassigned",
      claimReference: c.claim_reference,
      notes: c.notes,
      openedAt: c.opened_at,
      closedAt: c.closed_at,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  });

  if (search && search.trim()) {
    const s = search.trim().toLowerCase();
    items = items.filter(
      (c) =>
        c.vendorName.toLowerCase().includes(s) ||
        c.leakTitle.toLowerCase().includes(s) ||
        (c.claimReference && c.claimReference.toLowerCase().includes(s)) ||
        c.ownerName.toLowerCase().includes(s),
    );
  }

  return {
    cases: items,
    total: count ?? items.length,
  };
}

/**
 * Returns active workspace members available for assignment.
 */
export async function listAssignableMembersForUser(_userId: string): Promise<LeakMemberInfo[]> {
  const db = await admin();
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    db.from("profiles").select("id, full_name, email, status").neq("status", "suspended"),
    db.from("user_roles").select("user_id, role"),
  ]);

  const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as AppRole]));

  return (profiles ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name || p.email || "Member",
    email: p.email || "",
    role: roleMap.get(p.id) ?? "viewer",
  }));
}

export interface DurableMetricsResult {
  totalExposure: number;
  activeLeaksCount: number;
  activeRecoveriesCount: number;
  activeRecoveriesTarget: number;
  recoveredCash: number;
  dismissedCount: number;
  dismissedAmount: number;
  currency: string;
}

/**
 * Computes durable metrics for the dashboard:
 * - Total Identified Exposure: sum of amounts for leaks in active statuses ('detected', 'investigating', 'recovering').
 * - Active Recoveries: count of recovery cases not yet reached terminal 'recovered' stage.
 * - Recovered Cash: sum of actual recovered amounts from all recovery cases.
 */
export async function getDurableMetricsForUser(userId: string): Promise<DurableMetricsResult> {
  const db = await admin();

  const [{ data: leaks }, { data: recoveryCases }] = await Promise.all([
    db
      .from("erp_leaks")
      .select("amount, currency, status")
      .or(`user_id.eq.${userId},assigned_to.eq.${userId}`),
    db
      .from("erp_recovery_cases")
      .select("target_amount, recovered_amount, stage")
      .or(`user_id.eq.${userId},owner_id.eq.${userId}`),
  ]);

  const allLeaks = leaks ?? [];
  const allCases = recoveryCases ?? [];

  let totalExposure = 0;
  let activeLeaksCount = 0;
  let dismissedCount = 0;
  let dismissedAmount = 0;
  const currencyCounts = new Map<string, number>();

  for (const l of allLeaks) {
    const amt = Number(l.amount) || 0;
    const cur = l.currency || "USD";
    currencyCounts.set(cur, (currencyCounts.get(cur) ?? 0) + 1);

    if (["detected", "investigating", "recovering"].includes(l.status)) {
      totalExposure += amt;
      activeLeaksCount++;
    } else if (l.status === "dismissed") {
      dismissedAmount += amt;
      dismissedCount++;
    }
  }

  let activeRecoveriesCount = 0;
  let activeRecoveriesTarget = 0;
  let recoveredCash = 0;

  for (const c of allCases) {
    const tgt = Number(c.target_amount) || 0;
    const rec = Number(c.recovered_amount) || 0;
    recoveredCash += rec;

    if (c.stage !== "recovered") {
      activeRecoveriesCount++;
      activeRecoveriesTarget += tgt;
    }
  }

  const topCurrency = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "USD";

  return {
    totalExposure: Math.round(totalExposure),
    activeLeaksCount,
    activeRecoveriesCount,
    activeRecoveriesTarget: Math.round(activeRecoveriesTarget),
    recoveredCash: Math.round(recoveredCash),
    dismissedCount,
    dismissedAmount: Math.round(dismissedAmount),
    currency: topCurrency,
  };
}

export interface GenerateVendorNoticeInput {
  userId: string;
  role: AppRole;
  recoveryCaseId: string;
  tone?: "formal" | "firm" | "collaborative" | undefined;
  customNotes?: string | undefined;
}

export interface VendorNoticeResult {
  subject: string;
  letter: string;
  vendorName: string;
  claimReference: string;
  targetAmount: number;
  currency: string;
  recipientEmail?: string | null;
}

/**
 * Generates an executive, evidence-backed vendor recovery claim notice / dispute letter
 * using the configured AI engine (Google Gemini 2.5 Flash / Vertex AI) with reliable fallback.
 */
export async function generateVendorNoticeForRecoveryCase(
  input: GenerateVendorNoticeInput,
  request?: Request,
): Promise<VendorNoticeResult> {
  const { userId, role, recoveryCaseId, tone = "formal", customNotes } = input;
  const db = await admin();

  const recoveryCase = await getAuthorizedRecoveryCase(recoveryCaseId, userId, role, false);
  const leak = await getAuthorizedLeak(recoveryCase.leak_id, userId, role, false);

  // Attempt to look up vendor contact
  const { data: vendorContact } = await db
    .from("erp_vendors")
    .select("email, phone")
    .eq("user_id", userId)
    .ilike("name", `%${leak.vendor_name}%`)
    .limit(1)
    .maybeSingle();

  const claimReference =
    recoveryCase.claim_reference || `CLM-${recoveryCase.id.slice(0, 8).toUpperCase()}`;
  const targetAmount = Number(recoveryCase.target_amount) || Number(leak.amount) || 0;
  const currencyCode = recoveryCase.currency || leak.currency || "USD";
  const evidenceObj = (leak.evidence ?? {}) as Record<string, any>;
  const invoices = Array.isArray(evidenceObj["invoices"]) ? evidenceObj["invoices"] : [];
  const payments = Array.isArray(evidenceObj["payments"]) ? evidenceObj["payments"] : [];

  const invoiceSummary =
    invoices.length > 0
      ? invoices
          .map(
            (inv: any) =>
              `Invoice #${inv.invoice_number || inv.external_id || "N/A"} (${inv.issue_date || "date unknown"}, Amount: ${currencyCode} ${inv.amount ?? 0})`,
          )
          .join("; ")
      : "Multiple cross-referenced transactions";

  const paymentSummary =
    payments.length > 0
      ? payments
          .map(
            (p: any) =>
              `Payment Ref #${p.reference || p.external_id || "N/A"} (${p.paid_date || "date unknown"}, Amount: ${currencyCode} ${p.amount ?? 0})`,
          )
          .join("; ")
      : "Disbursement ledger records";

  const promptDetails = `
Vendor Name: ${leak.vendor_name}
Claim Reference: ${claimReference}
Discrepancy Category: ${leak.type} (${leak.title})
Disputed Exposure Amount: ${currencyCode} ${targetAmount.toLocaleString()}
Associated Invoices: ${invoiceSummary}
Disbursements / Payments: ${paymentSummary}
Audit Findings: ${evidenceObj["detail"] || leak.title}
Preferred Tone: ${tone} (${tone === "firm" ? "strict legal demand, 7-day turnaround" : tone === "collaborative" ? "courteous commercial inquiry, reconciliation focus" : "formal executive audit notice, 10-day settlement"})
${customNotes ? `Specific Recovery Instructions: ${customNotes}` : ""}
`;

  // Fallback letter generator
  const createFallbackNotice = (): VendorNoticeResult => {
    const subject = `[Audit Notice] Request for Reconciliation & Refund — ${claimReference} (${leak.vendor_name})`;
    const letter = `Dear Finance & Accounts Team at ${leak.vendor_name},

AutoAudit Financial Controls has completed an operational disbursement review for our accounts. During our audit reconciliation, an anomalous transaction pattern was identified that requires your prompt review and adjustment.

SUMMARY OF DISCREPANCY:
• Claim Reference: ${claimReference}
• Nature of Discrepancy: ${leak.type} (${leak.title})
• Disputed Amount: ${currencyCode} ${targetAmount.toLocaleString()}
• Invoices Involved: ${invoiceSummary}
• Disbursed Records: ${paymentSummary}

DETAILS:
Our records indicate that ${leak.title.toLowerCase()}, resulting in an excess disbursement of ${currencyCode} ${targetAmount.toLocaleString()}. 

REQUESTED ACTION:
Please verify your accounts receivable ledger against this notice. If our audit reflects your records, we respectfully request you choose one of the following remediation options within 10 business days:
1. Issue an immediate Credit Note for ${currencyCode} ${targetAmount.toLocaleString()} referencing ${claimReference}.
2. Remit a direct bank refund/wire to our corporate treasury account.

Please provide your written confirmation and remittance advice referencing Claim #${claimReference} to our finance desk.

Sincerely,
Accounts Payable & Financial Controls
AutoAudit Enterprise Platform`;

    return {
      subject,
      letter,
      vendorName: leak.vendor_name,
      claimReference,
      targetAmount,
      currency: currencyCode,
      recipientEmail: vendorContact?.email || null,
    };
  };

  try {
    const { resolveAiModel } = await import("@/lib/erp/ai-analysis.server");
    const model = await resolveAiModel(request);
    if (!model) return createFallbackNotice();

    const { generateText } = await import("ai");
    const aiResponse = await generateText({
      model: model as any,
      system:
        "You are an executive Accounts Payable & Financial Recovery specialist. Draft a professional, highly specific, and legally sound vendor recovery claim notice / dispute letter regarding an overpayment or duplicate billing. Output only two sections clearly labeled SUBJECT: and LETTER:.",
      prompt: `Draft a formal vendor dispute letter based on this forensic audit record:\n${promptDetails}`,
    });

    const text = aiResponse.text.trim();
    let subject = `Audit Notice: Disbursement Reconciliation & Claim — ${claimReference}`;
    let letter = text;

    if (text.includes("SUBJECT:") && text.includes("LETTER:")) {
      const parts = text.split("LETTER:");
      subject = (parts[0] ?? "").replace("SUBJECT:", "").trim();
      letter = (parts[1] ?? "").trim();
    } else {
      const firstLine = text.split("\n")[0] || "";
      if (firstLine.toLowerCase().startsWith("subject:")) {
        subject = firstLine.replace(/subject:/i, "").trim();
        letter = text.substring(firstLine.length).trim();
      }
    }

    return {
      subject,
      letter,
      vendorName: leak.vendor_name,
      claimReference,
      targetAmount,
      currency: currencyCode,
      recipientEmail: vendorContact?.email || null,
    };
  } catch (err) {
    console.warn("[Recovery Notice] AI generation failed, using fallback notice:", err);
    return createFallbackNotice();
  }
}
