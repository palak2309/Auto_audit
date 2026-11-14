import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { SeverityBadge, ToneBadge } from "@/components/common/tone-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotifications, type NotificationWithStatus } from "@/hooks/use-notifications";

export const Route = createFileRoute("/_shell/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — AutoAudit" },
      {
        name: "description",
        content: "Every alert raised by the detection engine, ranked by severity and recency.",
      },
      { property: "og:title", content: "Notifications — AutoAudit" },
      {
        property: "og:description",
        content: "Every alert raised by the detection engine, ranked by severity and recency.",
      },
    ],
  }),
  component: NotificationsPage,
});

type TabFilter = "all" | "unread" | "critical" | "leaks" | "workflow";

function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    isLoading,
    isFetching,
    refetch,
    markAsRead,
    markAllAsRead,
    toggleRead,
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(() => {
    return notifications.filter((item) => {
      // Tab filter
      if (activeTab === "unread" && item.read) return false;
      if (activeTab === "critical" && item.severity !== "critical" && item.severity !== "high")
        return false;
      if (activeTab === "leaks" && item.category !== "Leak Alert") return false;
      if (
        activeTab === "workflow" &&
        item.category !== "Recovery" &&
        item.category !== "Investigation"
      )
        return false;

      // Text search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCat) return false;
      }

      return true;
    });
  }, [notifications, activeTab, searchTerm]);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Real-time alerts generated from your financial records, detection engine and recovery cases."
        crumbs={[{ label: "Notifications" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Sync alerts
            </Button>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={markAllAsRead}>
                <CheckCheck className="size-3.5 text-primary" />
                Mark all as read
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-4">
        {/* Controls: Search + Tabs */}
        <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant={activeTab === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("all")}
              className="h-8 text-xs"
            >
              All ({notifications.length})
            </Button>
            <Button
              variant={activeTab === "unread" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("unread")}
              className="h-8 text-xs gap-1.5"
            >
              Unread
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </Button>
            <Button
              variant={activeTab === "critical" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("critical")}
              className="h-8 text-xs"
            >
              Critical & High
            </Button>
            <Button
              variant={activeTab === "leaks" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("leaks")}
              className="h-8 text-xs"
            >
              Leak Findings
            </Button>
            <Button
              variant={activeTab === "workflow" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("workflow")}
              className="h-8 text-xs"
            >
              Workflow Updates
            </Button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter alerts…"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {/* Notifications List */}
        {isLoading ? (
          <div className="surface-card p-12 text-center text-sm text-muted-foreground">
            <RefreshCw className="mx-auto size-6 animate-spin text-muted-foreground/60 mb-2" />
            Loading real-time notifications…
          </div>
        ) : filtered.length === 0 ? (
          <div className="surface-card p-12 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground mb-3">
              {searchTerm ? (
                <Search className="size-5" />
              ) : (
                <CheckCircle2 className="size-6 text-primary" />
              )}
            </div>
            <p className="text-base font-semibold">
              {searchTerm ? "No matching alerts" : "All caught up"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              {searchTerm
                ? `No notifications found matching "${searchTerm}". Try adjusting your search query.`
                : activeTab === "unread"
                  ? "You have marked all notifications as read."
                  : "No active alerts in this category."}
            </p>
            {searchTerm && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setSearchTerm("")}
              >
                Clear filter
              </Button>
            )}
          </div>
        ) : (
          <ul className="surface-card divide-y divide-border overflow-hidden">
            {filtered.map((item) => (
              <li
                key={item.id}
                className={`group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 transition-colors hover:bg-muted/40 ${
                  !item.read ? "bg-primary/[0.03]" : ""
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {!item.read && (
                      <span className="size-2 rounded-full bg-primary shrink-0" title="Unread" />
                    )}
                    <SeverityBadge severity={item.severity as any} />
                    <ToneBadge tone="muted" size="sm">
                      {item.category}
                    </ToneBadge>
                    <span className="text-[11px] text-muted-foreground">{item.timeFormatted}</span>
                  </div>

                  <p className="text-sm font-semibold text-foreground pt-0.5">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>

                  {item.link && (
                    <div className="pt-1.5">
                      <Link
                        to={item.link as any}
                        onClick={() => markAsRead(item.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {item.category === "Leak Alert"
                          ? "Inspect finding in Leaks drawer"
                          : item.category === "Recovery"
                            ? "Track recovery case"
                            : "View integration details"}
                        <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRead(item.id)}
                    className="h-7 text-xs text-muted-foreground opacity-80 group-hover:opacity-100 hover:text-foreground"
                  >
                    {item.read ? "Mark unread" : "Mark read"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
