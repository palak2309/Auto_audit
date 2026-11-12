import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface RecordPaymentInput {
  paymentType: "payment_in" | "payment_out";
  paymentNumber?: string | undefined;
  paymentDate?: string | undefined;
  partyType: "customer" | "supplier";
  customerId?: string | null | undefined;
  supplierId?: string | null | undefined;
  invoiceId?: string | null | undefined;
  billId?: string | null | undefined;
  paymentMode: "cash" | "bank_transfer" | "upi" | "cheque" | "card";
  bankName?: string | null | undefined;
  referenceNumber?: string | null | undefined;
  amount: number;
  notes?: string | null | undefined;
}

export const listPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: {
    paymentType?: string | undefined;
    partyType?: string | undefined;
    customerId?: string | undefined;
    supplierId?: string | undefined;
    paymentMode?: string | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    limit?: number | undefined;
  }) => input ?? {})
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    let query = admin
      .from("payments")
      .select(`
        *,
        customer:customers(id, name, company_name),
        supplier:suppliers(id, name, company_name),
        invoice:sales_invoices(id, invoice_number, grand_total),
        bill:purchase_bills(id, bill_number, grand_total)
      `)
      .eq("user_id", context.userId)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (data.paymentType && data.paymentType !== "all") {
      query = query.eq("payment_type", data.paymentType);
    }

    if (data.partyType) {
      query = query.eq("party_type", data.partyType);
    }

    if (data.customerId) {
      query = query.eq("customer_id", data.customerId);
    }

    if (data.supplierId) {
      query = query.eq("supplier_id", data.supplierId);
    }

    if (data.paymentMode && data.paymentMode !== "all") {
      query = query.eq("payment_mode", data.paymentMode);
    }

    if (data.fromDate) {
      query = query.gte("payment_date", data.fromDate);
    }

    if (data.toDate) {
      query = query.lte("payment_date", data.toDate);
    }

    if (data.limit) {
      query = query.limit(data.limit);
    }

    const { data: list, error } = await query;
    if (error) {
      throw new Error(`Failed to list payments: ${error.message}`);
    }
    return list ?? [];
  });

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: RecordPaymentInput) => input)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const amt = Number(data.amount) || 0;
    if (amt <= 0) {
      throw new Error("Payment amount must be greater than 0");
    }

    let paymentNumber = data.paymentNumber?.trim();
    if (!paymentNumber) {
      const prefix = data.paymentType === "payment_in" ? "RCV" : "PAY";
      const timestamp = Date.now().toString().slice(-6);
      paymentNumber = `${prefix}-${timestamp}`;
    }

    // 1. Insert Payment
    const { data: payment, error: payErr } = await admin
      .from("payments")
      .insert({
        user_id: context.userId,
        payment_type: data.paymentType,
        payment_number: paymentNumber,
        payment_date: data.paymentDate || new Date().toISOString().substring(0, 10),
        party_type: data.partyType,
        customer_id: data.customerId ?? null,
        supplier_id: data.supplierId ?? null,
        invoice_id: data.invoiceId ?? null,
        bill_id: data.billId ?? null,
        payment_mode: data.paymentMode,
        bank_name: data.bankName ?? null,
        reference_number: data.referenceNumber ?? null,
        amount: amt,
        notes: data.notes ?? null,
      })
      .select("*")
      .single();

    if (payErr || !payment) {
      throw new Error(`Failed to record payment: ${payErr?.message}`);
    }

    // 2. Settle Invoice (if Payment-In linked to invoice)
    if (data.paymentType === "payment_in" && data.invoiceId) {
      const { data: inv } = await admin
        .from("sales_invoices")
        .select("grand_total, amount_paid, balance_due")
        .eq("id", data.invoiceId)
        .eq("user_id", context.userId)
        .single();

      if (inv) {
        const grandTotal = Number(inv.grand_total) || 0;
        const newPaid = (Number(inv.amount_paid) || 0) + amt;
        const newDue = Math.max(0, grandTotal - newPaid);
        const newStatus = newDue <= 0 ? "paid" : "partially_paid";

        await admin
          .from("sales_invoices")
          .update({
            amount_paid: newPaid,
            balance_due: newDue,
            status: newStatus,
          })
          .eq("id", data.invoiceId)
          .eq("user_id", context.userId);
      }
    }

    // 3. Settle Purchase Bill (if Payment-Out linked to bill)
    if (data.paymentType === "payment_out" && data.billId) {
      const { data: bill } = await admin
        .from("purchase_bills")
        .select("grand_total, amount_paid, balance_due")
        .eq("id", data.billId)
        .eq("user_id", context.userId)
        .single();

      if (bill) {
        const grandTotal = Number(bill.grand_total) || 0;
        const newPaid = (Number(bill.amount_paid) || 0) + amt;
        const newDue = Math.max(0, grandTotal - newPaid);
        const newStatus = newDue <= 0 ? "paid" : "partially_paid";

        await admin
          .from("purchase_bills")
          .update({
            amount_paid: newPaid,
            balance_due: newDue,
            status: newStatus,
          })
          .eq("id", data.billId)
          .eq("user_id", context.userId);
      }
    }

    // 4. Update Party Outstanding Balance
    if (data.paymentType === "payment_in" && data.customerId) {
      const { data: cust } = await admin
        .from("customers")
        .select("current_balance")
        .eq("id", data.customerId)
        .eq("user_id", context.userId)
        .single();

      if (cust) {
        // Customer paid us -> their receivable balance decreases
        const newBal = (Number(cust.current_balance) || 0) - amt;
        await admin
          .from("customers")
          .update({ current_balance: newBal })
          .eq("id", data.customerId)
          .eq("user_id", context.userId);
      }
    } else if (data.paymentType === "payment_out" && data.supplierId) {
      const { data: sup } = await admin
        .from("suppliers")
        .select("current_balance")
        .eq("id", data.supplierId)
        .eq("user_id", context.userId)
        .single();

      if (sup) {
        // We paid supplier -> our payable balance decreases
        const newBal = (Number(sup.current_balance) || 0) - amt;
        await admin
          .from("suppliers")
          .update({ current_balance: newBal })
          .eq("id", data.supplierId)
          .eq("user_id", context.userId);
      }
    }

    return payment;
  });

export const getCashBankBalances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();

    // Fetch payments
    const { data: payments } = await admin
      .from("payments")
      .select("payment_type, payment_mode, amount")
      .eq("user_id", context.userId);

    // Fetch expenses
    const { data: expenses } = await admin
      .from("expenses")
      .select("payment_mode, amount")
      .eq("user_id", context.userId);

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

    for (const exp of expenses ?? []) {
      const amt = Number(exp.amount) || 0;
      if (exp.payment_mode === "cash") {
        cashInHand -= amt;
      } else {
        bankBalance -= amt;
      }
    }

    return {
      cashInHand: Math.round((cashInHand + Number.EPSILON) * 100) / 100,
      bankBalance: Math.round((bankBalance + Number.EPSILON) * 100) / 100,
      totalLiquidity: Math.round((cashInHand + bankBalance + Number.EPSILON) * 100) / 100,
    };
  });
