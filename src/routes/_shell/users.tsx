import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Search, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { ToneBadge } from "@/components/common/tone-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  APP_ROLES,
  inviteMember,
  listMembers,
  removeMember,
  setMemberRole,
  setMemberStatus,
  type AppRole,
  type Member,
} from "@/lib/admin.functions";
import { roleMap } from "@/constants/navigation";
import { useMockAuth } from "@/providers/mock-auth-provider";

export const Route = createFileRoute("/_shell/users")({
  head: () => ({
    meta: [
      { title: "User Management — AutoAudit" },
      {
        name: "description",
        content: "Invite teammates, assign roles and suspend access for this AutoAudit workspace.",
      },
      { property: "og:title", content: "User Management — AutoAudit" },
      {
        property: "og:description",
        content: "Invite teammates, assign roles and suspend access for this AutoAudit workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PermissionGate permission="manage_users">
      <UsersPage />
    </PermissionGate>
  ),
});

function initialsOf(member: Member) {
  const source = member.fullName?.trim() || member.email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function UsersPage() {
  const queryClient = useQueryClient();
  const { user } = useMockAuth();
  const fetchMembers = useServerFn(listMembers);
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const membersQuery = useQuery({ queryKey: ["members"], queryFn: () => fetchMembers() });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["members"] });

  const setRoleFn = useServerFn(setMemberRole);
  const setStatusFn = useServerFn(setMemberStatus);
  const removeFn = useServerFn(removeMember);

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; role: AppRole }) => setRoleFn({ data: vars }),
    onSuccess: () => {
      toast.success("Role updated");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const statusMutation = useMutation({
    mutationFn: (vars: { userId: string; status: "active" | "suspended" }) =>
      setStatusFn({ data: vars }),
    onSuccess: () => {
      toast.success("Access updated");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMutation = useMutation({
    mutationFn: (vars: { userId: string }) => removeFn({ data: vars }),
    onSuccess: () => {
      toast.success("Member removed");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const members = (membersQuery.data ?? []).filter((m) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [m.email, m.fullName, m.department, m.role].some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <>
      <PageHeader
        title="User management"
        description="Everyone with access to this AutoAudit deployment. Roles decide exactly what each person can do."
        crumbs={[{ label: "Users" }]}
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" /> Add user
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, department or role"
          className="pl-9"
        />
      </div>

      <div className="surface-card divide-y divide-border">
        {membersQuery.isLoading && (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading members…
          </div>
        )}
        {membersQuery.isError && (
          <p className="p-10 text-center text-sm text-destructive">
            {(membersQuery.error as Error).message}
          </p>
        )}
        {!membersQuery.isLoading && members.length === 0 && (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No members match that search.
          </p>
        )}
        {members.map((m) => (
          <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {initialsOf(m)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {m.fullName ?? m.email}
                  {m.id === user.id && (
                    <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.email}
                  {m.department ? ` · ${m.department}` : ""}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Select
                value={m.role}
                onValueChange={(role) =>
                  roleMutation.mutate({ userId: m.id, role: role as AppRole })
                }
              >
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleMap[r]?.label ?? r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ToneBadge tone={m.status === "active" ? "success" : "danger"}>
                {m.status === "active" ? "Active" : "Suspended"}
              </ToneBadge>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {m.lastSignInAt ? new Date(m.lastSignInAt).toLocaleDateString() : "Never signed in"}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Manage access</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={m.id === user.id}
                    onSelect={() =>
                      statusMutation.mutate({
                        userId: m.id,
                        status: m.status === "active" ? "suspended" : "active",
                      })
                    }
                  >
                    {m.status === "active" ? "Suspend access" : "Restore access"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={m.id === user.id}

                    onSelect={() => {
                      if (confirm(`Permanently remove ${m.email}? This deletes their account.`))
                        removeMutation.mutate({ userId: m.id });
                    }}
                  >
                    Remove from workspace
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onDone={invalidate} />
    </>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const [created, setCreated] = useState<{
    email: string;
    temporaryPassword: string | null;
  } | null>(null);

  const inviteFn = useServerFn(inviteMember);
  const mutation = useMutation({
    mutationFn: (vars: {
      email: string;
      role: AppRole;
      fullName?: string | undefined;
      department?: string | undefined;
      password?: string | undefined;
    }) => inviteFn({ data: vars }),

    onSuccess: (res) => {
      setCreated({ email: res.email, temporaryPassword: res.temporaryPassword ?? null });
      setEmail("");
      setFullName("");
      setDepartment("");
      setPassword("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setCreated(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a user</DialogTitle>
          <DialogDescription>
            Creates an account in this workspace with the role you choose. Share the sign-in details
            with them.
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3 text-sm">
            <p>
              Account created for <span className="font-medium">{created.email}</span>.
            </p>
            {created.temporaryPassword && (
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Temporary password (shown once)</p>
                <p className="mt-1 font-mono text-sm break-all">{created.temporaryPassword}</p>
              </div>
            )}
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Work email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-name">Full name</Label>
                <Input
                  id="invite-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-dept">Department</Label>
                <Input
                  id="invite-dept"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleMap[r]?.label ?? r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{roleMap[role]?.description}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-pass">Temporary password (optional)</Label>
              <Input
                id="invite-pass"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to generate one"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                disabled={mutation.isPending || !email}
                onClick={() =>
                  mutation.mutate({
                    email,
                    role,
                    fullName: fullName || undefined,
                    department: department || undefined,
                    password: password || undefined,
                  })
                }
              >
                {mutation.isPending && <Loader2 className="size-4 animate-spin" />} Create account
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
