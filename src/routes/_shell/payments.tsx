import React, { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  Filter,
  Download,
  Building2,
  Users,
  CreditCard,
  Banknote,
  Receipt,
  FileCheck,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listPayments,
  recordPayment,
  getCashBankBalances,
  type RecordPaymentInput,
} from "@/lib/billing/payments.functions";
import { listCustomers } from "@/lib/billing/parties.functions";
import { listSuppliers } from "@/lib/billing/parties.functions";
import { listSalesInvoices } from "@/lib/billing/sales.functions";
import { listPurchaseBills } from "@/lib/billing/purchases.functions";
import { currencyIn, dateShort } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { useErpFinancials } from "@/hooks/use-erp";

export const Route = createFileRoute("/_shell/payments")({
  head: () => ({
    meta: [
      { title: "Payments & Cashbook — Auto Audit" },
      {
        name: "description",
        content:
          "Track payment-in collections, payment-out expenses, cash in hand and bank account balances.",
      },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [paymentModeFilter, setPaymentModeFilter] = useState("all");

  // Dialogs
  const [isRecordInOpen, setIsRecordInOpen] = useState(false);
  const [isRecordOutOpen, setIsRecordOutOpen] = useState(false);

  // Server functions
  const listPaymentsFn = useServerFn(listPayments);
  const recordPaymentFn = useServerFn(recordPayment);
  const getBalancesFn = useServerFn(getCashBankBalances);
  const listCustomersFn = useServerFn(listCustomers);
  const listSuppliersFn = useServerFn(listSuppliers);
  const listInvoicesFn = useServerFn(listSalesInvoices);
  const listBillsFn = useServerFn(listPurchaseBills);

  // Existing ERP hook
  const { data: erpData, isLoading: isErpLoading } = useErpFinancials();

  // Queries
  const { data: balances } = useQuery({
    queryKey: ["cashBankBalances"],
    queryFn: () => getBalancesFn(),
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments", tab, paymentModeFilter],
    queryFn: () =>
      listPaymentsFn({
        data: {
          paymentType: tab === "all" || tab === "erp" ? undefined : tab,
          paymentMode: paymentModeFilter === "all" ? undefined : paymentModeFilter,
        },
      }),
    enabled: tab !== "erp",
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomersFn({ data: {} }),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => listSuppliersFn({ data: {} }),
  });

  // Pending invoices for Payment-In
  const { data: unpaidInvoices = [] } = useQuery({
    queryKey: ["unpaidInvoices"],
    queryFn: () => listInvoicesFn({ data: { status: "unpaid" } }),
  });

  // Pending bills for Payment-Out
  const { data: unpaidBills = [] } = useQuery({
    queryKey: ["unpaidBills"],
    queryFn: () => listBillsFn({ data: { status: "unpaid" } }),
  });

  // Payment In Form
  const [inCustomer, setInCustomer] = useState("");
  const [inInvoice, setInInvoice] = useState("");
  const [inAmount, setInAmount] = useState(0);
  const [inDate, setInDate] = useState(new Date().toISOString().substring(0, 10));
  const [inMode, setInMode] = useState<any>("cash");
  const [inRef, setInRef] = useState("");
  const [inNotes, setInNotes] = useState("");

  // Payment Out Form
  const [outSupplier, setOutSupplier] = useState("");
  const [outBill, setOutBill] = useState("");
  const [outAmount, setOutAmount] = useState(0);
  const [outDate, setOutDate] = useState(new Date().toISOString().substring(0, 10));
  const [outMode, setOutMode] = useState<any>("bank_transfer");
  const [outRef, setOutRef] = useState("");
  const [outNotes, setOutNotes] = useState("");

  const handleOpenPaymentIn = () => {
    setInCustomer("");
    setInInvoice("");
    setInAmount(0);
    setInDate(new Date().toISOString().substring(0, 10));
    setInMode("cash");
    setInRef("");
    setInNotes("");
    setIsRecordInOpen(true);
  };

  const handleOpenPaymentOut = () => {
    setOutSupplier("");
    setOutBill("");
    setOutAmount(0);
    setOutDate(new Date().toISOString().substring(0, 10));
    setOutMode("bank_transfer");
    setOutRef("");
    setOutNotes("");
    setIsRecordOutOpen(true);
  };

  // When an invoice is selected in Payment In, prefill customer and amount
  const handleSelectInvoiceForPayment = (invId: string) => {
    setInInvoice(invId);
    const inv = unpaidInvoices.find((i) => i.id === invId);
    if (inv) {
      if (inv.customer_id) setInCustomer(inv.customer_id);
      setInAmount(Number(inv.balance_due) || Number(inv.grand_total));
    }
  };

  // When a bill is selected in Payment Out, prefill supplier and amount
  const handleSelectBillForPayment = (billId: string) => {
    setOutBill(billId);
    const bill = unpaidBills.find((b) => b.id === billId);
    if (bill) {
      if (bill.supplier_id) setOutSupplier(bill.supplier_id);
      setOutAmount(Number(bill.balance_due) || Number(bill.grand_total));
    }
  };

  const handleSavePaymentIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inAmount <= 0) {
      alert("Amount must be greater than 0");
      return;
    }

    try {
      await recordPaymentFn({
        data: {
          paymentType: "payment_in",
          partyType: "customer",
          customerId: inCustomer || null,
          invoiceId: inInvoice || null,
          amount: inAmount,
          paymentDate: inDate,
          paymentMode: inMode,
          referenceNumber: inRef || null,
          notes: inNotes || null,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["cashBankBalances"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setIsRecordInOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to record payment");
    }
  };

  const handleSavePaymentOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (outAmount <= 0) {
      alert("Amount must be greater than 0");
      return;
    }

    try {
      await recordPaymentFn({
        data: {
          paymentType: "payment_out",
          partyType: "supplier",
          supplierId: outSupplier || null,
          billId: outBill || null,
          amount: outAmount,
          paymentDate: outDate,
          paymentMode: outMode,
          referenceNumber: outRef || null,
          notes: outNotes || null,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["cashBankBalances"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      setIsRecordOutOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to record payment");
    }
  };

  const handleExportCsv = () => {
    const rows = payments.map((p) => ({
      "Payment Number": p.payment_number,
      Type: p.payment_type === "payment_in" ? "Payment Received" : "Payment Made",
      Date: p.payment_date,
      Party: (p.customer as any)?.name || (p.supplier as any)?.name || "Direct Party",
      Mode: p.payment_mode,
      Amount: p.amount,
      Reference: p.reference_number || "",
    }));
    downloadCsv(`payments-${new Date().toISOString().substring(0, 10)}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments & Cashbook"
        description="Manage cash collections, bank payouts, settle invoices and monitor real-time liquidity."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={payments.length === 0}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenPaymentOut}
              className="text-amber-600 border-amber-200 hover:bg-amber-50"
            >
              <ArrowUpRight className="w-4 h-4 mr-1.5" />
              Payment-Out
            </Button>
            <Button
              size="sm"
              onClick={handleOpenPaymentIn}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <ArrowDownLeft className="w-4 h-4 mr-1.5" />
              Payment-In
            </Button>
          </div>
        }
      />

      {/* Liquidity Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-card rounded-xl border flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Cash in Hand
            </span>
            <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">
              {currencyIn(balances?.cashInHand ?? 0, "INR")}
            </p>
            <span className="text-xs text-muted-foreground">Physical register balance</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <Banknote className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-card rounded-xl border flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Bank Balance
            </span>
            <p className="text-2xl font-bold font-mono text-blue-600 mt-1">
              {currencyIn(balances?.bankBalance ?? 0, "INR")}
            </p>
            <span className="text-xs text-muted-foreground">Bank & UPI transfers</span>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-card rounded-xl border flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Total Liquidity
            </span>
            <p className="text-2xl font-bold font-mono text-foreground mt-1">
              {currencyIn(balances?.totalLiquidity ?? 0, "INR")}
            </p>
            <span className="text-xs text-muted-foreground">Net operating liquid funds</span>
          </div>
          <div className="p-3 bg-muted rounded-xl text-foreground">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        {[
          { id: "all", label: "All Transactions" },
          { id: "payment_in", label: "Payment-In (Receipts)" },
          { id: "payment_out", label: "Payment-Out (Payouts)" },
          { id: "erp", label: "Imported ERP Payments" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              tab === t.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Payments Table */}
      {tab === "erp" ? (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="p-3 bg-muted/40 border-b text-xs font-medium text-muted-foreground">
            Payments synchronized from connected ERP
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <th className="py-3 px-4">Payment Ref</th>
                  <th className="py-3 px-3">Party</th>
                  <th className="py-3 px-3">Method</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isErpLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Loading ERP payments...
                    </td>
                  </tr>
                ) : (erpData?.payments ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      No ERP payments imported yet.
                    </td>
                  </tr>
                ) : (
                  (erpData?.payments ?? []).map((r: any, idx: number) => (
                    <tr key={r.id || idx} className="hover:bg-muted/30">
                      <td className="py-3 px-4 font-mono font-medium">
                        {r.reference || r.external_id}
                      </td>
                      <td className="py-3 px-3">{r.vendor_name || "—"}</td>
                      <td className="py-3 px-3 capitalize text-xs text-muted-foreground">
                        {r.method || "Cash"}
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">
                        {dateShort(r.paid_date)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                        {currencyIn(r.amount, "INR")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <th className="py-3 px-4">Payment #</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Party</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Mode</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3">Linked Invoice / Bill</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      Loading payments...
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <Wallet className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="font-medium text-base text-foreground">No payments recorded</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Record your cash and bank payments to keep balances synchronized.
                      </p>
                      <div className="flex justify-center gap-2 mt-4">
                        <Button
                          size="sm"
                          onClick={handleOpenPaymentIn}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <ArrowDownLeft className="w-4 h-4 mr-1.5" />
                          Payment-In
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleOpenPaymentOut}>
                          <ArrowUpRight className="w-4 h-4 mr-1.5" />
                          Payment-Out
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => {
                    const isIn = p.payment_type === "payment_in";
                    return (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-foreground">
                          {p.payment_number}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${
                              isIn
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {isIn ? (
                              <ArrowDownLeft className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            {isIn ? "Received" : "Paid Out"}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-foreground">
                            {(p.customer as any)?.name ||
                              (p.supplier as any)?.name ||
                              "Direct Party"}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">
                          {dateShort(p.payment_date)}
                        </td>
                        <td className="py-3 px-3 text-xs capitalize text-muted-foreground">
                          {p.payment_mode.replace("_", " ")}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <span className={isIn ? "text-emerald-600" : "text-amber-600"}>
                            {isIn ? "+" : "-"} {currencyIn(p.amount, "INR")}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs font-mono text-muted-foreground">
                          {(p.invoice as any)?.invoice_number ||
                            (p.bill as any)?.bill_number ||
                            "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment-In Dialog */}
      <Dialog open={isRecordInOpen} onOpenChange={setIsRecordInOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <ArrowDownLeft className="w-5 h-5" /> Record Payment Received
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSavePaymentIn} className="space-y-4">
            <div>
              <label className="text-xs font-semibold">Customer</label>
              <select
                value={inCustomer}
                onChange={(e) => setInCustomer(e.target.value)}
                className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
              >
                <option value="">Walk-in / Direct Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Due: Rs. {c.current_balance})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold">Settle Against Invoice (Optional)</label>
              <select
                value={inInvoice}
                onChange={(e) => handleSelectInvoiceForPayment(e.target.value)}
                className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
              >
                <option value="">None / General Advance</option>
                {unpaidInvoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoice_number} — Due: Rs. {i.balance_due}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold">Amount Received (Rs.) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={inAmount}
                  onChange={(e) => setInAmount(parseFloat(e.target.value) || 0)}
                  className="mt-1 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Payment Date</label>
                <Input
                  type="date"
                  required
                  value={inDate}
                  onChange={(e) => setInDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold">Payment Mode</label>
                <select
                  value={inMode}
                  onChange={(e) => setInMode(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
                >
                  <option value="cash">Cash in Hand</option>
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                  <option value="upi">UPI / QR Code</option>
                  <option value="cheque">Cheque</option>
                  <option value="card">Debit / Credit Card</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold">Reference / UTR</label>
                <Input
                  placeholder="e.g. UPI Ref / Cheque No"
                  value={inRef}
                  onChange={(e) => setInRef(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold">Notes</label>
              <Input
                placeholder="Optional payment notes"
                value={inNotes}
                onChange={(e) => setInNotes(e.target.value)}
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRecordInOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Payment-Out Dialog */}
      <Dialog open={isRecordOutOpen} onOpenChange={setIsRecordOutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <ArrowUpRight className="w-5 h-5" /> Record Payment Made (Payout)
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSavePaymentOut} className="space-y-4">
            <div>
              <label className="text-xs font-semibold">Supplier / Vendor</label>
              <select
                value={outSupplier}
                onChange={(e) => setOutSupplier(e.target.value)}
                className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
              >
                <option value="">Direct Vendor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Payable: Rs. {s.current_balance})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold">Settle Against Bill (Optional)</label>
              <select
                value={outBill}
                onChange={(e) => handleSelectBillForPayment(e.target.value)}
                className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
              >
                <option value="">None / Advance Payment</option>
                {unpaidBills.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bill_number} — Due: Rs. {b.balance_due}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold">Amount Paid (Rs.) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={outAmount}
                  onChange={(e) => setOutAmount(parseFloat(e.target.value) || 0)}
                  className="mt-1 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Payment Date</label>
                <Input
                  type="date"
                  required
                  value={outDate}
                  onChange={(e) => setOutDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold">Payment Mode</label>
                <select
                  value={outMode}
                  onChange={(e) => setOutMode(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
                >
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold">Reference / UTR</label>
                <Input
                  placeholder="e.g. Bank Ref No"
                  value={outRef}
                  onChange={(e) => setOutRef(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold">Notes</label>
              <Input
                placeholder="Optional notes"
                value={outNotes}
                onChange={(e) => setOutNotes(e.target.value)}
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRecordOutOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Record Payout</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
