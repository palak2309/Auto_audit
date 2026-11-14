import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  beginOAuth,
  configuredProviders,
  disconnectFor,
  listConnectionsFor,
  providerConfigStatus,
  saveProviderCredentialsFor,
  syncConnectionFor,
} from "@/lib/erp/service.server";
import { loadFinancials, loadOverview } from "@/lib/erp/data.server";
import { loadActivity } from "@/lib/erp/activity.server";
import { analyzeLeakageFor } from "@/lib/erp/ai-analysis.server";
import { detectAndPersistLeaksForUser } from "@/lib/erp/leak-persistence.server";
import { requireAdmin, type Ctx } from "@/lib/admin.functions";

export const getErpStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({
    configured: await configuredProviders(),
    connections: await listConnectionsFor(context.userId),
  }));

export const startErpConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { provider: string }) => input)
  .handler(async ({ data, context }) => {
    let origin = "https://auto-audit-nu.vercel.app";
    try {
      const req = getRequest();
      if (req?.url) {
        origin = new URL(req.url).origin;
      }
    } catch {
      // use default origin
    }
    return beginOAuth(context.userId, data.provider, origin);
  });

export const syncErpConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { connectionId: string }) => input)
  .handler(async ({ data, context }) => syncConnectionFor(context.userId, data.connectionId));

export const disconnectErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { connectionId: string }) => input)
  .handler(async ({ data, context }) => disconnectFor(context.userId, data.connectionId));

export const getErpFinancials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadFinancials(context.userId));

export const getErpOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadOverview(context.userId));

export const scanAndPersistLeaks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => detectAndPersistLeaksForUser(context.userId));

export const runAiLeakageAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => analyzeLeakageFor(context.userId, getRequest()));

export const getErpActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadActivity(context.userId));

export const getProviderConfigs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => providerConfigStatus());

export const saveProviderConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { provider: string; clientId: string; clientSecret: string; dataCenter?: string }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context as unknown as Ctx);
    return saveProviderCredentialsFor(
      context.userId,
      data.provider,
      data.clientId,
      data.clientSecret,
      data.dataCenter,
    );
  });
