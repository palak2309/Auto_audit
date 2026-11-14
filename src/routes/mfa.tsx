import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/mfa")({
  head: () => ({
    meta: [
      { title: "Two-factor verification — AutoAudit" },
      {
        name: "description",
        content: "Enter the six-digit code from your authenticator app to finish signing in.",
      },
      { property: "og:title", content: "Two-factor verification — AutoAudit" },
      {
        property: "og:description",
        content: "Enter the six-digit code from your authenticator app to finish signing in.",
      },
    ],
  }),
  component: MfaPage,
});

function MfaPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => navigate({ to: "/" }), 900);
  };
  return (
    <AuthLayout
      title="Two-factor verification"
      subtitle="Enter the 6-digit code from your authenticator app."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Use another method
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="flex justify-between gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Input
              key={i}
              inputMode="numeric"
              maxLength={1}
              aria-label={`Digit ${i + 1}`}
              className="h-14 text-center text-lg font-semibold"
            />
          ))}
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Verifying…" : "Verify and continue"}
        </Button>
      </form>
    </AuthLayout>
  );
}
