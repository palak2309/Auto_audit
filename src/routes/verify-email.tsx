import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, MailCheck, RefreshCw } from "lucide-react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getAccountStatus } from "@/lib/account.functions";

const COOLDOWN_SECONDS = 60;

export const Route = createFileRoute("/verify-email")({
  head: () => ({
    meta: [
      { title: "Verify your email — AutoAudit" },
      {
        name: "description",
        content: "Confirm your AutoAudit email address to activate your audit workspace account.",
      },
      { property: "og:title", content: "Verify your email — AutoAudit" },
      {
        property: "og:description",
        content: "Confirm your AutoAudit email address to activate your audit workspace account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    email: typeof s["email"] === "string" ? (s["email"] as string) : undefined,
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const search = useSearch({ from: "/verify-email" });
  const navigate = useNavigate();
  const checkStatus = useServerFn(getAccountStatus);
  const [email, setEmail] = useState(search.email ?? "");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async () => {
    if (!email.trim()) {
      setResult({ ok: false, message: "Enter the email address you signed up with." });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const status = await checkStatus({ data: { email } });
      if (status.state === "confirmed") {
        setResult({
          ok: true,
          message: "This address is already confirmed — you can sign in now.",
        });
        setSending(false);
        return;
      }
      if (status.state === "blocked") {
        setResult({
          ok: false,
          message: "This account is blocked. Ask an administrator to restore access.",
        });
        setSending(false);
        return;
      }
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      if (error) {
        setResult({
          ok: false,
          message:
            error.message.toLowerCase().includes("security purposes") ||
            error.message.toLowerCase().includes("rate")
              ? `Too many requests — ${error.message}`
              : error.message,
        });
        setCooldown(30);
      } else {
        setResult({
          ok: true,
          message: `Verification email sent to ${email.trim()}. Check your inbox and spam folder.`,
        });
        setCooldown(COOLDOWN_SECONDS);
      }
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "Could not send the email. Try again.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthLayout
      title="Confirm your email address"
      subtitle="We sent you a confirmation link. Once you open it, come back and sign in."
      footer={
        <>
          Already confirmed?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/40 p-3">
          <MailCheck className="mt-0.5 size-4 text-primary" />
          <p className="text-xs text-muted-foreground">
            Links expire after a short time. If yours has expired, or nothing arrived, send a new
            one below.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vemail">Work email</Label>
          <Input
            id="vemail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {result ? (
          <div
            role="status"
            className={`flex items-start gap-2 rounded-lg p-3 text-xs ${
              result.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            }`}
          >
            {result.ok ? (
              <CheckCircle2 className="mt-0.5 size-4" />
            ) : (
              <AlertCircle className="mt-0.5 size-4" />
            )}
            <span>{result.message}</span>
          </div>
        ) : null}

        <Button className="w-full" onClick={resend} disabled={sending || cooldown > 0}>
          <RefreshCw className={`size-4 ${sending ? "animate-spin" : ""}`} />
          {sending
            ? "Sending…"
            : cooldown > 0
              ? `Resend available in ${cooldown}s`
              : "Resend verification email"}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void navigate({ to: "/login" })}
        >
          Back to sign in
        </Button>
      </div>
    </AuthLayout>
  );
}
