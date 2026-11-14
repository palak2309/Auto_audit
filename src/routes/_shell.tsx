import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

import { AppShell } from "@/components/layout/app-shell";
import { useMockAuth } from "@/providers/mock-auth-provider";

export const Route = createFileRoute("/_shell")({
  component: ShellLayout,
});

function ShellLayout() {
  const { session, loadingSession, status, accessLoading, signOut } = useMockAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loadingSession && !session) void navigate({ to: "/login" });
  }, [loadingSession, session, navigate]);

  if (loadingSession || !session || accessLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (status === "suspended") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="surface-card max-w-md p-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="mt-4 text-lg font-semibold">Your access has been suspended</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An administrator of this workspace has paused your account. Contact them to restore
            access.
          </p>
          <Button className="mt-5" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
