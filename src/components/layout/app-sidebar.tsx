import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { ChevronsUpDown, Sparkles, X } from "lucide-react";
import { navGroups } from "@/constants/navigation";
import { cn } from "@/lib/utils";
import { currency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/common/tone-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMockAuth, type WorkspaceInfo } from "@/providers/mock-auth-provider";
import { getDurableMetrics } from "@/lib/leak.functions";

export function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <img src="/logo.png" alt="AutoAudit" className="size-9 shrink-0 rounded-xl object-contain" />
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">AutoAudit</p>
          <p className="truncate text-[11px] text-sidebar-foreground/65">Financial Leakage AI</p>
        </div>
      )}
    </div>
  );
}

function WorkspaceSwitcher() {
  const { workspace, workspaces, setWorkspaceId } = useMockAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-left transition-colors hover:bg-sidebar-accent">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{workspace.name}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/65">
              {workspace.plan} · {workspace.entities} entities
            </p>
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/65" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((w: WorkspaceInfo) => (
          <DropdownMenuItem key={w.id} onSelect={() => setWorkspaceId(w.id)}>
            <span className="flex-1 truncate">{w.name}</span>
            <span className="text-xs text-sidebar-foreground/65">{w.plan}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can } = useMockAuth();

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((i) => !i.permission || can(i.permission)),
    }))
    .filter((group) => group.items.length > 0);

  const fetchMetrics = useServerFn(getDurableMetrics);
  const { data: metrics } = useQuery({
    queryKey: ["durable-metrics"],
    queryFn: () => fetchMetrics(),
    staleTime: 30_000,
  });

  const activeCount = metrics?.activeLeaksCount ?? 0;
  const exposure = metrics?.totalExposure ?? 0;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-3 pb-4">
      <div className="px-1 pt-1">
        <WorkspaceSwitcher />
      </div>

      <nav className="flex-1 space-y-5">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-[0.12em] text-sidebar-foreground/65 uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="sidebar-active"
                          className="bg-primary absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full"
                        />
                      )}
                      <item.icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-sidebar-primary" : "text-sidebar-foreground/65",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <ToneBadge tone={item.badge === "New" ? "violet" : "danger"} size="sm">
                          {item.badge}
                        </ToneBadge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-3.5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet animate-pulse" />
          <p className="text-xs font-semibold">AI Scan active</p>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-sidebar-foreground/65">
          {activeCount > 0
            ? `${activeCount} leaks awaiting triage (${currency(exposure, { currency: metrics?.currency || "USD" })}).`
            : "Ledger continuous monitoring active. No unaddressed risks."}
        </p>
        <Button asChild size="sm" className="mt-3 w-full text-xs">
          <Link to="/leaks" onClick={onNavigate}>
            Review findings
          </Link>
        </Button>
      </div>

      <div className="pt-2 px-1 text-[11px] text-sidebar-foreground/65 flex flex-wrap gap-x-2 gap-y-1">
        <Link to="/privacy-policy" onClick={onNavigate} className="hover:text-foreground underline">
          Privacy
        </Link>
        <span>•</span>
        <Link
          to="/terms-and-conditions"
          onClick={onNavigate}
          className="hover:text-foreground underline"
        >
          Terms
        </Link>
        <span>•</span>
        <Link to="/cookie-policy" onClick={onNavigate} className="hover:text-foreground underline">
          Cookies
        </Link>
        <span>•</span>
        <Link to="/refund-policy" onClick={onNavigate} className="hover:text-foreground underline">
          Refunds
        </Link>
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 shrink-0 items-center px-5">
        <BrandMark />
      </div>
      <SidebarNav />
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="lg:hidden">
      <div
        className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-sidebar-border bg-sidebar"
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <BrandMark />
          <Button variant="ghost" size="icon" aria-label="Close navigation" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <SidebarNav onNavigate={onClose} />
      </motion.aside>
    </div>
  );
}
