import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, RefreshCw, Save, User } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge, ToneBadge } from "@/components/common/tone-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { roleMap } from "@/constants/navigation";
import { useMockAuth } from "@/providers/mock-auth-provider";
import { updateMyProfile } from "@/lib/account.functions";

export const Route = createFileRoute("/_shell/profile")({
  head: () => ({
    meta: [
      { title: "User Profile — AutoAudit" },
      {
        name: "description",
        content: "Your AutoAudit profile, role assignment and workspace membership.",
      },
      { property: "og:title", content: "User Profile — AutoAudit" },
      {
        property: "og:description",
        content: "Your AutoAudit profile, role assignment and workspace membership.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, refreshAccess } = useMockAuth();
  const updateProfileFn = useServerFn(updateMyProfile);

  const [fullName, setFullName] = useState(user.name);
  const [department, setDepartment] = useState(user.department);
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(user.name);
    setDepartment(user.department);
  }, [user.name, user.department]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Full name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      await updateProfileFn({
        data: {
          fullName: fullName.trim(),
          department: department.trim(),
          company: company.trim() || undefined,
        },
      });
      toast.success("Profile updated successfully");
      refreshAccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="User Profile"
        description="Your AutoAudit profile, role assignment and workspace membership."
        crumbs={[{ label: "User Profile" }]}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="surface-card p-6 lg:col-span-1 space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 ring-2 ring-primary/20">
              <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">
                {user.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
            <ToneBadge tone="brand">{roleMap[user.role]?.label || user.role}</ToneBadge>
            <StatusBadge status={user.status} />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {roleMap[user.role]?.description || "Standard platform user"}
          </p>
        </section>

        <section className="surface-card p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold border-b border-border pb-3">Profile details</h2>
          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fn">Full name</Label>
                <Input
                  id="fn"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="em">Work email</Label>
                <Input
                  id="em"
                  value={user.email}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
                <span className="text-[11px] text-muted-foreground">Managed by Supabase Auth</span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dp">Department</Label>
                <Input
                  id="dp"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Finance, Procurement, Audit"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co">Organisation</Label>
                <Input
                  id="co"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Acme Corp"
                />
              </div>
            </div>

            <div className="pt-3">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    Save changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
