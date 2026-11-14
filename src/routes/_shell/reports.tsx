import React, { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ClipboardCheck,
  FileSpreadsheet,
  Download,
  Calendar,
  Printer,
  TrendingUp,
  Receipt,
  ShoppingCart,
  Percent,
  Package,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getSalesReport,
  getPurchaseReport,
  getGstr1Report,
  getGstr3bSummary,
  getStockValuationReport,
  getProfitAndLossReport,
} from "@/lib/billing/reports.functions";
import { currencyIn, dateShort, percent } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_shell/reports")({
  head: () => ({
    meta: [
      { title: "Financial Reports & GST Returns — Auto Audit" },
      {
        name: "description",
        content:
          "Comprehensive Sales Register, Purchase Register, GSTR-1, GSTR-3B, Stock Valuation and Profit & Loss reports.",
      },
    ],
  }),
  component: ReportsPage,
});

type ReportTab = "pnl" | "sales" | "purchases" | "gstr1" | "gstr3b" | "stock";

function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("pnl");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Server functions
  const getPnlFn = useServerFn(getProfitAndLossReport);
  const getSalesFn = useServerFn(getSalesReport);
  const getPurchasesFn = useServerFn(getPurchaseReport);
  const getGstr1Fn = useServerFn(getGstr1Report);
  const getGstr3bFn = useServerFn(getGstr3bSummary);
  const getStockFn = useServerFn(getStockValuationReport);

  // Queries
  const { data: pnlData, isLoading: isPnlLoading } = useQuery({
    queryKey: ["pnlReport", fromDate, toDate],
    queryFn: () =>
      getPnlFn({ data: { fromDate: fromDate || undefined, toDate: toDate || undefined } }),
    enabled: activeTab === "pnl",
  });

  const { data: salesData, isLoading: isSalesLoading } = useQuery({
    queryKey: ["salesReport", fromDate, toDate],
    queryFn: () =>
      getSalesFn({ data: { fromDate: fromDate || undefined, toDate: toDate || undefined } }),
    enabled: activeTab === "sales",
  });

  const { data: purchasesData, isLoading: isPurchasesLoading } = useQuery({
    queryKey: ["purchasesReport", fromDate, toDate],
    queryFn: () =>
      getPurchasesFn({ data: { fromDate: fromDate || undefined, toDate: toDate || undefined } }),
    enabled: activeTab === "purchases",
  });

  const { data: gstr1Data, isLoading: isGstr1Loading } = useQuery({
    queryKey: ["gstr1Report", fromDate, toDate],
    queryFn: () =>
      getGstr1Fn({ data: { fromDate: fromDate || undefined, toDate: toDate || undefined } }),
    enabled: activeTab === "gstr1",
  });

  const { data: gstr3bData, isLoading: isGstr3bLoading } = useQuery({
    queryKey: ["gstr3bReport", fromDate, toDate],
    queryFn: () =>
      getGstr3bFn({ data: { fromDate: fromDate || undefined, toDate: toDate || undefined } }),
    enabled: activeTab === "gstr3b",
  });

  const { data: stockData, isLoading: isStockLoading } = useQuery({
    queryKey: ["stockValuationReport"],
    queryFn: () => getStockFn(),
    enabled: activeTab === "stock",
  });

  const handleExport = () => {
    if (activeTab === "sales" && salesData) {
      const rows = salesData.invoices.map((i) => ({
        "Invoice Number": i.invoice_number,
        Date: i.invoice_date,
        Customer: (i.customer as any)?.name || "Cash Customer",
        GSTIN: (i.customer as any)?.gstin || "",
        "Taxable Amount": i.taxable_amount,
        CGST: i.cgst_amount,
        SGST: i.sgst_amount,
        IGST: i.igst_amount,
        "Total Tax": i.total_tax,
        "Grand Total": i.grand_total,
        Status: i.status,
      }));
      downloadCsv(`sales-register-${new Date().toISOString().substring(0, 10)}.csv`, rows);
    } else if (activeTab === "purchases" && purchasesData) {
      const rows = purchasesData.bills.map((b) => ({
        "Bill Number": b.bill_number,
        Date: b.bill_date,
        Supplier: (b.supplier as any)?.name || "Vendor",
        GSTIN: (b.supplier as any)?.gstin || "",
        "Taxable Amount": b.taxable_amount,
        "Total Tax": b.total_tax,
        "Grand Total": b.grand_total,
        Status: b.status,
      }));
      downloadCsv(`purchase-register-${new Date().toISOString().substring(0, 10)}.csv`, rows);
    } else if (activeTab === "stock" && stockData) {
      const rows = stockData.products.map((p) => ({
        Name: p.name,
        Category: (p.category as any)?.name || "",
        "Current Stock": p.current_stock,
        Unit: p.unit,
        "Purchase Price": p.purchase_price,
        "Selling Price": p.selling_price,
        "Purchase Valuation": p.purchaseValuation,
        "Sales Valuation": p.salesValuation,
      }));
      downloadCsv(`stock-valuation-${new Date().toISOString().substring(0, 10)}.csv`, rows);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Reports & GST"
        description="Board-ready financial statements, GST GSTR-1 and GSTR-3B filings, stock valuation and P&L analysis."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="print:hidden"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Print
            </Button>
            <Button size="sm" onClick={handleExport} className="print:hidden">
              <Download className="w-4 h-4 mr-1.5" />
              Export Report
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-2 print:hidden">
        {[
          { id: "pnl", label: "Profit & Loss (P&L)" },
          { id: "sales", label: "Sales Register" },
          { id: "purchases", label: "Purchase Register" },
          { id: "gstr1", label: "GST GSTR-1 Summary" },
          { id: "gstr3b", label: "GST GSTR-3B Summary" },
          { id: "stock", label: "Stock Valuation" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ReportTab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date Filter Bar */}
      {activeTab !== "stock" && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/40 rounded-xl border print:hidden">
          <span className="text-xs font-semibold text-muted-foreground">Date Range:</span>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 text-xs w-36"
              placeholder="From Date"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 text-xs w-36"
              placeholder="To Date"
            />
          </div>
          {(fromDate || toDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
              className="h-8 text-xs"
            >
              Reset
            </Button>
          )}
        </div>
      )}

      {/* 1. Profit & Loss Report */}
      {activeTab === "pnl" && (
        <div className="space-y-6">
          {isPnlLoading ? (
            <div className="py-12 text-center text-muted-foreground">Calculating statement...</div>
          ) : pnlData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-card rounded-xl border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Revenue (Sales)
                  </span>
                  <p className="text-2xl font-bold font-mono text-foreground mt-1">
                    {currencyIn(pnlData.revenue, "INR")}
                  </p>
                </div>
                <div className="p-4 bg-card rounded-xl border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Cost of Goods (COGS)
                  </span>
                  <p className="text-2xl font-bold font-mono text-muted-foreground mt-1">
                    {currencyIn(pnlData.costOfGoodsSold, "INR")}
                  </p>
                </div>
                <div className="p-4 bg-card rounded-xl border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Gross Profit
                  </span>
                  <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                    {currencyIn(pnlData.grossProfit, "INR")}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {pnlData.grossMarginPct}% Margin
                  </span>
                </div>
                <div className="p-4 bg-card rounded-xl border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Net Profit
                  </span>
                  <p
                    className={`text-2xl font-bold font-mono mt-1 ${
                      pnlData.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {currencyIn(pnlData.netProfit, "INR")}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {pnlData.netMarginPct}% Net Margin
                  </span>
                </div>
              </div>

              {/* Statement details */}
              <div className="bg-card rounded-xl border overflow-hidden p-6 max-w-2xl mx-auto space-y-4">
                <h3 className="font-bold text-base text-foreground border-b pb-2">
                  Profit & Loss Breakdown
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1.5 border-b font-medium">
                    <span>1. Total Sales Revenue</span>
                    <span className="font-mono">{currencyIn(pnlData.revenue, "INR")}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b text-muted-foreground">
                    <span>2. Less: Cost of Purchases (COGS)</span>
                    <span className="font-mono">
                      - {currencyIn(pnlData.costOfGoodsSold, "INR")}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b font-bold text-emerald-600">
                    <span>3. Gross Profit (1 - 2)</span>
                    <span className="font-mono">{currencyIn(pnlData.grossProfit, "INR")}</span>
                  </div>

                  <div className="pt-2">
                    <span className="font-semibold text-xs uppercase text-muted-foreground">
                      Operating Expenses:
                    </span>
                    <div className="divide-y mt-2">
                      {pnlData.expenseBreakdown.length === 0 ? (
                        <div className="py-2 text-xs text-muted-foreground">
                          No operating expenses recorded
                        </div>
                      ) : (
                        pnlData.expenseBreakdown.map((exp, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between py-1 text-xs text-muted-foreground"
                          >
                            <span>{exp.category}</span>
                            <span className="font-mono">{currencyIn(exp.amount, "INR")}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between py-1.5 border-b text-rose-600 font-medium">
                    <span>4. Total Operating Expenses</span>
                    <span className="font-mono">- {currencyIn(pnlData.totalExpenses, "INR")}</span>
                  </div>

                  <div className="flex justify-between py-3 border-t-2 border-foreground text-base font-bold text-foreground">
                    <span>Net Business Profit (3 - 4)</span>
                    <span className="font-mono">{currencyIn(pnlData.netProfit, "INR")}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* 2. Sales Register */}
      {activeTab === "sales" && (
        <div className="space-y-4">
          {isSalesLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading sales register...</div>
          ) : salesData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted/40 rounded-xl border text-center">
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Invoices</span>
                  <p className="font-mono font-bold text-lg">{salesData.summary.count}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Taxable Value</span>
                  <p className="font-mono font-bold text-lg">
                    {currencyIn(salesData.summary.totalTaxable, "INR")}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase">GST Collected</span>
                  <p className="font-mono font-bold text-lg">
                    {currencyIn(salesData.summary.totalTax, "INR")}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Total Billed</span>
                  <p className="font-mono font-bold text-lg text-emerald-600">
                    {currencyIn(salesData.summary.totalSales, "INR")}
                  </p>
                </div>
              </div>

              <div className="bg-card rounded-xl border overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/60 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-2">Date</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-2">GSTIN</th>
                      <th className="py-2.5 px-2 text-right">Taxable</th>
                      <th className="py-2.5 px-2 text-right">CGST</th>
                      <th className="py-2.5 px-2 text-right">SGST</th>
                      <th className="py-2.5 px-2 text-right">IGST</th>
                      <th className="py-2.5 px-3 text-right">Grand Total</th>
                      <th className="py-2.5 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {salesData.invoices.map((i) => (
                      <tr key={i.id} className="hover:bg-muted/10">
                        <td className="py-2 px-3 font-mono font-bold">{i.invoice_number}</td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {dateShort(i.invoice_date)}
                        </td>
                        <td className="py-2 px-3">{(i.customer as any)?.name || "Cash"}</td>
                        <td className="py-2 px-2 font-mono text-muted-foreground">
                          {(i.customer as any)?.gstin || "-"}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {currencyIn(i.taxable_amount, "INR")}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {currencyIn(i.cgst_amount, "INR")}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {currencyIn(i.sgst_amount, "INR")}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {currencyIn(i.igst_amount, "INR")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {currencyIn(i.grand_total, "INR")}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="px-2 py-0.5 rounded-full capitalize text-[10px] bg-muted">
                            {i.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* 3. Purchase Register */}
      {activeTab === "purchases" && (
        <div className="space-y-4">
          {isPurchasesLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              Loading purchase register...
            </div>
          ) : purchasesData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted/40 rounded-xl border text-center">
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Bills</span>
                  <p className="font-mono font-bold text-lg">{purchasesData.summary.count}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Taxable Value</span>
                  <p className="font-mono font-bold text-lg">
                    {currencyIn(purchasesData.summary.totalTaxable, "INR")}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Input Tax (ITC)</span>
                  <p className="font-mono font-bold text-lg">
                    {currencyIn(purchasesData.summary.totalTax, "INR")}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Total Purchases</span>
                  <p className="font-mono font-bold text-lg text-foreground">
                    {currencyIn(purchasesData.summary.totalPurchases, "INR")}
                  </p>
                </div>
              </div>

              <div className="bg-card rounded-xl border overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/60 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">Bill #</th>
                      <th className="py-2.5 px-2">Date</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-2 text-right">Taxable</th>
                      <th className="py-2.5 px-2 text-right">Tax (ITC)</th>
                      <th className="py-2.5 px-3 text-right">Grand Total</th>
                      <th className="py-2.5 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {purchasesData.bills.map((b) => (
                      <tr key={b.id} className="hover:bg-muted/10">
                        <td className="py-2 px-3 font-mono font-bold">{b.bill_number}</td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {dateShort(b.bill_date)}
                        </td>
                        <td className="py-2 px-3">{(b.supplier as any)?.name || "Vendor"}</td>
                        <td className="py-2 px-2 text-right font-mono">
                          {currencyIn(b.taxable_amount, "INR")}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {currencyIn(b.total_tax, "INR")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {currencyIn(b.grand_total, "INR")}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="px-2 py-0.5 rounded-full capitalize text-[10px] bg-muted">
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* 4. GST GSTR-1 Summary */}
      {activeTab === "gstr1" && (
        <div className="space-y-6">
          {isGstr1Loading ? (
            <div className="py-12 text-center text-muted-foreground">
              Preparing GSTR-1 summary...
            </div>
          ) : gstr1Data ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-card rounded-xl border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    B2B Invoices (Registered Customers with GSTIN)
                  </span>
                  <p className="text-2xl font-bold font-mono text-foreground mt-1">
                    {currencyIn(gstr1Data.b2bTotal, "INR")}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {gstr1Data.b2bCount} invoices
                  </span>
                </div>
                <div className="p-4 bg-card rounded-xl border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    B2C Invoices (Unregistered / Consumers)
                  </span>
                  <p className="text-2xl font-bold font-mono text-foreground mt-1">
                    {currencyIn(gstr1Data.b2cTotal, "INR")}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {gstr1Data.b2cCount} invoices
                  </span>
                </div>
              </div>

              {/* HSN Summary Table */}
              <div className="bg-card rounded-xl border overflow-hidden">
                <div className="p-3 bg-muted/40 border-b font-semibold text-xs">
                  HSN / SAC Wise Summary
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/60 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">HSN Code</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-2 text-right">Quantity</th>
                      <th className="py-2.5 px-2 text-right">Taxable Value</th>
                      <th className="py-2.5 px-2 text-right">CGST</th>
                      <th className="py-2.5 px-2 text-right">SGST</th>
                      <th className="py-2.5 px-2 text-right">IGST</th>
                      <th className="py-2.5 px-3 text-right">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {gstr1Data.hsnSummary.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-muted-foreground">
                          No HSN records in selected period
                        </td>
                      </tr>
                    ) : (
                      gstr1Data.hsnSummary.map((h, idx) => (
                        <tr key={idx} className="hover:bg-muted/10">
                          <td className="py-2 px-3 font-mono font-bold">{h.hsn}</td>
                          <td className="py-2 px-3">{h.description}</td>
                          <td className="py-2 px-2 text-right font-mono">{h.qty}</td>
                          <td className="py-2 px-2 text-right font-mono">
                            {currencyIn(h.taxable, "INR")}
                          </td>
                          <td className="py-2 px-2 text-right font-mono">
                            {currencyIn(h.cgst, "INR")}
                          </td>
                          <td className="py-2 px-2 text-right font-mono">
                            {currencyIn(h.sgst, "INR")}
                          </td>
                          <td className="py-2 px-2 text-right font-mono">
                            {currencyIn(h.igst, "INR")}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {currencyIn(h.tax, "INR")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* 5. GST GSTR-3B Summary */}
      {activeTab === "gstr3b" && (
        <div className="space-y-6">
          {isGstr3bLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              Calculating GSTR-3B summary...
            </div>
          ) : gstr3bData ? (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="bg-card rounded-xl border overflow-hidden p-6 space-y-4">
                <h3 className="font-bold text-base text-foreground border-b pb-2">
                  GSTR-3B Tax Liability & Input Tax Credit
                </h3>

                <div className="space-y-4 text-xs">
                  {/* Table 3.1 Outward supplies */}
                  <div className="p-4 bg-muted/40 rounded-lg space-y-2">
                    <span className="font-bold uppercase tracking-wider text-foreground">
                      3.1 Details of Outward Taxable Supplies (Output Tax Due)
                    </span>
                    <div className="grid grid-cols-4 gap-2 pt-2">
                      <div>
                        <span className="text-muted-foreground block">Taxable Value</span>
                        <span className="font-mono font-bold text-sm">
                          {currencyIn(gstr3bData.outwardSupplies.taxable, "INR")}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Integrated Tax (IGST)</span>
                        <span className="font-mono font-bold text-sm">
                          {currencyIn(gstr3bData.outwardSupplies.igst, "INR")}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Central Tax (CGST)</span>
                        <span className="font-mono font-bold text-sm">
                          {currencyIn(gstr3bData.outwardSupplies.cgst, "INR")}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">State Tax (SGST)</span>
                        <span className="font-mono font-bold text-sm">
                          {currencyIn(gstr3bData.outwardSupplies.sgst, "INR")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Table 4 Eligible ITC */}
                  <div className="p-4 bg-muted/40 rounded-lg space-y-2">
                    <span className="font-bold uppercase tracking-wider text-emerald-600">
                      4. Eligible Input Tax Credit (ITC from Purchases)
                    </span>
                    <div className="grid grid-cols-4 gap-2 pt-2">
                      <div>
                        <span className="text-muted-foreground block">Purchases Taxable</span>
                        <span className="font-mono font-bold text-sm">
                          {currencyIn(gstr3bData.eligibleItc.taxable, "INR")}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">ITC - IGST</span>
                        <span className="font-mono font-bold text-sm text-emerald-600">
                          {currencyIn(gstr3bData.eligibleItc.igst, "INR")}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">ITC - CGST</span>
                        <span className="font-mono font-bold text-sm text-emerald-600">
                          {currencyIn(gstr3bData.eligibleItc.cgst, "INR")}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">ITC - SGST</span>
                        <span className="font-mono font-bold text-sm text-emerald-600">
                          {currencyIn(gstr3bData.eligibleItc.sgst, "INR")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Net Tax Payable */}
                  <div className="p-4 bg-primary/10 rounded-lg space-y-2 border border-primary/20">
                    <span className="font-bold uppercase tracking-wider text-primary">
                      Net Tax Payable in Cash (Output Tax - Eligible ITC)
                    </span>
                    <div className="grid grid-cols-4 gap-2 pt-2">
                      <div>
                        <span className="text-muted-foreground block">Total Net Tax</span>
                        <span className="font-mono font-bold text-base text-foreground">
                          {currencyIn(gstr3bData.netTaxPayable.total, "INR")}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">IGST Payable</span>
                        <span className="font-mono font-bold text-sm">
                          {currencyIn(gstr3bData.netTaxPayable.igst, "INR")}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">CGST Payable</span>
                        <span className="font-mono font-bold text-sm">
                          {currencyIn(gstr3bData.netTaxPayable.cgst, "INR")}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">SGST Payable</span>
                        <span className="font-mono font-bold text-sm">
                          {currencyIn(gstr3bData.netTaxPayable.sgst, "INR")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* 6. Stock Valuation Report */}
      {activeTab === "stock" && (
        <div className="space-y-4">
          {isStockLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              Calculating inventory valuation...
            </div>
          ) : stockData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted/40 rounded-xl border text-center">
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Total Products</span>
                  <p className="font-mono font-bold text-lg">{stockData.totalItems}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase">
                    Stock Valuation (Cost)
                  </span>
                  <p className="font-mono font-bold text-lg">
                    {currencyIn(stockData.totalPurchaseValuation, "INR")}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Retail Valuation</span>
                  <p className="font-mono font-bold text-lg">
                    {currencyIn(stockData.totalSalesValuation, "INR")}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase">Potential Profit</span>
                  <p className="font-mono font-bold text-lg text-emerald-600">
                    {currencyIn(stockData.potentialProfit, "INR")}
                  </p>
                </div>
              </div>

              <div className="bg-card rounded-xl border overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/60 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-2 text-right">Stock</th>
                      <th className="py-2.5 px-2 text-right">Purchase Price</th>
                      <th className="py-2.5 px-2 text-right">Selling Price</th>
                      <th className="py-2.5 px-3 text-right">Valuation (Cost)</th>
                      <th className="py-2.5 px-3 text-right">Valuation (Retail)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stockData.products.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/10">
                        <td className="py-2 px-3 font-semibold">{p.name}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {(p.category as any)?.name || "-"}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold">
                          {p.current_stock} {p.unit}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {currencyIn(p.purchase_price, "INR")}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {currencyIn(p.selling_price, "INR")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium">
                          {currencyIn(p.purchaseValuation, "INR")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                          {currencyIn(p.salesValuation, "INR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
