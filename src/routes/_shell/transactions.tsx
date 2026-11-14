import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge, ToneBadge } from "@/components/common/tone-badge";
import { NoImportedData } from "@/components/common/no-data";
import { Button } from "@/components/ui/button";
import { useErpFinancials } from "@/hooks/use-erp";
import { downloadCsv } from "@/lib/csv";
import { currencyIn, dateShort } from "@/lib/format";

type Row = Record<string, any>;

interface Txn {
  id: string;
  kind: "invoice" | "bill" | "payment";
  reference: string;
  party: string;
  date: string | null;
  amount: number;
  currency: string | null;
  status: string;
}

export const Route = createFileRoute("/_shell/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — AutoAudit" },
      {
        name: "description",
        content:
          "One combined ledger of every invoice, bill and payment imported from your connected accounting systems.",
      },
      { property: "og:title", content: "Transactions — AutoAudit" },
      {
        property: "og:description",
        content: "Combined ledger of imported invoices, bills and payments.",
      },
    ],
  }),
  component: TransactionsPage,
});

const FILTERS = [
  { id: "all", label: "All" },
  { id: "invoice", label: "Invoices" },
  { id: "bill", label: "Bills" },
  { id: "payment", label: "Payments" },
] as const;

function TransactionsPage() {
  const { data, isLoading } = useErpFinancials();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const all = useMemo<Txn[]>(() => {
    const invoices = ((data?.invoices ?? []) as Row[]).map((i) => ({
      id: `i-${i["id"]}`,
      kind: (i["type"] === "bill" ? "bill" : "invoice") as Txn["kind"],
      reference: String(i["invoice_number"] ?? i["external_id"] ?? ""),
      party: String(i["vendor_name"] ?? "—"),
      date: (i["issue_date"] as string | null) ?? null,
      amount: Number(i["amount"] ?? 0),
      currency: (i["currency"] as string | null) ?? null,
      status: String(i["status"] ?? "unknown").toLowerCase(),
    }));
    const payments = ((data?.payments ?? []) as Row[]).map((p) => ({
      id: `p-${p["id"]}`,
      kind: "payment" as const,
      reference: String(p["reference"] ?? p["external_id"] ?? ""),
      party: String(p["vendor_name"] ?? "—"),
      date: (p["paid_date"] as string | null) ?? null,
      amount: Number(p["amount"] ?? 0),
      currency: (p["currency"] as string | null) ?? null,
      status: "settled",
    }));
    return [...invoices, ...payments].sort((a, b) =>
      String(b.date ?? "").localeCompare(String(a.date ?? "")),
    );
  }, [data]);

  const rows = filter === "all" ? all : all.filter((t) => t.kind === filter);

  const columns: Column<Txn>[] = [
    {
      key: "reference",
      header: "Record",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{r.reference || "—"}</p>
          <p className="text-xs text-muted-foreground capitalize">{r.kind}</p>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (r) => <span className="text-sm">{dateShort(r.date)}</span>,
    },
    { key: "party", header: "Party", render: (r) => <span className="text-sm">{r.party}</span> },
    {
      key: "kind",
      header: "Type",
      render: (r) => (
        <ToneBadge
          tone={r.kind === "payment" ? "accent" : r.kind === "bill" ? "warning" : "brand"}
          size="sm"
        >
          {r.kind}
        </ToneBadge>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (r) => (
        <span className="text-sm font-semibold tabular-nums">
          {currencyIn(r.amount, r.currency)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Transactions"
        description={`${all.length.toLocaleString()} records imported from your connected accounting systems.`}
        crumbs={[{ label: "Transactions" }]}
        actions={
          <Button
            variant="outline"
            className="gap-2"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                "transactions.csv",
                rows.map((r) => ({ ...r })),
              )
            }
          >
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />
      {!isLoading && all.length === 0 ? (
        <NoImportedData title="No transactions imported yet" />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          loading={isLoading}
          rowKey={(r) => r.id}
          searchKeys={["reference", "party", "status"]}
          searchPlaceholder="Search transactions…"
          toolbar={
            <div className="flex items-center gap-1">
              {FILTERS.map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant={filter === f.id ? "default" : "outline"}
                  className="h-9"
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          }
        />
      )}
    </>
  );
}
