import { useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Inbox, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchKeys?: (keyof T)[];
  searchPlaceholder?: string;
  pageSize?: number;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  toolbar?: ReactNode;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
}

export function DataTable<T>({
  data,
  columns,
  searchKeys = [],
  searchPlaceholder = "Search…",
  pageSize = 8,
  loading = false,
  emptyTitle = "Nothing here yet",
  emptyDescription = "Once data flows in from your connected systems, it will appear here.",
  toolbar,
  onRowClick,
  rowKey,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim() || searchKeys.length === 0) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((key) =>
        String(row[key] ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [data, query, searchKeys]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <div className="surface-card overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border p-4 sm:flex sm:justify-between">
        <div className="relative min-w-0 sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 pl-9"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {toolbar}
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">Filters</span>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase",
                    col.align === "right" && "text-right",
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/70">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading &&
              rows.map((row, i) => (
                <motion.tr
                  key={rowKey(row)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: i * 0.02 }}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-b border-border/70 transition-colors last:border-0 hover:bg-muted/50",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3.5 align-middle",
                        col.align === "right" && "text-right",
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </motion.tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-muted">
            <Inbox className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">{emptyTitle}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{emptyDescription}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {filtered.length === 0
            ? "No results"
            : `Showing ${safePage * pageSize + 1}–${Math.min(filtered.length, (safePage + 1) * pageSize)} of ${filtered.length}`}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Previous page"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 text-xs text-muted-foreground tabular-nums">
            {safePage + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Next page"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
