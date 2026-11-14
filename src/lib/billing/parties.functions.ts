import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
type CustomerUpdate = Database["public"]["Tables"]["customers"]["Update"];
type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];
type SupplierInsert = Database["public"]["Tables"]["suppliers"]["Insert"];
type SupplierUpdate = Database["public"]["Tables"]["suppliers"]["Update"];

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ============================================================================
// CUSTOMERS
// ============================================================================

export const listCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input?: { search?: string | undefined; hasBalanceOnly?: boolean | undefined }) => input ?? {},
  )
  .handler(async ({ data, context }): Promise<CustomerRow[]> => {
    const admin = await getAdmin();
    let query = admin
      .from("customers")
      .select("*")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (data.search?.trim()) {
      const term = `%${data.search.trim()}%`;
      query = query.or(
        `name.ilike.${term},company_name.ilike.${term},phone.ilike.${term},email.ilike.${term},gstin.ilike.${term}`,
      );
    }

    const { data: list, error } = await query;
    if (error) {
      throw new Error(`Failed to list customers: ${error.message}`);
    }

    if (data.hasBalanceOnly) {
      return (list ?? []).filter((c) => Number(c.current_balance) !== 0);
    }

    return list ?? [];
  });

export const getCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<CustomerRow> => {
    const admin = await getAdmin();
    const { data: customer, error } = await admin
      .from("customers")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();

    if (error || !customer) {
      throw new Error(`Customer not found: ${error?.message}`);
    }
    return customer;
  });

export const saveCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      id?: string;
      name: string;
      company_name?: string | null;
      phone?: string | null;
      email?: string | null;
      gstin?: string | null;
      pan?: string | null;
      billing_address?: string | null;
      billing_city?: string | null;
      billing_state?: string | null;
      billing_pincode?: string | null;
      shipping_address?: string | null;
      shipping_city?: string | null;
      shipping_state?: string | null;
      shipping_pincode?: string | null;
      opening_balance?: number;
      credit_limit?: number;
      payment_terms_days?: number;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<CustomerRow> => {
    const admin = await getAdmin();
    const openingBal = Number(data.opening_balance) || 0;

    if (data.id) {
      const updatePayload: CustomerUpdate = {
        name: data.name,
        company_name: data.company_name ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        gstin: data.gstin ? data.gstin.trim().toUpperCase() : null,
        pan: data.pan ? data.pan.trim().toUpperCase() : null,
        billing_address: data.billing_address ?? null,
        billing_city: data.billing_city ?? null,
        billing_state: data.billing_state ?? "Maharashtra",
        billing_pincode: data.billing_pincode ?? null,
        shipping_address: data.shipping_address ?? null,
        shipping_city: data.shipping_city ?? null,
        shipping_state: data.shipping_state ?? "Maharashtra",
        shipping_pincode: data.shipping_pincode ?? null,
        credit_limit: Number(data.credit_limit) || 0,
        payment_terms_days: Number(data.payment_terms_days) || 30,
      };

      const { data: updated, error } = await admin
        .from("customers")
        .update(updatePayload)
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select("*")
        .single();

      if (error || !updated) {
        throw new Error(`Failed to update customer: ${error?.message}`);
      }
      return updated;
    } else {
      const insertPayload: CustomerInsert = {
        user_id: context.userId,
        name: data.name,
        company_name: data.company_name ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        gstin: data.gstin ? data.gstin.trim().toUpperCase() : null,
        pan: data.pan ? data.pan.trim().toUpperCase() : null,
        billing_address: data.billing_address ?? null,
        billing_city: data.billing_city ?? null,
        billing_state: data.billing_state ?? "Maharashtra",
        billing_pincode: data.billing_pincode ?? null,
        shipping_address: data.shipping_address ?? null,
        shipping_city: data.shipping_city ?? null,
        shipping_state: data.shipping_state ?? "Maharashtra",
        shipping_pincode: data.shipping_pincode ?? null,
        opening_balance: openingBal,
        current_balance: openingBal,
        credit_limit: Number(data.credit_limit) || 0,
        payment_terms_days: Number(data.payment_terms_days) || 30,
        status: "active",
      };

      const { data: created, error } = await admin
        .from("customers")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error || !created) {
        throw new Error(`Failed to create customer: ${error?.message}`);
      }
      return created;
    }
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const { error } = await admin
      .from("customers")
      .update({ status: "inactive" })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) {
      throw new Error(`Failed to delete customer: ${error.message}`);
    }
    return { success: true };
  });

export interface LedgerEntry {
  id: string;
  date: string;
  type: string;
  referenceNumber: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export const getCustomerLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { customerId: string; fromDate?: string | undefined; toDate?: string | undefined }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();

    const { data: cust, error: custErr } = await admin
      .from("customers")
      .select("*")
      .eq("id", data.customerId)
      .eq("user_id", context.userId)
      .single();

    if (custErr || !cust) throw new Error("Customer not found");

    // Fetch invoices for customer
    const { data: invoices } = await admin
      .from("sales_invoices")
      .select("id, invoice_number, invoice_date, document_type, grand_total, status")
      .eq("user_id", context.userId)
      .eq("customer_id", data.customerId)
      .neq("status", "cancelled");

    // Fetch payments in for customer
    const { data: payments } = await admin
      .from("payments")
      .select("id, payment_number, payment_date, payment_type, payment_mode, amount, notes")
      .eq("user_id", context.userId)
      .eq("customer_id", data.customerId);

    const entries: Array<{
      id: string;
      date: string;
      type: string;
      referenceNumber: string;
      description: string;
      debit: number;
      credit: number;
      timestamp: number;
    }> = [];

    // Opening balance entry
    if (Number(cust.opening_balance) !== 0) {
      const op = Number(cust.opening_balance);
      entries.push({
        id: "opening",
        date: cust.created_at.substring(0, 10),
        type: "Opening Balance",
        referenceNumber: "-",
        description: "Initial balance brought forward",
        debit: op > 0 ? op : 0,
        credit: op < 0 ? Math.abs(op) : 0,
        timestamp: new Date(cust.created_at).getTime(),
      });
    }

    // Invoices are DEBITS to customer (they owe us money)
    for (const inv of invoices ?? []) {
      const isCreditNote = inv.document_type === "credit_note";
      const amt = Number(inv.grand_total) || 0;
      entries.push({
        id: inv.id,
        date: inv.invoice_date,
        type: inv.document_type === "tax_invoice" ? "Tax Invoice" : inv.document_type,
        referenceNumber: inv.invoice_number,
        description: `Sales invoice ${inv.invoice_number}`,
        debit: isCreditNote ? 0 : amt,
        credit: isCreditNote ? amt : 0,
        timestamp: new Date(inv.invoice_date).getTime(),
      });
    }

    // Payments in are CREDITS from customer (they reduce what they owe)
    for (const p of payments ?? []) {
      const amt = Number(p.amount) || 0;
      const isPaymentIn = p.payment_type === "payment_in";
      entries.push({
        id: p.id,
        date: p.payment_date,
        type: isPaymentIn ? "Payment Received" : "Refund / Payment Out",
        referenceNumber: p.payment_number,
        description: `${p.payment_mode.toUpperCase()} ${p.notes ? `(${p.notes})` : ""}`,
        debit: isPaymentIn ? 0 : amt,
        credit: isPaymentIn ? amt : 0,
        timestamp: new Date(p.payment_date).getTime(),
      });
    }

    // Sort by date/timestamp
    entries.sort((a, b) => a.timestamp - b.timestamp);

    let running = 0;
    const ledger: LedgerEntry[] = entries.map((e) => {
      running += e.debit - e.credit;
      return {
        id: e.id,
        date: e.date,
        type: e.type,
        referenceNumber: e.referenceNumber,
        description: e.description,
        debit: e.debit,
        credit: e.credit,
        runningBalance: Math.round((running + Number.EPSILON) * 100) / 100,
      };
    });

    return {
      customer: cust,
      totalDebits: ledger.reduce((acc, i) => acc + i.debit, 0),
      totalCredits: ledger.reduce((acc, i) => acc + i.credit, 0),
      closingBalance: running,
      entries: ledger,
    };
  });

// ============================================================================
// SUPPLIERS
// ============================================================================

export const listSuppliers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input?: { search?: string | undefined; hasBalanceOnly?: boolean | undefined }) => input ?? {},
  )
  .handler(async ({ data, context }): Promise<SupplierRow[]> => {
    const admin = await getAdmin();
    let query = admin
      .from("suppliers")
      .select("*")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (data.search?.trim()) {
      const term = `%${data.search.trim()}%`;
      query = query.or(
        `name.ilike.${term},company_name.ilike.${term},phone.ilike.${term},email.ilike.${term},gstin.ilike.${term}`,
      );
    }

    const { data: list, error } = await query;
    if (error) {
      throw new Error(`Failed to list suppliers: ${error.message}`);
    }

    if (data.hasBalanceOnly) {
      return (list ?? []).filter((s) => Number(s.current_balance) !== 0);
    }

    return list ?? [];
  });

export const getSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<SupplierRow> => {
    const admin = await getAdmin();
    const { data: supplier, error } = await admin
      .from("suppliers")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();

    if (error || !supplier) {
      throw new Error(`Supplier not found: ${error?.message}`);
    }
    return supplier;
  });

export const saveSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      id?: string;
      name: string;
      company_name?: string | null;
      phone?: string | null;
      email?: string | null;
      gstin?: string | null;
      pan?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      pincode?: string | null;
      opening_balance?: number;
      payment_terms_days?: number;
      bank_name?: string | null;
      account_number?: string | null;
      ifsc_code?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<SupplierRow> => {
    const admin = await getAdmin();
    const openingBal = Number(data.opening_balance) || 0;

    if (data.id) {
      const updatePayload: SupplierUpdate = {
        name: data.name,
        company_name: data.company_name ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        gstin: data.gstin ? data.gstin.trim().toUpperCase() : null,
        pan: data.pan ? data.pan.trim().toUpperCase() : null,
        address: data.address ?? null,
        city: data.city ?? null,
        state: data.state ?? "Maharashtra",
        pincode: data.pincode ?? null,
        payment_terms_days: Number(data.payment_terms_days) || 30,
        bank_name: data.bank_name ?? null,
        account_number: data.account_number ?? null,
        ifsc_code: data.ifsc_code ? data.ifsc_code.trim().toUpperCase() : null,
      };

      const { data: updated, error } = await admin
        .from("suppliers")
        .update(updatePayload)
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select("*")
        .single();

      if (error || !updated) {
        throw new Error(`Failed to update supplier: ${error?.message}`);
      }
      return updated;
    } else {
      const insertPayload: SupplierInsert = {
        user_id: context.userId,
        name: data.name,
        company_name: data.company_name ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        gstin: data.gstin ? data.gstin.trim().toUpperCase() : null,
        pan: data.pan ? data.pan.trim().toUpperCase() : null,
        address: data.address ?? null,
        city: data.city ?? null,
        state: data.state ?? "Maharashtra",
        pincode: data.pincode ?? null,
        opening_balance: openingBal,
        current_balance: openingBal,
        payment_terms_days: Number(data.payment_terms_days) || 30,
        bank_name: data.bank_name ?? null,
        account_number: data.account_number ?? null,
        ifsc_code: data.ifsc_code ? data.ifsc_code.trim().toUpperCase() : null,
        status: "active",
      };

      const { data: created, error } = await admin
        .from("suppliers")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error || !created) {
        throw new Error(`Failed to create supplier: ${error?.message}`);
      }
      return created;
    }
  });

export const deleteSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const { error } = await admin
      .from("suppliers")
      .update({ status: "inactive" })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) {
      throw new Error(`Failed to delete supplier: ${error.message}`);
    }
    return { success: true };
  });

export const getSupplierLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { supplierId: string; fromDate?: string | undefined; toDate?: string | undefined }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();

    const { data: sup, error: supErr } = await admin
      .from("suppliers")
      .select("*")
      .eq("id", data.supplierId)
      .eq("user_id", context.userId)
      .single();

    if (supErr || !sup) throw new Error("Supplier not found");

    // Fetch purchase bills
    const { data: bills } = await admin
      .from("purchase_bills")
      .select("id, bill_number, bill_date, document_type, grand_total, status")
      .eq("user_id", context.userId)
      .eq("supplier_id", data.supplierId)
      .neq("status", "cancelled");

    // Fetch payments out
    const { data: payments } = await admin
      .from("payments")
      .select("id, payment_number, payment_date, payment_type, payment_mode, amount, notes")
      .eq("user_id", context.userId)
      .eq("supplier_id", data.supplierId);

    const entries: Array<{
      id: string;
      date: string;
      type: string;
      referenceNumber: string;
      description: string;
      debit: number;
      credit: number;
      timestamp: number;
    }> = [];

    // Opening balance (credit to supplier = we owe them)
    if (Number(sup.opening_balance) !== 0) {
      const op = Number(sup.opening_balance);
      entries.push({
        id: "opening",
        date: sup.created_at.substring(0, 10),
        type: "Opening Balance",
        referenceNumber: "-",
        description: "Initial balance brought forward",
        debit: op < 0 ? Math.abs(op) : 0,
        credit: op > 0 ? op : 0,
        timestamp: new Date(sup.created_at).getTime(),
      });
    }

    // Purchase bills are CREDITS (increases payable to supplier)
    for (const b of bills ?? []) {
      const isDebitNote = b.document_type === "debit_note";
      const amt = Number(b.grand_total) || 0;
      entries.push({
        id: b.id,
        date: b.bill_date,
        type: isDebitNote ? "Debit Note" : "Purchase Bill",
        referenceNumber: b.bill_number,
        description: `Bill ${b.bill_number}`,
        debit: isDebitNote ? amt : 0,
        credit: isDebitNote ? 0 : amt,
        timestamp: new Date(b.bill_date).getTime(),
      });
    }

    // Payments out are DEBITS (reduces payable to supplier)
    for (const p of payments ?? []) {
      const amt = Number(p.amount) || 0;
      const isPaymentOut = p.payment_type === "payment_out";
      entries.push({
        id: p.id,
        date: p.payment_date,
        type: isPaymentOut ? "Payment Made" : "Refund Received",
        referenceNumber: p.payment_number,
        description: `${p.payment_mode.toUpperCase()} ${p.notes ? `(${p.notes})` : ""}`,
        debit: isPaymentOut ? amt : 0,
        credit: isPaymentOut ? 0 : amt,
        timestamp: new Date(p.payment_date).getTime(),
      });
    }

    entries.sort((a, b) => a.timestamp - b.timestamp);

    let running = 0;
    const ledger: LedgerEntry[] = entries.map((e) => {
      // For suppliers: Credit increases payable, Debit decreases payable
      running += e.credit - e.debit;
      return {
        id: e.id,
        date: e.date,
        type: e.type,
        referenceNumber: e.referenceNumber,
        description: e.description,
        debit: e.debit,
        credit: e.credit,
        runningBalance: Math.round((running + Number.EPSILON) * 100) / 100,
      };
    });

    return {
      supplier: sup,
      totalDebits: ledger.reduce((acc, i) => acc + i.debit, 0),
      totalCredits: ledger.reduce((acc, i) => acc + i.credit, 0),
      closingBalance: running,
      entries: ledger,
    };
  });
