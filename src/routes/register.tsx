import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useMockAuth } from "@/providers/mock-auth-provider";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — AutoAudit" },
      { name: "description", content: "Create an AutoAudit workspace account for your finance and audit team." },
      { property: "og:title", content: "Create account — AutoAudit" },
      { property: "og:description", content: "Create an AutoAudit workspace account for your finance and audit team." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { session, loadingSession } = useMockAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ first: "", last: "", email: "", org: "", password: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (!loadingSession && session) {
      void navigate({ to: "/" });
    }
  }, [loadingSession, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const first = form.first.trim();
    const last = form.last.trim();
    const email = form.email.trim().toLowerCase();
    const org = form.org.trim();
    const password = form.password;

    if (!first || !last) {
      toast.error("Please enter your full first and last name.");
      return;
    }
    if (!email || !email.includes("@") || !email.includes(".")) {
      toast.error("Please enter a valid work email address.");
      return;
    }
    if (!org) {
      toast.error("Please enter your organisation name.");
      return;
    }
    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: `${first} ${last}`.trim(),
          organisation: org,
          company: org,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Account created successfully!");
      void navigate({ to: "/" });
    } else {
      toast.success("Check your inbox to confirm your email.");
      void navigate({ to: "/verify-email", search: { email } });
    }
  };

  return (
    <AuthLayout
      title="Create your workspace account"
      subtitle="Tell us who you are and we will provision your audit workspace."
      footer={<>Already onboarded? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="first">First name</Label><Input id="first" value={form.first} onChange={set("first")} required /></div>
          <div className="space-y-1.5"><Label htmlFor="last">Last name</Label><Input id="last" value={form.last} onChange={set("last")} required /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="cemail">Work email</Label><Input id="cemail" type="email" value={form.email} onChange={set("email")} required /></div>
        <div className="space-y-1.5"><Label htmlFor="org">Organisation</Label><Input id="org" value={form.org} onChange={set("org")} required /></div>
        <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={set("password")} required /></div>
        <div className="flex items-start gap-2 pt-1">
          <input
            id="terms-consent"
            type="checkbox"
            required
            className="mt-1 size-4 rounded border-border text-primary focus:ring-primary"
          />
          <Label htmlFor="terms-consent" className="text-xs leading-normal font-normal text-muted-foreground">
            I agree to the{" "}
            <Link to="/terms-and-conditions" target="_blank" className="text-primary underline">
              Terms and Conditions
            </Link>{" "}
            and consent to the processing of corporate and account data as described in the{" "}
            <Link to="/privacy-policy" target="_blank" className="text-primary underline">
              Privacy Policy
            </Link>{" "}
            under the DPDP Act, 2023.
          </Label>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
      </form>
    </AuthLayout>
  );
}
