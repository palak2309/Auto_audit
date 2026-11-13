import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type DateFilterType = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom" | "all";

function getDateRange(filter: DateFilterType, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  const format = (d: Date) => d.toISOString().substring(0, 10);

  if (filter === "custom" && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }

  if (filter === "today") {
    const todayStr = format(now);
    return { from: todayStr, to: todayStr };
  }

  if (filter === "yesterday") {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestStr = format(yest);
    return { from: yestStr, to: yestStr };
  }

  if (filter === "this_week") {
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
    startOfWeek.setDate(diff);
    return { from: format(startOfWeek), to: format(now) };
  }

  if (filter === "this_month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: format(startOfMonth), to: format(now) };
  }

  if (filter === "last_month") {
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: format(startOfLastMonth), to: format(endOfLastMonth) };
  }

  // default / "all"
  const pastYear = new Date(now);
  pastYear.setFullYear(pastYear.getFullYear() - 1);
  return { from: format(pastYear), to: format(now) };
}

export const getBusinessDashboardMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: { dateFilter?: DateFilterType; customFrom?: string; customTo?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const filter = data.dateFilter || "this_month";
    const { from, to } = getDateRange(filter, data.customFrom, data.customTo);
    const todayStr = new Date().toISOString().substring(0, 10);

    // 1. Sales query
    const { data: allSales } = await admin
      .from("sales_invoices")
      .select("id, invoice_number, invoice_date, grand_total, amount_paid, balance_due, status, customer_id, created_at, customer:customers(name)")
      .eq("user_id", context.userId)
      .eq("document_type", "tax_invoice")
      .neq("status", "cancelled");

    // 2. Purchases query
    const { data: allPurchases } = await admin
      .from("purchase_bills")
      .select("id, bill_number, bill_date, grand_total, amount_paid, balance_due, status, supplier_id, created_at, supplier:suppliers(name)")
      .eq("user_id", context.userId)
      .eq("document_type", "bill")
      .neq("status", "cancelled");

    // 3. Expenses query
    const { data: allExpenses } = await admin
      .from("expenses")
      .select("id, expense_number, expense_date, category, amount, payment_mode, created_at")
      .eq("user_id", context.userId);

    // 4. Products query
    const { data: products } = await admin
      .from("products")
      .select("id, current_stock, low_stock_threshold, purchase_price, selling_price")
      .eq("user_id", context.userId)
      .eq("status", "active");

    // 5. Customers & Suppliers query
    const { data: customers } = await admin
      .from("customers")
      .select("id, current_balance")
      .eq("user_id", context.userId)
      .eq("status", "active");

    const { data: suppliers } = await admin
      .from("suppliers")
      .select("id, current_balance")
      .eq("user_id", context.userId)
      .eq("status", "active");

    // 6. Payments query (for cash/bank calculations)
    const { data: payments } = await admin
      .from("payments")
      .select("payment_type, payment_mode, amount, payment_date")
      .eq("user_id", context.userId);

    // Calculate metrics for selected date range
    let filteredSalesTotal = 0;
    let filteredPurchasesTotal = 0;
    let filteredExpensesTotal = 0;
    let todaySalesTotal = 0;

    for (const inv of allSales ?? []) {
      const amt = Number(inv.grand_total) || 0;
      if (inv.invoice_date === todayStr) {
        todaySalesTotal += amt;
      }
      if (inv.invoice_date >= from && inv.invoice_date <= to) {
        filteredSalesTotal += amt;
      }
    }

    for (const bill of allPurchases ?? []) {
      const amt = Number(bill.grand_total) || 0;
      if (bill.bill_date >= from && bill.bill_date <= to) {
        filteredPurchasesTotal += amt;
      }
    }

    for (const exp of allExpenses ?? []) {
      const amt = Number(exp.amount) || 0;
      if (exp.expense_date >= from && exp.expense_date <= to) {
        filteredExpensesTotal += amt;
      }
    }

    // Profit = Sales - Purchases - Expenses in period
    const grossProfit = filteredSalesTotal - filteredPurchasesTotal;
    const netProfit = grossProfit - filteredExpensesTotal;

    // Receivables = sum of customer positive balances
    let totalReceivables = 0;
    for (const c of customers ?? []) {
      const bal = Number(c.current_balance) || 0;
      if (bal > 0) totalReceivables += bal;
    }

    // Payables = sum of supplier positive balances
    let totalPayables = 0;
    for (const s of suppliers ?? []) {
      const bal = Number(s.current_balance) || 0;
      if (bal > 0) totalPayables += bal;
    }

    // Cash and Bank calculation
    let cashInHand = 0;
    let bankBalance = 0;

    for (const p of payments ?? []) {
      const amt = Number(p.amount) || 0;
      const isCash = p.payment_mode === "cash";
      if (p.payment_type === "payment_in") {
        if (isCash) cashInHand += amt;
        else bankBalance += amt;
      } else {
        if (isCash) cashInHand -= amt;
        else bankBalance -= amt;
      }
    }

    for (const exp of allExpenses ?? []) {
      const amt = Number(exp.amount) || 0;
      if (exp.payment_mode === "cash") cashInHand -= amt;
      else bankBalance -= amt;
    }

    // Stock metrics
    const totalProducts = products?.length ?? 0;
    let lowStockCount = 0;
    let totalStockValuation = 0;

    for (const p of products ?? []) {
      const stock = Number(p.current_stock) || 0;
      const threshold = Number(p.low_stock_threshold) || 0;
      const buyPrice = Number(p.purchase_price) || 0;
      if (stock <= threshold) lowStockCount++;
      totalStockValuation += stock * buyPrice;
    }

    // Monthly Graph data for past 6 months
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const monthlyTrend: Array<{ month: string; sales: number; purchases: number; expenses: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = targetDate.getFullYear();
      const monthIdx = targetDate.getMonth();
      const monthLabel = `${monthNames[monthIdx]} ${String(year).slice(-2)}`;
      const startStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, monthIdx + 1, 0).getDate();
      const endStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      let mSales = 0;
      let mPurchases = 0;
      let mExpenses = 0;

      for (const inv of allSales ?? []) {
        if (inv.invoice_date >= startStr && inv.invoice_date <= endStr) {
          mSales += Number(inv.grand_total) || 0;
        }
      }

      for (const bill of allPurchases ?? []) {
        if (bill.bill_date >= startStr && bill.bill_date <= endStr) {
          mPurchases += Number(bill.grand_total) || 0;
        }
      }

      for (const exp of allExpenses ?? []) {
        if (exp.expense_date >= startStr && exp.expense_date <= endStr) {
          mExpenses += Number(exp.amount) || 0;
        }
      }

      monthlyTrend.push({
        month: monthLabel,
        sales: Math.round(mSales),
        purchases: Math.round(mPurchases),
        expenses: Math.round(mExpenses),
      });
    }

    // Recent invoices (latest 5)
    const recentInvoices = (allSales ?? [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6)
      .map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        customerName: (inv.customer as any)?.name || "Cash Customer",
        date: inv.invoice_date,
        amount: Number(inv.grand_total) || 0,
        status: inv.status,
      }));

    // Recent transactions (merged payments, latest 6)
    const recentTransactions = (payments ?? [])
      .slice(-6)
      .reverse();

    return {
      todaySales: Math.round(todaySalesTotal),
      totalSales: Math.round(filteredSalesTotal),
      totalPurchases: Math.round(filteredPurchasesTotal),
      totalExpenses: Math.round(filteredExpensesTotal),
      grossProfit: Math.round(grossProfit),
      netProfit: Math.round(netProfit),
      totalReceivables: Math.round(totalReceivables),
      totalPayables: Math.round(totalPayables),
      cashInHand: Math.round(cashInHand),
      bankBalance: Math.round(bankBalance),
      totalLiquidity: Math.round(cashInHand + bankBalance),
      totalProducts,
      lowStockProducts: lowStockCount,
      totalStockValuation: Math.round(totalStockValuation),
      dateRange: { from, to, filter },
      monthlyTrend,
      recentInvoices,
    };
  });
