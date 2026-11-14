import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge, ToneBadge } from "@/components/common/tone-badge";
import { NoImportedData } from "@/components/common/no-data";
import { Button } from "@/components/ui/button";
import { useErpOverview } from "@/hooks/use-erp";
import { downloadCsv } from "@/lib/csv";
import { currencyIn } from "@/lib/format";

interface VendorRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  spend: number;
  invoices: number;
  outstanding: number;
  leaks: number;
}

export const Route = createFileRoute("/_shell/vendors")({
  head: () => ({
    meta: [
      { title: "Vendors — AutoAudit" },
      {
        name: "description",
        content:
          "Imported vendors and customers with their real spend, open balance and detected findings.",
      },
      { property: "og:title", content: "Vendors — AutoAudit" },
      {
        property: "og:description",
        content: "Imported vendors with real spend, balance and findings.",
      },
    ],
  }),
  component: VendorsPage,
});

function VendorsPage() {
  const { data, isLoading } = useErpOverview();
  const rows: VendorRow[] = data?.vendorSummary ?? [];
  const code = data?.currencyCode;

  const columns: Column<VendorRow>[] = [
    {
      key: "name",
      header: "Vendor",
      render: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">
            {r.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{r.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {r.email ?? r.phone ?? "No contact details"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "invoices",
      header: "Documents",
      render: (r) => <span className="text-sm tabular-nums">{r.invoices}</span>,
    },
    {
      key: "leaks",
      header: "Findings",
      render: (r) => (
        <ToneBadge tone={r.leaks > 0 ? "danger" : "success"}>
          {r.leaks > 0 ? r.leaks : "None"}
        </ToneBadge>
      ),
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      render: (r) => (
        <span className="text-sm tabular-nums">{currencyIn(r.outstanding, code)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={String(r.status ?? "active").toLowerCase()} />,
    },
    {
      key: "spend",
      header: "Total billed",
      align: "right",
      render: (r) => (
        <span className="text-sm font-semibold tabular-nums">{currencyIn(r.spend, code)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Vendors"
        description={`${rows.length.toLocaleString()} contacts imported from your connected systems, ranked by billed value.`}
        crumbs={[{ label: "Vendors" }]}
        actions={
          <Button
            variant="outline"
            className="gap-2"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                "vendors.csv",
                rows.map((r) => ({ ...r })),
              )
            }
          >
            <Download className="size-4" /> Export
          </Button>
        }
      />
      {!isLoading && rows.length === 0 ? (
        <NoImportedData title="No vendors imported yet" />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          loading={isLoading}
          rowKey={(r) => r.id}
          searchKeys={["name", "email", "status"]}
          searchPlaceholder="Search vendors…"
        />
      )}
    </>
  );
}
