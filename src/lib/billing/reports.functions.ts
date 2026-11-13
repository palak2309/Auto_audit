import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getSalesReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: { fromDate?: string | undefined; toDate?: string | undefined; customerId?: string | undefined }) => input ?? {})
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    let query = admin
      .from("sales_invoices")
      .select(`
        *,
        customer:customers(id, name, gstin)
      `)
      .eq("user_id", context.userId)
      .eq("document_type", "tax_invoice")
      .neq("status", "cancelled")
      .order("invoice_date", { ascending: false });

    if (data.fromDate) query = query.gte("invoice_date", data.fromDate);
    if (data.toDate) query = query.lte("invoice_date", data.toDate);
    if (data.customerId) query = query.eq("customer_id", data.customerId);

    const { data: invoices, error } = await query;
    if (error) throw new Error(error.message);

    let totalSales = 0;
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalPaid = 0;
    let totalDue = 0;

    for (const inv of invoices ?? []) {
      totalSales += Number(inv.grand_total) || 0;
      totalTaxable += Number(inv.taxable_amount) || 0;
      totalCgst += Number(inv.cgst_amount) || 0;
      totalSgst += Number(inv.sgst_amount) || 0;
      totalIgst += Number(inv.igst_amount) || 0;
      totalPaid += Number(inv.amount_paid) || 0;
      totalDue += Number(inv.balance_due) || 0;
    }

    return {
      invoices: invoices ?? [],
      summary: {
        count: invoices?.length ?? 0,
        totalSales: Math.round(totalSales),
        totalTaxable: Math.round(totalTaxable),
        totalTax: Math.round(totalCgst + totalSgst + totalIgst),
        totalCgst: Math.round(totalCgst),
        totalSgst: Math.round(totalSgst),
        totalIgst: Math.round(totalIgst),
        totalPaid: Math.round(totalPaid),
        totalDue: Math.round(totalDue),
      },
    };
  });

export const getPurchaseReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: { fromDate?: string | undefined; toDate?: string | undefined; supplierId?: string | undefined }) => input ?? {})
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    let query = admin
      .from("purchase_bills")
      .select(`
        *,
        supplier:suppliers(id, name, gstin)
      `)
      .eq("user_id", context.userId)
      .eq("document_type", "bill")
      .neq("status", "cancelled")
      .order("bill_date", { ascending: false });

    if (data.fromDate) query = query.gte("bill_date", data.fromDate);
    if (data.toDate) query = query.lte("bill_date", data.toDate);
    if (data.supplierId) query = query.eq("supplier_id", data.supplierId);

    const { data: bills, error } = await query;
    if (error) throw new Error(error.message);

    let totalPurchases = 0;
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalPaid = 0;
    let totalDue = 0;

    for (const b of bills ?? []) {
      totalPurchases += Number(b.grand_total) || 0;
      totalTaxable += Number(b.taxable_amount) || 0;
      totalCgst += Number(b.cgst_amount) || 0;
      totalSgst += Number(b.sgst_amount) || 0;
      totalIgst += Number(b.igst_amount) || 0;
      totalPaid += Number(b.amount_paid) || 0;
      totalDue += Number(b.balance_due) || 0;
    }

    return {
      bills: bills ?? [],
      summary: {
        count: bills?.length ?? 0,
        totalPurchases: Math.round(totalPurchases),
        totalTaxable: Math.round(totalTaxable),
        totalTax: Math.round(totalCgst + totalSgst + totalIgst),
        totalCgst: Math.round(totalCgst),
        totalSgst: Math.round(totalSgst),
        totalIgst: Math.round(totalIgst),
        totalPaid: Math.round(totalPaid),
        totalDue: Math.round(totalDue),
      },
    };
  });

export const getGstr1Report = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: { fromDate?: string | undefined; toDate?: string | undefined }) => input ?? {})
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    let query = admin
      .from("sales_invoices")
      .select(`
        *,
        customer:customers(id, name, gstin, billing_state)
      `)
      .eq("user_id", context.userId)
      .eq("document_type", "tax_invoice")
      .neq("status", "cancelled");

    if (data.fromDate) query = query.gte("invoice_date", data.fromDate);
    if (data.toDate) query = query.lte("invoice_date", data.toDate);

    const { data: invoices, error } = await query;
    if (error) throw new Error(error.message);

    const invoiceIds = (invoices ?? []).map((i) => i.id);
    const { data: allItems } = invoiceIds.length > 0
      ? await admin.from("sales_invoice_items").select("*").in("invoice_id", invoiceIds)
      : { data: [] };

    const itemsByInvoiceId: Record<string, any[]> = {};
    for (const it of allItems ?? []) {
      if (!itemsByInvoiceId[it.invoice_id]) itemsByInvoiceId[it.invoice_id] = [];
      itemsByInvoiceId[it.invoice_id]!.push(it);
    }

    const b2bInvoices: any[] = [];
    const b2cInvoices: any[] = [];
    const hsnMap: Record<string, { hsn: string; description: string; qty: number; taxable: number; tax: number; cgst: number; sgst: number; igst: number }> = {};
    const rateMap: Record<number, { rate: number; taxable: number; cgst: number; sgst: number; igst: number; totalTax: number }> = {};

    for (const inv of invoices ?? []) {
      const gstin = (inv.customer as any)?.gstin?.trim();
      const invoiceItems = itemsByInvoiceId[inv.id] ?? [];
      const enrichedInv = { ...inv, items: invoiceItems };

      if (gstin && gstin.length >= 10) {
        b2bInvoices.push(enrichedInv);
      } else {
        b2cInvoices.push(enrichedInv);
      }

      for (const it of invoiceItems) {
        const hsn = it.hsn_code || "N/A";
        if (!hsnMap[hsn]) {
          hsnMap[hsn] = {
            hsn,
            description: it.item_name,
            qty: 0,
            taxable: 0,
            tax: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
          };
        }
        hsnMap[hsn].qty += Number(it.quantity) || 0;
        hsnMap[hsn].taxable += Number(it.taxable_value) || 0;
        hsnMap[hsn].tax += Number(it.total_tax) || 0;
        hsnMap[hsn].cgst += Number(it.cgst_amount) || 0;
        hsnMap[hsn].sgst += Number(it.sgst_amount) || 0;
        hsnMap[hsn].igst += Number(it.igst_amount) || 0;

        const rate = Number(it.gst_rate) || 0;
        if (!rateMap[rate]) {
          rateMap[rate] = { rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
        }
        rateMap[rate].taxable += Number(it.taxable_value) || 0;
        rateMap[rate].cgst += Number(it.cgst_amount) || 0;
        rateMap[rate].sgst += Number(it.sgst_amount) || 0;
        rateMap[rate].igst += Number(it.igst_amount) || 0;
        rateMap[rate].totalTax += Number(it.total_tax) || 0;
      }
    }

    return {
      b2bCount: b2bInvoices.length,
      b2bTotal: b2bInvoices.reduce((a, b) => a + Number(b.grand_total), 0),
      b2bInvoices,
      b2cCount: b2cInvoices.length,
      b2cTotal: b2cInvoices.reduce((a, b) => a + Number(b.grand_total), 0),
      b2cInvoices,
      hsnSummary: Object.values(hsnMap),
      rateBreakdown: Object.values(rateMap).sort((a, b) => a.rate - b.rate),
    };
  });

export const getGstr3bSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: { fromDate?: string | undefined; toDate?: string | undefined }) => input ?? {})
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();

    // Outward Supplies (Sales)
    let salesQuery = admin
      .from("sales_invoices")
      .select("taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax, grand_total")
      .eq("user_id", context.userId)
      .eq("document_type", "tax_invoice")
      .neq("status", "cancelled");

    if (data.fromDate) salesQuery = salesQuery.gte("invoice_date", data.fromDate);
    if (data.toDate) salesQuery = salesQuery.lte("invoice_date", data.toDate);

    const { data: sales } = await salesQuery;

    let outwardTaxable = 0;
    let outwardCgst = 0;
    let outwardSgst = 0;
    let outwardIgst = 0;

    for (const s of sales ?? []) {
      outwardTaxable += Number(s.taxable_amount) || 0;
      outwardCgst += Number(s.cgst_amount) || 0;
      outwardSgst += Number(s.sgst_amount) || 0;
      outwardIgst += Number(s.igst_amount) || 0;
    }

    // Inward Supplies / ITC (Purchases)
    let purchaseQuery = admin
      .from("purchase_bills")
      .select("taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax, grand_total")
      .eq("user_id", context.userId)
      .eq("document_type", "bill")
      .neq("status", "cancelled");

    if (data.fromDate) purchaseQuery = purchaseQuery.gte("bill_date", data.fromDate);
    if (data.toDate) purchaseQuery = purchaseQuery.lte("bill_date", data.toDate);

    const { data: purchases } = await purchaseQuery;

    let itcTaxable = 0;
    let itcCgst = 0;
    let itcSgst = 0;
    let itcIgst = 0;

    for (const p of purchases ?? []) {
      itcTaxable += Number(p.taxable_amount) || 0;
      itcCgst += Number(p.cgst_amount) || 0;
      itcSgst += Number(p.sgst_amount) || 0;
      itcIgst += Number(p.igst_amount) || 0;
    }

    const netCgst = Math.max(0, outwardCgst - itcCgst);
    const netSgst = Math.max(0, outwardSgst - itcSgst);
    const netIgst = Math.max(0, outwardIgst - itcIgst);

    return {
      outwardSupplies: {
        taxable: Math.round(outwardTaxable),
        cgst: Math.round(outwardCgst),
        sgst: Math.round(outwardSgst),
        igst: Math.round(outwardIgst),
        totalTax: Math.round(outwardCgst + outwardSgst + outwardIgst),
      },
      eligibleItc: {
        taxable: Math.round(itcTaxable),
        cgst: Math.round(itcCgst),
        sgst: Math.round(itcSgst),
        igst: Math.round(itcIgst),
        totalTax: Math.round(itcCgst + itcSgst + itcIgst),
      },
      netTaxPayable: {
        cgst: Math.round(netCgst),
        sgst: Math.round(netSgst),
        igst: Math.round(netIgst),
        total: Math.round(netCgst + netSgst + netIgst),
      },
    };
  });

export const getStockValuationReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    const { data: products, error } = await admin
      .from("products")
      .select(`
        *,
        category:product_categories(name)
      `)
      .eq("user_id", context.userId)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);

    let totalPurchaseValuation = 0;
    let totalSalesValuation = 0;
    let lowStockCount = 0;

    const list = (products ?? []).map((p) => {
      const stock = Number(p.current_stock) || 0;
      const buyPrice = Number(p.purchase_price) || 0;
      const sellPrice = Number(p.selling_price) || 0;
      const threshold = Number(p.low_stock_threshold) || 5;

      const pVal = stock * buyPrice;
      const sVal = stock * sellPrice;

      totalPurchaseValuation += pVal;
      totalSalesValuation += sVal;

      if (stock <= threshold) lowStockCount++;

      return {
        ...p,
        purchaseValuation: Math.round(pVal),
        salesValuation: Math.round(sVal),
        isLowStock: stock <= threshold,
      };
    });

    return {
      products: list,
      totalItems: list.length,
      lowStockCount,
      totalPurchaseValuation: Math.round(totalPurchaseValuation),
      totalSalesValuation: Math.round(totalSalesValuation),
      potentialProfit: Math.round(totalSalesValuation - totalPurchaseValuation),
    };
  });

export const getProfitAndLossReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: { fromDate?: string | undefined; toDate?: string | undefined }) => input ?? {})
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();

    // 1. Sales
    let salesQuery = admin
      .from("sales_invoices")
      .select("taxable_amount, grand_total")
      .eq("user_id", context.userId)
      .eq("document_type", "tax_invoice")
      .neq("status", "cancelled");

    if (data.fromDate) salesQuery = salesQuery.gte("invoice_date", data.fromDate);
    if (data.toDate) salesQuery = salesQuery.lte("invoice_date", data.toDate);

    const { data: sales } = await salesQuery;
    const totalRevenue = (sales ?? []).reduce((a, b) => a + (Number(b.taxable_amount) || 0), 0);

    // 2. Purchases (COGS)
    let purchaseQuery = admin
      .from("purchase_bills")
      .select("taxable_amount, grand_total")
      .eq("user_id", context.userId)
      .eq("document_type", "bill")
      .neq("status", "cancelled");

    if (data.fromDate) purchaseQuery = purchaseQuery.gte("bill_date", data.fromDate);
    if (data.toDate) purchaseQuery = purchaseQuery.lte("bill_date", data.toDate);

    const { data: purchases } = await purchaseQuery;
    const totalCostOfGoods = (purchases ?? []).reduce((a, b) => a + (Number(b.taxable_amount) || 0), 0);

    // Gross Profit
    const grossProfit = totalRevenue - totalCostOfGoods;

    // 3. Operating Expenses
    let expQuery = admin
      .from("expenses")
      .select("category, amount")
      .eq("user_id", context.userId);

    if (data.fromDate) expQuery = expQuery.gte("expense_date", data.fromDate);
    if (data.toDate) expQuery = expQuery.lte("expense_date", data.toDate);

    const { data: expenses } = await expQuery;

    const expenseCategoryMap: Record<string, number> = {};
    let totalExpenses = 0;

    for (const e of expenses ?? []) {
      const amt = Number(e.amount) || 0;
      expenseCategoryMap[e.category] = (expenseCategoryMap[e.category] || 0) + amt;
      totalExpenses += amt;
    }

    const netProfit = grossProfit - totalExpenses;

    return {
      revenue: Math.round(totalRevenue),
      costOfGoodsSold: Math.round(totalCostOfGoods),
      grossProfit: Math.round(grossProfit),
      grossMarginPct: totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0,
      totalExpenses: Math.round(totalExpenses),
      expenseBreakdown: Object.entries(expenseCategoryMap).map(([category, amount]) => ({
        category,
        amount: Math.round(amount),
      })),
      netProfit: Math.round(netProfit),
      netMarginPct: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0,
    };
  });
