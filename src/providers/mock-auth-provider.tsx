import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccess, type AppPermission, type AppRole } from "@/lib/admin.functions";
import { currentUser } from "@/data/mock";
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
        console.warn("[Auth] Failed to load permissions from Supabase, using mock admin fallback:", err?.message);
        if (err?.message?.includes("Invalid API key") || err?.message?.includes("Unauthorized")) {
          void supabase.auth.signOut().catch(() => {});
        }
        return {
          userId: currentUser.id,
          role: "admin" as AppRole,
          permissions: [
            "view", "create", "edit", "delete", "approve", "recover",
            "manage_users", "manage_roles", "export", "configure"
          ] as AppPermission[],
          profile: {
            full_name: currentUser.name,
            company: "AutoAudit Workspace",
            department: currentUser.department,
            job_title: "Administrator",
            status: "active",
            email: currentUser.email,
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
    const email = access?.profile?.email ?? session?.user.email ?? currentUser.email;
    const name =
      access?.profile?.full_name ?? meta["full_name"] ?? (session ? email.split("@")[0]! : currentUser.name);
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
        ...currentUser,
        id: access?.userId ?? currentUser.id,
        role: role as RoleId,
        name,
        email,
        department: access?.profile?.department ?? currentUser.department,
        status: (access?.profile?.status ?? "active") as AppUser["status"],
        initials: name
          .split(/\s+/)
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase() ?? "")
          .join(""),
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
  }, [accessQuery.data, accessQuery.isLoading, refreshAccess, workspaceId, session, loadingSession, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMockAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useMockAuth must be used inside MockAuthProvider");
  return ctx;
}
