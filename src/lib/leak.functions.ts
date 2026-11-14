import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission, roleOf, type Ctx } from "@/lib/admin.functions";
import {
  type LeakStatus,
  type RecoveryStage,
  updateLeakStatusForUser,
  assignLeakForUser,
  addLeakNoteForUser,
  openRecoveryCaseForUser,
  updateRecoveryCaseForUser,
  getLeakDetailsForUser,
  listDurableLeaksForUser,
  listRecoveryCasesForUser,
  listAssignableMembersForUser,
  getDurableMetricsForUser,
  generateVendorNoticeForRecoveryCase,
} from "@/lib/erp/leak-workflow.server";

// ---------------------------------------------------------------------------
// Leak Case Mutations
// ---------------------------------------------------------------------------

/**
 * Transitions a leak case to a new status with validation and atomic audit logging.
 * - 'investigating': requires 'edit' permission
 * - 'recovering': requires 'recover' permission
 * - 'recovered': requires 'recover' or 'approve' permission
 * - 'dismissed': requires 'approve' permission
 */
export const updateLeakStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      leakId: string;
      status: LeakStatus;
      expectedStatus?: LeakStatus | null | undefined;
      notes?: string | null;
    }) => {
      if (!input.leakId || typeof input.leakId !== "string") {
        throw new Error("leakId is required");
      }
      const validStatuses: LeakStatus[] = [
        "detected",
        "investigating",
        "recovering",
        "recovered",
        "dismissed",
      ];
      if (!validStatuses.includes(input.status)) {
        throw new Error(`Invalid status: ${input.status}`);
      }
      if (input.expectedStatus && !validStatuses.includes(input.expectedStatus)) {
        throw new Error(`Invalid expectedStatus: ${input.expectedStatus}`);
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const role = await roleOf(ctx);

    // Permission enforcement based on the target status
    if (data.status === "dismissed") {
      await requirePermission(ctx, "approve");
    } else if (data.status === "recovered") {
      try {
        await requirePermission(ctx, "recover");
      } catch {
        await requirePermission(ctx, "approve");
      }
    } else if (data.status === "recovering") {
      await requirePermission(ctx, "recover");
    } else {
      await requirePermission(ctx, "edit");
    }

    return updateLeakStatusForUser({
      userId: context.userId,
      role,
      leakId: data.leakId,
      status: data.status,
      expectedStatus: data.expectedStatus || undefined,
      notes: data.notes ?? null,
    });
  });

/**
 * Assigns or reassigns a leak case to an active member within the workspace.
 * Requires 'edit' permission.
 */
export const assignLeak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { leakId: string; memberUserId: string | null }) => {
    if (!input.leakId || typeof input.leakId !== "string") {
      throw new Error("leakId is required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const role = await requirePermission(ctx, "edit");

    return assignLeakForUser({
      userId: context.userId,
      role,
      leakId: data.leakId,
      memberUserId: data.memberUserId,
    });
  });

/**
 * Appends an investigation note to the leak's activity trail.
 * Requires 'edit' permission.
 */
export const addLeakNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { leakId: string; note: string }) => {
    if (!input.leakId || typeof input.leakId !== "string") {
      throw new Error("leakId is required");
    }
    if (!input.note || typeof input.note !== "string" || !input.note.trim()) {
      throw new Error("Note content cannot be empty");
    }
    return {
      leakId: input.leakId,
      note: input.note.trim(),
    };
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const role = await requirePermission(ctx, "edit");

    return addLeakNoteForUser({
      userId: context.userId,
      role,
      leakId: data.leakId,
      note: data.note,
    });
  });

// ---------------------------------------------------------------------------
// Recovery Mutations
// ---------------------------------------------------------------------------

/**
 * Opens a durable recovery case and transitions the leak to 'recovering'.
 * Requires 'recover' permission.
 */
export const openRecoveryCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      leakId: string;
      targetAmount?: number | undefined;
      notes?: string | null | undefined;
      claimReference?: string | null | undefined;
    }) => {
      if (!input.leakId || typeof input.leakId !== "string") {
        throw new Error("leakId is required");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const role = await requirePermission(ctx, "recover");

    return openRecoveryCaseForUser({
      userId: context.userId,
      role,
      leakId: data.leakId,
      targetAmount: data.targetAmount,
      notes: data.notes ?? undefined,
      claimReference: data.claimReference ?? undefined,
    });
  });

/**
 * Updates stage, recovery amounts, claim references or assignee of a recovery case.
 * Requires 'recover' permission.
 */
export const updateRecoveryCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      recoveryCaseId: string;
      stage?: RecoveryStage | undefined;
      recoveredAmount?: number | undefined;
      claimReference?: string | null | undefined;
      notes?: string | null | undefined;
      ownerId?: string | null | undefined;
    }) => {
      if (!input.recoveryCaseId || typeof input.recoveryCaseId !== "string") {
        throw new Error("recoveryCaseId is required");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const role = await requirePermission(ctx, "recover");

    return updateRecoveryCaseForUser({
      userId: context.userId,
      role,
      recoveryCaseId: data.recoveryCaseId,
      stage: data.stage,
      recoveredAmount: data.recoveredAmount,
      claimReference: data.claimReference,
      notes: data.notes,
      ownerId: data.ownerId,
    });
  });

// ---------------------------------------------------------------------------
// Read / Query Operations
// ---------------------------------------------------------------------------

/**
 * Loads a durable leak with its entire append-only audit trail and active recovery case.
 * Requires 'view' permission.
 */
export const getLeakDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { leakId: string }) => {
    if (!input.leakId || typeof input.leakId !== "string") {
      throw new Error("leakId is required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const role = await requirePermission(ctx, "view");

    return getLeakDetailsForUser({
      userId: context.userId,
      role,
      leakId: data.leakId,
    });
  });

/**
 * Queries persisted durable leaks for the authenticated user with status/severity/type
 * filtering, search, and pagination.
 * Requires 'view' permission.
 */
export const listDurableLeaks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(
    (
      input: {
        status?: LeakStatus | undefined;
        severity?: "critical" | "high" | "medium" | "low" | undefined;
        type?: string | undefined;
        search?: string | undefined;
        assignedTo?: string | undefined;
        limit?: number | undefined;
        offset?: number | undefined;
      } = {},
    ) => input,
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const role = await requirePermission(ctx, "view");

    return listDurableLeaksForUser({
      userId: context.userId,
      role,
      status: data.status,
      severity: data.severity,
      type: data.type,
      search: data.search,
      assignedTo: data.assignedTo,
      limit: data.limit,
      offset: data.offset,
    });
  });

/**
 * Lists durable recovery cases for the authenticated user with status tracking
 * and parent leak context.
 * Requires 'recover' permission.
 */
export const listRecoveryCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(
    (
      input: {
        stage?: RecoveryStage | undefined;
        search?: string | undefined;
        limit?: number | undefined;
        offset?: number | undefined;
      } = {},
    ) => input,
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const role = await requirePermission(ctx, "recover");

    return listRecoveryCasesForUser({
      userId: context.userId,
      role,
      stage: data?.stage,
      search: data?.search,
      limit: data?.limit,
      offset: data?.offset,
    });
  });

/**
 * Lists workspace members available for assignment.
 * Requires 'view' permission.
 */
export const listAssignableMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    await requirePermission(ctx, "view");

    return listAssignableMembersForUser(context.userId);
  });

/**
 * Computes durable operational metrics for the dashboard.
 * Requires 'view' permission.
 */
export const getDurableMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    await requirePermission(ctx, "view");

    return getDurableMetricsForUser(context.userId);
  });

/**
 * Generates an executive, evidence-backed vendor recovery claim notice / dispute letter
 * using the configured AI engine (Google Gemini 2.5 Flash / Vertex AI) with reliable fallback.
 * Requires 'recover' permission.
 */
export const generateRecoveryClaimNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      recoveryCaseId: string;
      tone?: "formal" | "firm" | "collaborative" | undefined;
      customNotes?: string | undefined;
    }) => {
      if (!input.recoveryCaseId || typeof input.recoveryCaseId !== "string") {
        throw new Error("recoveryCaseId is required");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const role = await requirePermission(ctx, "recover");

    return generateVendorNoticeForRecoveryCase({
      userId: context.userId,
      role,
      recoveryCaseId: data.recoveryCaseId,
      tone: data.tone,
      customNotes: data.customNotes,
    });
  });
