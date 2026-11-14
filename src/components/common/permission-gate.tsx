import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useMockAuth } from "@/providers/mock-auth-provider";
import { Button } from "@/components/ui/button";
import type { AppPermission } from "@/lib/admin.functions";

export function PermissionGate({
  permission,
  children,
}: {
  permission: AppPermission;
  children: ReactNode;
}) {
  const { can, accessLoading, role } = useMockAuth();

  if (accessLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!can(permission)) {
    return (
      <div className="surface-card mx-auto mt-10 max-w-md p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="size-6" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">You don't have access to this page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your role ({role.replace(/_/g, " ")}) is missing the “{permission.replace(/_/g, " ")}”
          permission. Ask an administrator of this workspace to grant it.
        </p>
        <Button asChild className="mt-5">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
