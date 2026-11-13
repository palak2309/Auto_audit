import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Salaries & Wages",
  "Electricity & Utilities",
  "Transportation & Freight",
  "Office Supplies",
  "Marketing & Advertising",
  "Repairs & Maintenance",
  "Taxes & Licenses",
  "Travel",
  "Telephone & Internet",
  "Bank Charges",
  "Miscellaneous",
] as const;

export const listExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: {
    category?: string | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    search?: string | undefined;
    limit?: number | undefined;
  }) => input ?? {})
  .handler(async ({ data, context }): Promise<ExpenseRow[]> => {
    const admin = await getAdmin();
    let query = admin
      .from("expenses")
      .select("*")
      .eq("user_id", context.userId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (data.category && data.category !== "all") {
      query = query.eq("category", data.category);
    }

    if (data.fromDate) {
      query = query.gte("expense_date", data.fromDate);
    }

    if (data.toDate) {
      query = query.lte("expense_date", data.toDate);
    }

    if (data.search?.trim()) {
      const term = `%${data.search.trim()}%`;
      query = query.or(`expense_number.ilike.${term},paid_to.ilike.${term},notes.ilike.${term}`);
    }

    if (data.limit) {
      query = query.limit(data.limit);
    }

    const { data: list, error } = await query;
    if (error) {
      throw new Error(`Failed to list expenses: ${error.message}`);
    }
    return list ?? [];
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: {
    expenseDate?: string;
    category: string;
    amount: number;
    paymentMode?: string;
    paidTo?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
    receiptUrl?: string | null;
  }) => input)
  .handler(async ({ data, context }): Promise<ExpenseRow> => {
    const admin = await getAdmin();
    const amt = Number(data.amount) || 0;
    if (amt <= 0) {
      throw new Error("Expense amount must be greater than 0");
    }

    const timestamp = Date.now().toString().slice(-6);
    const expenseNumber = `EXP-${timestamp}`;

    const insertPayload: ExpenseInsert = {
      user_id: context.userId,
      expense_number: expenseNumber,
      expense_date: data.expenseDate || new Date().toISOString().substring(0, 10),
      category: data.category,
      amount: amt,
      payment_mode: data.paymentMode || "cash",
      paid_to: data.paidTo ?? null,
      reference_number: data.referenceNumber ?? null,
      notes: data.notes ?? null,
      receipt_url: data.receiptUrl ?? null,
    };

    const { data: created, error } = await admin
      .from("expenses")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error || !created) {
      throw new Error(`Failed to record expense: ${error?.message}`);
    }
    return created;
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const { error } = await admin
      .from("expenses")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) {
      throw new Error(`Failed to delete expense: ${error.message}`);
    }
    return { success: true };
  });

export const getExpenseSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: { fromDate?: string | undefined; toDate?: string | undefined }) => input ?? {})
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    let query = admin
      .from("expenses")
      .select("category, amount")
      .eq("user_id", context.userId);

    if (data.fromDate) query = query.gte("expense_date", data.fromDate);
    if (data.toDate) query = query.lte("expense_date", data.toDate);

    const { data: list, error } = await query;
    if (error) throw new Error(error.message);

    const categoriesMap: Record<string, number> = {};
    let total = 0;

    for (const exp of list ?? []) {
      const amt = Number(exp.amount) || 0;
      categoriesMap[exp.category] = (categoriesMap[exp.category] || 0) + amt;
      total += amt;
    }

    const breakdown = Object.entries(categoriesMap).map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);

    return { total, breakdown };
  });
