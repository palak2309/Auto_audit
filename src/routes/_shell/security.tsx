import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Globe,
  KeyRound,
  Laptop,
  LogOut,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge, ToneBadge } from "@/components/common/tone-badge";
import { Button } from "@/components/ui/button";
import { useMockAuth } from "@/providers/mock-auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/_shell/security")({
  head: () => ({
    meta: [
      { title: "Account Security — AutoAudit" },
      {
        name: "description",
        content: "Password, multi-factor methods, recovery codes and active session management.",
      },
      { property: "og:title", content: "Account Security — AutoAudit" },
      {
        property: "og:description",
        content: "Password, multi-factor methods, recovery codes and active session management.",
      },
    ],
  }),
  component: SecurityPage,
});

function getBrowserInfo(): { browser: string; os: string } {
  if (typeof window === "undefined") return { browser: "Browser", os: "Desktop" };
  const ua = window.navigator.userAgent;
  let browser = "Web Browser";
  let os = "Desktop";

  if (ua.includes("Firefox")) browser = "Mozilla Firefox";
  else if (ua.includes("Edg")) browser = "Microsoft Edge";
  else if (ua.includes("Chrome")) browser = "Google Chrome";
  else if (ua.includes("Safari")) browser = "Apple Safari";

  if (ua.includes("Win")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return { browser, os };
}

function SecurityPage() {
  const navigate = useNavigate();
  const { session, user, signOut } = useMockAuth();
  const [factors, setFactors] = useState<any[]>([]);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteAccountFn = useServerFn(deleteMyAccount);

  useEffect(() => {
    async function loadMfa() {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (!error && data) {
          setFactors(data.totp ?? []);
        }
      } catch {
        // MFA endpoint might not be enabled
      } finally {
        setLoadingFactors(false);
      }
    }
    void loadMfa();
  }, []);

  const handleGlobalSignOut = async () => {
    setRevoking(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
      toast.success("Successfully revoked all active sessions across all devices.");
      await signOut();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke sessions");
    } finally {
      setRevoking(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    try {
      await deleteAccountFn();
      toast.success("Your account and all associated tenant data have been permanently deleted.");
      await signOut();
      void navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  };

  const { browser, os } = getBrowserInfo();
  const lastSignIn = session?.user.last_sign_in_at
    ? new Date(session.user.last_sign_in_at).toLocaleString()
    : "Current session";
  const createdDate = session?.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString()
    : "Active";

  return (
    <>
      <PageHeader
        title="Account Security"
        description="Password, authentication factors, active credentials and session management."
        crumbs={[{ label: "Account Security" }]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Session & Device */}
        <section className="surface-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Laptop className="size-5 text-primary" />
              <h2 className="text-sm font-semibold">Current Active Session</h2>
            </div>
            <ToneBadge tone="success" size="sm">
              Online now
            </ToneBadge>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {browser} on {os}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Signed in: {lastSignIn}</p>
              </div>
              <ToneBadge tone="brand" size="sm">
                This Device
              </ToneBadge>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-border/60">
              <div>
                <span className="text-muted-foreground block text-[11px]">User ID</span>
                <span className="font-mono text-foreground truncate block">
                  {session?.user.id ? `${session.user.id.slice(0, 14)}…` : "Local"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Auth Provider</span>
                <span className="text-foreground capitalize">
                  {session?.user.app_metadata?.provider || "Email / Password"}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleGlobalSignOut}
              disabled={revoking}
            >
              <LogOut className="size-4" />
              {revoking ? "Revoking all sessions…" : "Sign out all devices (Global revocation)"}
            </Button>
          </div>
        </section>

        {/* Multi-Factor Authentication */}
        <section className="surface-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <h2 className="text-sm font-semibold">Multi-Factor Authentication (MFA)</h2>
            </div>
            <ToneBadge tone={factors.length > 0 ? "success" : "muted"} size="sm">
              {factors.length > 0 ? "Protected" : "Standard"}
            </ToneBadge>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">Authenticator App (TOTP)</p>
                <p className="text-xs text-muted-foreground">
                  {factors.length > 0
                    ? `Enrolled (${factors[0]?.friendly_name || "Authenticator"})`
                    : "Generate secure codes using Google Authenticator or 1Password"}
                </p>
              </div>
              <ToneBadge tone={factors.length > 0 ? "success" : "muted"} size="sm">
                {factors.length > 0 ? "Active" : "Off"}
              </ToneBadge>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">Password Authentication</p>
                <p className="text-xs text-muted-foreground">
                  Account password protected via Supabase Auth
                </p>
              </div>
              <ToneBadge tone="success" size="sm">
                Configured
              </ToneBadge>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">Account Created</p>
                <p className="text-xs text-muted-foreground">Member since {createdDate}</p>
              </div>
              <ToneBadge tone="muted" size="sm">
                {user.role}
              </ToneBadge>
            </div>
          </div>
        </section>

        {/* Danger Zone: Account Deletion (GDPR & App Store Compliant) */}
        <section className="surface-card p-6 space-y-4 border-destructive/30 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Trash2 className="size-5 text-destructive" />
              <div>
                <h2 className="text-sm font-semibold text-destructive">
                  Danger Zone: Delete Account
                </h2>
                <p className="text-xs text-muted-foreground">
                  Permanently purge your account, ERP connections, invoices, bills and audit
                  history.
                </p>
              </div>
            </div>
            <ToneBadge tone="danger" size="sm">
              Irreversible
            </ToneBadge>
          </div>

          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              In accordance with Apple App Store and data protection regulations, you can
              permanently delete your Auto Audit account. All database records (sales invoices,
              purchase bills, suppliers, customers, and financial leakage logs) belonging to your
              tenant account will be erased via cascading foreign keys. This action cannot be
              undone.
            </p>

            {confirmDelete ? (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5">
                <p className="text-xs font-semibold text-destructive">
                  ⚠️ Are you absolutely certain you want to permanently delete your account and all
                  financial records?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleting}
                    onClick={handleDeleteAccount}
                    className="gap-2"
                  >
                    {deleting ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin" />
                        Deleting Account…
                      </>
                    ) : (
                      "Yes, Delete My Account Permanently"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deleting}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                Delete Account & Purge Data…
              </Button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
