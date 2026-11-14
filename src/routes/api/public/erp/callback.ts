import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/erp/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const state = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const origin = url.origin;

        const back = (params: Record<string, string>) =>
          new Response(null, {
            status: 302,
            headers: {
              Location: `${origin}/integrations?${new URLSearchParams(params).toString()}`,
            },
          });

        if (error) return back({ connect: "error", message: error });
        if (!state || !code)
          return back({ connect: "error", message: "Missing authorization response" });

        try {
          const { completeOAuth } = await import("@/lib/erp/service.server");
          const result = await completeOAuth({
            state,
            code,
            origin,
            realmId: url.searchParams.get("realmId") ?? undefined,
            location: url.searchParams.get("location") ?? undefined,
            accountsServer: url.searchParams.get("accounts-server") ?? undefined,
          });
          return back({ connect: "success", provider: result.provider });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Connection failed";
          console.error("ERP OAuth callback failed:", message);
          return back({ connect: "error", message: message.slice(0, 300) });
        }
      },
    },
  },
});
