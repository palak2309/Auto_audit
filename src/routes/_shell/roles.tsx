import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { ToneBadge } from "@/components/common/tone-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { roles } from "@/constants/navigation";
import {
  APP_PERMISSIONS,
  getPermissionMatrix,
  setRolePermission,
  type AppPermission,
  type AppRole,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_shell/roles")({
  head: () => ({
    meta: [
      { title: "Roles & Permissions — AutoAudit" },
      {
        name: "description",
        content:
          "Live role definitions and an editable permission matrix enforced across AutoAudit.",
      },
      { property: "og:title", content: "Roles & Permissions — AutoAudit" },
      {
        property: "og:description",
        content:
          "Live role definitions and an editable permission matrix enforced across AutoAudit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PermissionGate permission="manage_roles">
      <RolesPage />
    </PermissionGate>
  ),
});

const permissionLabel = (p: AppPermission) =>
  p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function RolesPage() {
  const queryClient = useQueryClient();
  const fetchMatrix = useServerFn(getPermissionMatrix);
  const toggleFn = useServerFn(setRolePermission);

  const matrixQuery = useQuery({ queryKey: ["permission-matrix"], queryFn: () => fetchMatrix() });

  const toggle = useMutation({
    mutationFn: (vars: { role: AppRole; permission: AppPermission; enabled: boolean }) =>
      toggleFn({ data: vars }),
    onSuccess: () => {
      toast.success("Permission updated");
      void queryClient.invalidateQueries({ queryKey: ["permission-matrix"] });
      void queryClient.invalidateQueries({ queryKey: ["my-access"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const matrix = matrixQuery.data ?? [];
  const has = (role: AppRole, permission: AppPermission) =>
    matrix.some((m) => m.role === role && m.permission === permission);
  const permsFor = (role: AppRole) =>
    matrix.filter((m) => m.role === role).map((m) => m.permission);

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="These permissions are enforced live — changing a checkbox instantly changes what that role can see and do."
        crumbs={[{ label: "Roles & Permissions" }]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role, i) => {
          const granted = permsFor(role.id);
          return (
            <motion.article
              key={role.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -3 }}
              className="surface-card p-5 transition-shadow hover:shadow-lifted"
            >
              <div className="flex items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <role.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{role.label}</p>
                  <ToneBadge tone={role.tone} size="sm">
                    {granted.length} permissions
                  </ToneBadge>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{role.description}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {granted.map((p) => (
                  <li
                    key={p}
                    className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    <Check className="size-3 text-success" /> {permissionLabel(p)}
                  </li>
                ))}
                {granted.length === 0 && (
                  <li className="text-[11px] text-muted-foreground">No permissions granted</li>
                )}
              </ul>
            </motion.article>
          );
        })}
      </div>

      <section className="surface-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-sm font-semibold">Permission matrix</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Admin always keeps every permission so a workspace can never lock itself out.
            </p>
          </div>
          {(matrixQuery.isFetching || toggle.isPending) && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  Role
                </th>
                {APP_PERMISSIONS.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="px-3 py-3 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    {permissionLabel(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr
                  key={role.id}
                  className="border-b border-border/70 last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <role.icon className="size-4 text-muted-foreground" />
                      <span className="font-medium">{role.label}</span>
                    </div>
                  </td>
                  {APP_PERMISSIONS.map((c) => (
                    <td key={c} className="px-3 py-3 text-center">
                      <Checkbox
                        checked={has(role.id, c)}
                        disabled={role.id === "admin" || toggle.isPending}
                        onCheckedChange={(v) =>
                          toggle.mutate({ role: role.id, permission: c, enabled: v === true })
                        }
                        aria-label={`${role.label} can ${permissionLabel(c)}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
