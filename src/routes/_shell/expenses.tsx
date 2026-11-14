import React, { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  Download,
  Trash2,
  Calendar,
  Tag,
  TrendingDown,
  PieChart,
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
  listExpenses,
  createExpense,
  deleteExpense,
  getExpenseSummary,
  EXPENSE_CATEGORIES,
} from "@/lib/billing/expenses.functions";
import { currencyIn, dateShort } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_shell/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses Tracker — Auto Audit" },
      {
        name: "description",
        content:
          "Track business expenses, overheads, operational costs by category and view spending summaries.",
      },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [isAddOpen, setIsAddOpen] = useState(false);

  // Server functions
  const listExpensesFn = useServerFn(listExpenses);
  const createExpenseFn = useServerFn(createExpense);
  const deleteExpenseFn = useServerFn(deleteExpense);
  const getSummaryFn = useServerFn(getExpenseSummary);

  // Queries
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", categoryFilter, search, fromDate, toDate],
    queryFn: () =>
      listExpensesFn({
        data: {
          category: categoryFilter,
          search: search || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        },
      }),
  });

  const { data: summary } = useQuery({
    queryKey: ["expenseSummary", fromDate, toDate],
    queryFn: () =>
      getSummaryFn({ data: { fromDate: fromDate || undefined, toDate: toDate || undefined } }),
  });

  // Form State
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().substring(0, 10));
  const [category, setCategory] = useState<string>("Rent");
  const [amount, setAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paidTo, setPaidTo] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const handleOpenAdd = () => {
    setExpenseDate(new Date().toISOString().substring(0, 10));
    setCategory("Rent");
    setAmount(0);
    setPaymentMode("cash");
    setPaidTo("");
    setReferenceNumber("");
    setNotes("");
    setIsAddOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert("Amount must be greater than 0");
      return;
    }

    try {
      await createExpenseFn({
        data: {
          expenseDate,
          category,
          amount,
          paymentMode,
          paidTo: paidTo.trim() || null,
          referenceNumber: referenceNumber.trim() || null,
          notes: notes.trim() || null,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenseSummary"] });
      queryClient.invalidateQueries({ queryKey: ["cashBankBalances"] });
      setIsAddOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to record expense");
    }
  };

  const handleDeleteExpense = async (id: string, no: string) => {
    if (!confirm(`Are you sure you want to delete expense "${no}"?`)) return;
    try {
      await deleteExpenseFn({ data: { id } });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenseSummary"] });
      queryClient.invalidateQueries({ queryKey: ["cashBankBalances"] });
    } catch (err: any) {
      alert(err.message || "Failed to delete expense");
    }
  };

  const handleExportCsv = () => {
    const rows = expenses.map((e) => ({
      "Expense Number": e.expense_number,
      Date: e.expense_date,
      Category: e.category,
      Amount: e.amount,
      "Payment Mode": e.payment_mode,
      "Paid To": e.paid_to || "",
      Notes: e.notes || "",
    }));
    downloadCsv(`expenses-${new Date().toISOString().substring(0, 10)}.csv`, rows);
  };

  const totalExpenseAmount = expenses.reduce((a, b) => a + Number(b.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Tracker"
        description="Track daily business expenses, utility bills, rent and staff salaries categorized for accounting."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={expenses.length === 0}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export CSV
            </Button>
            <Button size="sm" onClick={handleOpenAdd}>
              <Plus className="w-4 h-4 mr-1.5" />
              Record Expense
            </Button>
          </div>
        }
      />

      {/* Category Breakdown & Total Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-card rounded-xl border md:col-span-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase">
            Total Expenses
          </span>
          <p className="text-2xl font-bold font-mono text-rose-600 mt-1">
            {currencyIn(totalExpenseAmount, "INR")}
          </p>
          <span className="text-xs text-muted-foreground">{expenses.length} expense entries</span>
        </div>

        {/* Top 3 categories */}
        {(summary?.breakdown || []).slice(0, 3).map((cat, idx) => (
          <div key={idx} className="p-4 bg-card rounded-xl border">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              {cat.category}
            </span>
            <p className="text-xl font-bold font-mono text-foreground mt-1">
              {currencyIn(cat.amount, "INR")}
            </p>
            <div className="w-full bg-muted h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: `${cat.percentage}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              {cat.percentage}% of spending
            </span>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-card rounded-xl border">
        <div className="flex flex-1 items-center gap-3 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search by expense number, recipient, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 rounded-md border text-sm bg-background"
          >
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                <th className="py-3 px-4">Expense #</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Paid To</th>
                <th className="py-3 px-3">Payment Mode</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <CreditCard className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="font-medium text-base text-foreground">No expenses recorded</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Log your daily business expenses to track accurate net profit in reports.
                    </p>
                    <Button size="sm" className="mt-4" onClick={handleOpenAdd}>
                      <Plus className="w-4 h-4 mr-1.5" />
                      Record First Expense
                    </Button>
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-foreground">
                      {exp.expense_number}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary text-secondary-foreground">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs text-muted-foreground">
                      {dateShort(exp.expense_date)}
                    </td>
                    <td className="py-3 px-3 text-foreground">{exp.paid_to || "—"}</td>
                    <td className="py-3 px-3 text-xs capitalize text-muted-foreground">
                      {exp.payment_mode}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">
                      {currencyIn(exp.amount, "INR")}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => handleDeleteExpense(exp.id, exp.expense_number)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record New Expense</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveExpense} className="space-y-4">
            <div>
              <label className="text-xs font-semibold">Expense Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold">Amount (Rs.) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="mt-1 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Expense Date</label>
                <Input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
                >
                  <option value="cash">Cash in Hand</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="upi">UPI / QR</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold">Paid To (Person / Vendor)</label>
                <Input
                  placeholder="e.g. Landlord, State Electricity"
                  value={paidTo}
                  onChange={(e) => setPaidTo(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold">Notes / Description</label>
              <Input
                placeholder="e.g. Office rent for October"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Expense</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
