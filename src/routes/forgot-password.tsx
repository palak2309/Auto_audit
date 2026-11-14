import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Lock, Mail, RefreshCw } from "lucide-react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — AutoAudit" },
      { name: "description", content: "Request a password reset link for your AutoAudit account." },
      { property: "og:title", content: "Reset password — AutoAudit" },
      {
        property: "og:description",
        content: "Request a password reset link for your AutoAudit account.",
      },
    ],
  }),
  validateSearch: (
    s: Record<string, unknown>,
  ): { email?: string | undefined; mode?: string | undefined } => {
    const res: { email?: string | undefined; mode?: string | undefined } = {};
    if (typeof s["email"] === "string" && s["email"]) res.email = s["email"];
    if (typeof s["mode"] === "string" && s["mode"]) res.mode = s["mode"];
    return res;
  },
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/forgot-password" });

  const [email, setEmail] = useState(search.email ?? "");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // New password update state (when arriving via recovery link)
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Detect recovery session from URL hash or Supabase auth event
  useEffect(() => {
    // 1. Check URL hash for type=recovery
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash.includes("type=recovery") || search.mode === "reset") {
        setIsRecoverySession(true);
      }
    }

    // 2. Listen to PASSWORD_RECOVERY auth event
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoverySession(true);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [search.mode]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Request password reset email
  const handleSendResetEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetEmail = email.trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const redirectTo = `${window.location.origin}/forgot-password?mode=reset`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo,
      });

      if (resetError) {
        const msg = resetError.message;
        if (msg.toLowerCase().includes("rate") || msg.toLowerCase().includes("security purposes")) {
          setError("Too many requests. Please wait a few moments before trying again.");
          setCooldown(60);
        } else {
          setError(msg);
        }
        toast.error(msg);
      } else {
        setSent(true);
        setCooldown(60);
        toast.success(`Password reset link sent to ${targetEmail}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send reset email";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Submit new password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setUpdatingPassword(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        toast.error(updateError.message);
      } else {
        toast.success("Password updated successfully! Welcome back.");
        void navigate({ to: "/" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update password";
      setError(msg);
      toast.error(msg);
    } finally {
      setUpdatingPassword(false);
    }
  };

  // 1. RECOVERY / NEW PASSWORD FORM
  if (isRecoverySession) {
    return (
      <AuthLayout
        title="Set new password"
        subtitle="Choose a secure password for your AutoAudit workspace account."
        footer={
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        }
      >
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError(null);
              }}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(null);
              }}
              required
            />
          </div>

          <Button type="submit" className="w-full gap-2" disabled={updatingPassword}>
            <Lock className="size-4" />
            {updatingPassword ? "Updating password…" : "Save new password"}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  // 2. SEND RESET LINK FORM
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We will email a secure password reset link to your registered work address."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/25 bg-primary/10 p-4 text-xs">
            <div className="flex items-start gap-2 text-primary">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">Check your inbox</p>
                <p className="leading-relaxed text-foreground">
                  We sent a reset link to <span className="font-semibold">{email.trim()}</span>.
                  Click the link in the email to set a new password.
                </p>
                <p className="text-muted-foreground">
                  Be sure to check your spam or junk folder if it doesn't arrive within 2 minutes.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 text-xs"
              onClick={() => handleSendResetEmail()}
              disabled={loading || cooldown > 0}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              {cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend reset email"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs text-muted-foreground"
              onClick={() => {
                setSent(false);
                setError(null);
              }}
            >
              Try another email address
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSendResetEmail} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="remail">Work email</Label>
            <Input
              id="remail"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              required
              autoFocus
            />
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            <Mail className="size-4" />
            {loading ? "Sending reset link…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
