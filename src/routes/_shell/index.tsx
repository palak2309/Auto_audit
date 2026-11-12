import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BadgeDollarSign,
  Brain,
  Download,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  Receipt,
  ShoppingCart,
  Users,
  Package,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Building2,
  Banknote,
  CreditCard,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { SeverityBadge, ToneBadge } from "@/components/common/tone-badge";
import { Button } from "@/components/ui/button";
import { useErpOverview } from "@/hooks/use-erp";
import { getDurableMetrics } from "@/lib/leak.functions";
import { getBusinessDashboardMetrics, type DateFilterType } from "@/lib/billing/dashboard.functions";
import { currencyIn, dateShort, number } from "@/lib/format";

export const Route = createFileRoute("/_shell/")({
  head: () => ({
    meta: [
      { title: "Business Dashboard — Auto Audit" },
      {
        name: "description",
        content: "Overview of today's sales, purchases, profit, cash & bank balances, inventory levels, and financial leakage analysis.",
      },
      { property: "og:title", content: "Auto Audit Business Dashboard" },
      {
        property: "og:description",
        content: "Complete business, billing, inventory and financial discrepancy control center.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [dateFilter, setDateFilter] = useState<DateFilterType>("this_month");

  // Server functions
  const fetchDashboardFn = useServerFn(getBusinessDashboardMetrics);
  const fetchMetricsFn = useServerFn(getDurableMetrics);
  const { data: erpOverview, isLoading: isErpLoading, refetch: refetchErp } = useErpOverview();

  // Queries
  const { data: metrics, isLoading: isDashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ["businessDashboard", dateFilter],
    queryFn: () => fetchDashboardFn({ data: { dateFilter } }),
  });

  const { data: durableMetrics, isLoading: isMetricsLoading, refetch: refetchDurable } = useQuery({
    queryKey: ["durableMetrics"],
    queryFn: () => fetchMetricsFn(),
  });

  const handleRefresh = async () => {
    await Promise.all([refetchDashboard(), refetchErp(), refetchDurable()]);
  };

  const leaks = erpOverview?.leaks ?? [];
  const activeLeaksCount = durableMetrics?.activeLeaksCount ?? leaks.length;
  const activeExposure = durableMetrics?.totalExposure ?? erpOverview?.totals?.atRisk ?? 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Business Dashboard"
        description="Real-time financial control center: Sales, Purchases, Inventory, Cash in Hand, and Automated Audit Protection."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void handleRefresh()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
            <Link to="/invoices">
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                Create Invoice
              </Button>
            </Link>
          </div>
        }
      />

      {/* Quick Action Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-card rounded-xl border">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Quick Actions:</span>
          <Link to="/invoices">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Receipt className="w-3.5 h-3.5 mr-1 text-primary" /> New Invoice
            </Button>
          </Link>
          <Link to="/purchases">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <ShoppingCart className="w-3.5 h-3.5 mr-1 text-indigo-500" /> New Purchase Bill
            </Button>
          </Link>
          <Link to="/customers">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Users className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Add Customer
            </Button>
          </Link>
          <Link to="/products">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Package className="w-3.5 h-3.5 mr-1 text-amber-500" /> Add Product
            </Button>
          </Link>
          <Link to="/payments">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Wallet className="w-3.5 h-3.5 mr-1 text-cyan-500" /> Record Payment
            </Button>
          </Link>
        </div>

        {/* Date Filter selector */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilterType)}
            className="h-8 px-2.5 rounded-md border text-xs bg-background font-medium"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="all">Past 12 Months</option>
          </select>
        </div>
      </div>

      {/* Row 1: Core Financial Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="p-4 bg-card rounded-xl border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Sales</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-600 mt-2">
            {currencyIn(metrics?.todaySales ?? 0, "INR")}
          </p>
          <span className="text-xs text-muted-foreground mt-0.5 block">Live today's billings</span>
        </div>

        {/* Period Sales */}
        <div className="p-4 bg-card rounded-xl border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Sales</span>
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-foreground mt-2">
            {currencyIn(metrics?.totalSales ?? 0, "INR")}
          </p>
          <span className="text-xs text-muted-foreground mt-0.5 block">In selected period</span>
        </div>

        {/* Period Purchases */}
        <div className="p-4 bg-card rounded-xl border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Purchases</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-foreground mt-2">
            {currencyIn(metrics?.totalPurchases ?? 0, "INR")}
          </p>
          <span className="text-xs text-muted-foreground mt-0.5 block">In selected period</span>
        </div>

        {/* Net Profit */}
        <div className="p-4 bg-card rounded-xl border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Business Profit</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <BadgeDollarSign className="w-4 h-4" />
            </div>
          </div>
          <p
            className={`text-2xl font-bold font-mono mt-2 ${
              (metrics?.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {currencyIn(metrics?.netProfit ?? 0, "INR")}
          </p>
          <span className="text-xs text-muted-foreground mt-0.5 block">
            Expenses: {currencyIn(metrics?.totalExpenses ?? 0, "INR")}
          </span>
        </div>
      </div>

      {/* Row 2: Outstanding Balances & Liquidity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receivables */}
        <div className="p-4 bg-card rounded-xl border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Receivables</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium">To Receive</span>
          </div>
          <p className="text-2xl font-bold font-mono text-rose-600 mt-2">
            {currencyIn(metrics?.totalReceivables ?? 0, "INR")}
          </p>
          <Link to="/customers" className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1">
            View customer dues <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Payables */}
        <div className="p-4 bg-card rounded-xl border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Payables</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">To Pay</span>
          </div>
          <p className="text-2xl font-bold font-mono text-amber-600 mt-2">
            {currencyIn(metrics?.totalPayables ?? 0, "INR")}
          </p>
          <Link to="/suppliers" className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1">
            View vendor dues <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Cash in Hand */}
        <div className="p-4 bg-card rounded-xl border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cash in Hand</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-600 mt-2">
            {currencyIn(metrics?.cashInHand ?? 0, "INR")}
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">Physical register</span>
        </div>

        {/* Bank Balance */}
        <div className="p-4 bg-card rounded-xl border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bank Balance</span>
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-blue-600 mt-2">
            {currencyIn(metrics?.bankBalance ?? 0, "INR")}
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">
            Total Liquidity: {currencyIn(metrics?.totalLiquidity ?? 0, "INR")}
          </span>
        </div>
      </div>

      {/* Row 3: Auto Audit Discrepancies Alert Banner (Preserving Auto Audit Core Value!) */}
      {activeLeaksCount > 0 ? (
        <div className="p-4 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-violet-500/10 border border-amber-200 dark:border-amber-900 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">Auto Audit Discrepancy Detection Active</span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-rose-500 text-white font-bold">
                  {activeLeaksCount} Issues Found
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                The forensic engine flagged {currencyIn(activeExposure, "INR")} in duplicate purchase bills, duplicate payments, or overpayments.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/leaks">
              <Button size="sm" variant="outline" className="border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950">
                Review Findings <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
            <Link to="/recovery">
              <Button size="sm">Open Recovery Center</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-semibold">Auto Audit Protection Active: No financial discrepancies detected in current ledger.</span>
          </div>
          <Link to="/ai-insights" className="text-xs text-emerald-700 dark:text-emerald-400 underline font-medium">
            View AI Insights
          </Link>
        </div>
      )}

      {/* Row 4: Monthly Trend Graph & Stock Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Bars */}
        <div className="p-5 bg-card rounded-xl border lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="font-bold text-sm text-foreground">Monthly Sales & Purchase Trend</h3>
              <p className="text-xs text-muted-foreground">Sales volume vs supplier purchase spend across past 6 months</p>
            </div>
            <Link to="/reports">
              <Button variant="ghost" size="sm" className="text-xs">
                View Reports <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="space-y-4 pt-2">
            {(metrics?.monthlyTrend || []).map((m, idx) => {
              const maxVal = Math.max(
                ...((metrics?.monthlyTrend || []).map((x) => Math.max(x.sales, x.purchases))),
                1
              );
              const salesPct = Math.round((m.sales / maxVal) * 100);
              const purchasePct = Math.round((m.purchases / maxVal) * 100);

              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground w-16">{m.month}</span>
                    <div className="flex items-center gap-4 text-muted-foreground font-mono">
                      <span>Sales: <strong className="text-foreground">{currencyIn(m.sales, "INR")}</strong></span>
                      <span>Buy: <strong className="text-muted-foreground">{currencyIn(m.purchases, "INR")}</strong></span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 h-2.5">
                    <div className="bg-muted rounded-full overflow-hidden">
                      <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${salesPct}%` }} />
                    </div>
                    <div className="bg-muted rounded-full overflow-hidden">
                      <div className="bg-indigo-400 h-full rounded-full transition-all" style={{ width: `${purchasePct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Inventory & Low Stock Card */}
        <div className="p-5 bg-card rounded-xl border space-y-4 flex flex-col justify-between">
          <div className="border-b pb-3">
            <h3 className="font-bold text-sm text-foreground">Inventory Health</h3>
            <p className="text-xs text-muted-foreground">Catalog items and stock alerts</p>
          </div>

          <div className="space-y-4 my-auto">
            <div className="flex justify-between items-center p-3 bg-muted/40 rounded-lg">
              <span className="text-xs font-semibold text-foreground">Total Active Products:</span>
              <span className="font-mono font-bold text-base text-foreground">{metrics?.totalProducts ?? 0}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-muted/40 rounded-lg">
              <span className="text-xs font-semibold text-foreground">Inventory Valuation (Cost):</span>
              <span className="font-mono font-bold text-base text-foreground">
                {currencyIn(metrics?.totalStockValuation ?? 0, "INR")}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-rose-500/10 border border-rose-200 dark:border-rose-900 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400">Low Stock Items:</span>
              </div>
              <span className="font-mono font-bold text-base text-rose-600">
                {metrics?.lowStockProducts ?? 0}
              </span>
            </div>
          </div>

          <Link to="/products" className="w-full">
            <Button variant="outline" size="sm" className="w-full">
              Manage Inventory Stock
            </Button>
          </Link>
        </div>
      </div>

      {/* Row 5: Recent Invoices Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-bold text-sm text-foreground">Recent Invoices</h3>
            <p className="text-xs text-muted-foreground">Latest billing activity generated</p>
          </div>
          <Link to="/invoices">
            <Button variant="ghost" size="sm" className="text-xs">
              View All Invoices <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground font-semibold uppercase">
                <th className="py-2.5 px-4">Invoice #</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(metrics?.recentInvoices || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No invoices generated yet. Click "Create Invoice" above to start.
                  </td>
                </tr>
              ) : (
                (metrics?.recentInvoices || []).map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/20">
                    <td className="py-2.5 px-4 font-mono font-bold text-foreground">{inv.invoiceNumber}</td>
                    <td className="py-2.5 px-3 font-medium text-foreground">{inv.customerName}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{dateShort(inv.date)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                      {currencyIn(inv.amount, "INR")}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full capitalize text-[10px] font-semibold ${
                          inv.status === "paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : inv.status === "partially_paid"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {inv.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
