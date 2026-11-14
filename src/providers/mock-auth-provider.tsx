import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccess, type AppPermission, type AppRole } from "@/lib/admin.functions";
import type { AppUser, RoleId } from "@/types";

export interface WorkspaceInfo {
  id: string;
  name: string;
  plan: string;
  entities: number;
}

interface AuthContextValue {
  user: AppUser;
  role: RoleId;
  permissions: AppPermission[];
  can: (permission: AppPermission) => boolean;
  isAdmin: boolean;
  status: string;
  accessLoading: boolean;
  refreshAccess: () => void;
  workspace: WorkspaceInfo;
  setWorkspaceId: (id: string) => void;
  workspaces: WorkspaceInfo[];
  /** Real Supabase session — null when signed out. */
  session: Session | null;
  loadingSession: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState("ws-primary");
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const queryClient = useQueryClient();
  const fetchAccess = useServerFn(getMyAccess);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoadingSession(false);
    });
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const accessQuery = useQuery({
    queryKey: ["my-access", session?.user.id ?? null],
    queryFn: async () => {
      try {
        return await fetchAccess();
      } catch (err: any) {
        console.error(
          "[Auth] Failed to load permissions from server. Failing closed:",
          err?.message,
        );
        if (err?.message?.includes("Invalid API key") || err?.message?.includes("Unauthorized")) {
          void supabase.auth.signOut().catch(() => {});
        }
        // FAIL CLOSED: Never grant admin or write permissions on error
        return {
          userId: session?.user?.id ?? "unauthenticated",
          role: "viewer" as AppRole,
          permissions: [] as AppPermission[],
          profile: {
            full_name:
              (session?.user?.user_metadata?.["full_name"] as string | undefined) ??
              session?.user?.email?.split("@")[0] ??
              "Viewer",
            company: "AutoAudit Workspace",
            department: "General",
            job_title: "Viewer",
            status: "active",
            email: session?.user?.email ?? "",
          },
        };
      }
    },
    enabled: Boolean(session),
    staleTime: 30_000,
  });

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
  }, [queryClient]);

  const refreshAccess = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["my-access"] });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const access = accessQuery.data;
    const meta = (session?.user.user_metadata ?? {}) as Record<string, string | undefined>;
    const userEmail = access?.profile?.email ?? session?.user?.email ?? "";
    const userName =
      access?.profile?.full_name ??
      meta["full_name"] ??
      (userEmail ? userEmail.split("@")[0]! : "Guest");
    const role = (access?.role ?? "viewer") as AppRole;
    const permissions = (access?.permissions ?? []) as AppPermission[];
    const company = access?.profile?.company ?? meta["company"] ?? "AutoAudit Workspace";
    const userWorkspace = {
      id: "ws-primary",
      name: company,
      plan: "Enterprise",
      entities: 1,
    };

    return {
      user: {
        id: access?.userId ?? session?.user?.id ?? "anonymous",
        role: role as RoleId,
        name: userName,
        email: userEmail,
        department: access?.profile?.department ?? "Finance",
        status: (access?.profile?.status ?? "active") as AppUser["status"],
        initials:
          userName
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() ?? "")
            .join("") || "U",
        phone: "+91 98765 43210",
        location: "Mumbai, India",
        lastActive: "Now",
      },
      role: role as RoleId,
      permissions,
      can: (permission: AppPermission) => permissions.includes(permission),
      isAdmin: role === "admin",
      status: access?.profile?.status ?? "active",
      accessLoading: accessQuery.isLoading,
      refreshAccess,
      workspace: userWorkspace,
      setWorkspaceId,
      workspaces: [userWorkspace],
      session,
      loadingSession,
      signOut,
    };
  }, [
    accessQuery.data,
    accessQuery.isLoading,
    refreshAccess,
    workspaceId,
    session,
    loadingSession,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMockAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useMockAuth must be used inside MockAuthProvider");
  return ctx;
}
