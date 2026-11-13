import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  CheckCircle2,
  MailWarning,
  ShieldAlert,
} from "lucide-react";

import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useMockAuth } from "@/providers/mock-auth-provider";
import { getAccountStatus, type AccountState } from "@/lib/account.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — AutoAudit" },
      {
        name: "description",
        content:
          "Sign in to AutoAudit to review detected financial leakage and recovery progress.",
      },
      {
        property: "og:title",
        content: "Sign in — AutoAudit",
      },
      {
        property: "og:description",
        content:
          "Sign in to AutoAudit to review detected financial leakage and recovery progress.",
      },
    ],
  }),
  component: LoginPage,
});

const BANNERS: Record<
  Exclude<AccountState, "unknown">,
  {
    tone: string;
    icon: typeof AlertCircle;
    title: string;
    next: string;
  }
> = {
  unconfirmed: {
    tone: "bg-warning/10 text-warning",
    icon: MailWarning,
    title: "Your email is not confirmed yet.",
    next:
      "Open the confirmation link we emailed you, or send a new one from the verification screen.",
  },
  confirmed: {
    tone: "bg-primary/10 text-primary",
    icon: CheckCircle2,
    title: "This account is confirmed and ready to sign in.",
    next:
      "Enter your password to continue. Use “Forgot?” if you no longer have it.",
  },
  blocked: {
    tone: "bg-destructive/10 text-destructive",
    icon: ShieldAlert,
    title: "This account is blocked.",
    next:
      "An administrator has suspended access. Ask them to restore your account.",
  },
};

function LoginPage() {
  const navigate = useNavigate();
  const { session, loadingSession } = useMockAuth();
  const checkStatus = useServerFn(getAccountStatus);

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<AccountState>("unknown");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loadingSession && session) {
      void navigate({ to: "/" });
    }
  }, [loadingSession, session, navigate]);

  const refreshStatus = async (value: string) => {
    const clean = value.trim().toLowerCase();
    if (!clean.includes("@")) {
      setStatus("unknown");
      return "unknown" as AccountState;
    }

    try {
      const r = await checkStatus({ data: { email: clean } });
      setStatus(r.state);
      return r.state;
    } catch {
      return "unknown" as AccountState;
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      const msg = "Please enter your work email.";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      const msg = "Please enter a valid work email address.";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!password) {
      const msg = "Please enter your password.";
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    setError(null);

    let signInError: any = null;
    try {
      const res = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      signInError = res.error;
    } catch (err: any) {
      signInError = err;
    }

    if (signInError) {
      const state = await refreshStatus(cleanEmail);

      setLoading(false);

      let message = signInError.message || "Failed to connect to authentication service.";
      if (
        message.toLowerCase().includes("failed to fetch") ||
        message.toLowerCase().includes("networkerror")
      ) {
        message =
          "Cannot reach Supabase. Please add your real Supabase Anon Key to .env (from your open Supabase dashboard tab), or click 'Sign in with Demo Account' below.";
      } else if (
        state === "unconfirmed" ||
        signInError.message?.toLowerCase().includes("email not confirmed")
      ) {
        setStatus("unconfirmed");
        message = "Your email is not confirmed yet — confirm it before signing in.";
      } else if (state === "blocked") {
        setStatus("blocked");
        message = "This account is blocked. Ask an administrator to restore access.";
      } else if (signInError.message?.toLowerCase().includes("invalid login credentials")) {
        message = "Invalid email or password. Please verify your credentials.";
      }

      setError(message);
      toast.error(message);
      return;
    }

    setLoading(false);
    toast.success("Signed in successfully.");
    void navigate({ to: "/" });
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      toast.error(`Google sign-in failed: ${error.message}`);
    }
  };

  return (
    <AuthLayout
      title="Sign in to AutoAudit"
      subtitle="Use your corporate credentials to access the audit workspace."
      footer={
        <>
          No account?{" "}
          <Link
            to="/register"
            className="font-medium text-primary hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {status !== "unknown" ? (
          (() => {
            const b = BANNERS[status];
            const Icon = b.icon;

            return (
              <div
                role="status"
                className={`flex items-start gap-2 rounded-lg p-3 text-xs ${b.tone}`}
              >
                <Icon className="mt-0.5 size-4 shrink-0" />

                <div className="space-y-1">
                  <p className="font-medium">{b.title}</p>
                  <p className="opacity-90">{b.next}</p>

                  {status === "unconfirmed" ? (
                    <Link
                      to="/verify-email"
                      search={{ email }}
                      className="font-medium underline"
                    >
                      Resend verification email
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })()
        ) : error ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>

          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setStatus("unknown");
              setError(null);
            }}
            onBlur={(e) => void refreshStatus(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>

            <Link
              to="/forgot-password"
              search={email ? { email } : {}}
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot?
            </Link>
          </div>

          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="remember" defaultChecked />

          <Label
            htmlFor="remember"
            className="text-sm font-normal text-muted-foreground"
          >
            Keep me signed in for 30 days
          </Label>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign in"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={google}
        >
          Continue with Google
        </Button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or test locally</span>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full font-medium"
          onClick={() => {
            toast.success("Signed in with Demo Admin Workspace.");
            void navigate({ to: "/" });
          }}
        >
          Sign in with Demo Workspace
        </Button>
      </form>
    </AuthLayout>
  );
}
