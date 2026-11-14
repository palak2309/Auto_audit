import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { calculateDocumentSummary, type ItemCalculationInput } from "@/lib/gst/calculator";

type SalesInvoiceRow = Database["public"]["Tables"]["sales_invoices"]["Row"];
type SalesInvoiceItemRow = Database["public"]["Tables"]["sales_invoice_items"]["Row"];

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface CreateInvoiceItemInput {
  productId?: string | null | undefined;
  itemName: string;
  hsnCode?: string | null | undefined;
  quantity: number;
  unit?: string | undefined;
  unitPrice: number;
  discountPercentage?: number | undefined;
  discountAmount?: number | undefined;
  gstRate: number;
  taxInclusive?: boolean | undefined;
}

export interface CreateSalesInvoiceInput {
  customerId?: string | null | undefined;
  documentType?:
    | "tax_invoice"
    | "quotation"
    | "proforma"
    | "sales_order"
    | "credit_note"
    | "delivery_challan"
    | undefined;
  invoiceNumber?: string | undefined;
  referenceNumber?: string | null | undefined;
  invoiceDate?: string | undefined;
  dueDate?: string | null | undefined;
  placeOfSupply?: string | undefined;
  discountType?: "percentage" | "amount" | undefined;
  discountValue?: number | undefined;
  paymentMode?: string | undefined;
  amountPaid?: number | undefined;
  notes?: string | null | undefined;
  termsAndConditions?: string | null | undefined;
  items: CreateInvoiceItemInput[];
}

export const listSalesInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input?: {
      documentType?: string | undefined;
      status?: string | undefined;
      customerId?: string | undefined;
      search?: string | undefined;
      fromDate?: string | undefined;
      toDate?: string | undefined;
      limit?: number | undefined;
    }) => input ?? {},
  )
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    let query = admin
      .from("sales_invoices")
      .select(
        `
        *,
        customer:customers(id, name, company_name, phone, gstin)
      `,
      )
      .eq("user_id", context.userId)
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (data.documentType) {
      query = query.eq("document_type", data.documentType);
    } else {
      // By default show tax_invoice
      query = query.eq("document_type", "tax_invoice");
    }

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }

    if (data.customerId) {
      query = query.eq("customer_id", data.customerId);
    }

    if (data.fromDate) {
      query = query.gte("invoice_date", data.fromDate);
    }

    if (data.toDate) {
      query = query.lte("invoice_date", data.toDate);
    }

    if (data.search?.trim()) {
      const term = `%${data.search.trim()}%`;
      query = query.or(`invoice_number.ilike.${term},reference_number.ilike.${term}`);
    }

    if (data.limit) {
      query = query.limit(data.limit);
    }

    const { data: invoices, error } = await query;
    if (error) {
      throw new Error(`Failed to list invoices: ${error.message}`);
    }
    return invoices ?? [];
  });

export const getSalesInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();

    const { data: invoice, error: invErr } = await admin
      .from("sales_invoices")
      .select(
        `
        *,
        customer:customers(*)
      `,
      )
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();

    if (invErr || !invoice) {
      throw new Error(`Invoice not found: ${invErr?.message}`);
    }

    const { data: items, error: itemsErr } = await admin
      .from("sales_invoice_items")
      .select("*")
      .eq("invoice_id", data.id)
      .order("created_at", { ascending: true });

    if (itemsErr) {
      throw new Error(`Failed to load invoice items: ${itemsErr.message}`);
    }

    const { data: profile } = await admin
      .from("business_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      invoice,
      items: items ?? [],
      businessProfile: profile,
    };
  });

export const getNextInvoiceNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: { documentType?: string | undefined }) => input ?? {})
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const docType = data.documentType || "tax_invoice";

    const { data: profile } = await admin
      .from("business_profiles")
      .select("invoice_prefix")
      .eq("user_id", context.userId)
      .maybeSingle();

    let prefix = profile?.invoice_prefix || "INV";
    if (docType === "quotation") prefix = "QTN";
    else if (docType === "proforma") prefix = "PI";
    else if (docType === "sales_order") prefix = "SO";
    else if (docType === "credit_note") prefix = "CN";
    else if (docType === "delivery_challan") prefix = "DC";

    const currentYear = new Date().getFullYear();

    const { count } = await admin
      .from("sales_invoices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("document_type", docType);

    const nextSeq = (count ?? 0) + 1;
    const seqStr = String(nextSeq).padStart(4, "0");
    return `${prefix}-${currentYear}-${seqStr}`;
  });

export const createSalesInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: CreateSalesInvoiceInput) => input)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();

    if (!data.items || data.items.length === 0) {
      throw new Error("Invoice must contain at least one line item");
    }

    // 1. Fetch business profile
    const { data: profile } = await admin
      .from("business_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    const businessState = profile?.state || "Maharashtra";

    // 2. Fetch customer if provided
    let customerState = businessState;
    if (data.customerId) {
      const { data: cust } = await admin
        .from("customers")
        .select("billing_state, current_balance")
        .eq("id", data.customerId)
        .eq("user_id", context.userId)
        .single();

      if (cust?.billing_state) {
        customerState = cust.billing_state;
      }
    }

    const placeOfSupply = data.placeOfSupply || customerState || businessState;

    // 3. Perform GST Calculations
    const calcItems: ItemCalculationInput[] = data.items.map((it) => ({
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
      discountPercentage: it.discountPercentage,
      discountAmount: it.discountAmount,
      gstRate: Number(it.gstRate) || 0,
      taxInclusive: Boolean(it.taxInclusive),
    }));

    const summary = calculateDocumentSummary({
      items: calcItems,
      businessState,
      placeOfSupply,
      documentDiscountType: data.discountType || "percentage",
      documentDiscountValue: Number(data.discountValue) || 0,
    });

    const docType = data.documentType || "tax_invoice";

    // Generate invoice number if not provided
    let invoiceNumber = data.invoiceNumber?.trim();
    if (!invoiceNumber) {
      const currentYear = new Date().getFullYear();
      let prefix = profile?.invoice_prefix || "INV";
      if (docType === "quotation") prefix = "QTN";
      else if (docType === "proforma") prefix = "PI";
      else if (docType === "credit_note") prefix = "CN";

      const { count } = await admin
        .from("sales_invoices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("document_type", docType);

      const seqStr = String((count ?? 0) + 1).padStart(4, "0");
      invoiceNumber = `${prefix}-${currentYear}-${seqStr}`;
    }

    const grandTotal = summary.grandTotal;
    const amountPaid = Math.min(grandTotal, Math.max(0, Number(data.amountPaid) || 0));
    const balanceDue = Math.max(0, grandTotal - amountPaid);

    let status = "unpaid";
    if (amountPaid >= grandTotal && grandTotal > 0) {
      status = "paid";
    } else if (amountPaid > 0) {
      status = "partially_paid";
    }

    // 4. Insert Sales Invoice
    const { data: invoice, error: invErr } = await admin
      .from("sales_invoices")
      .insert({
        user_id: context.userId,
        customer_id: data.customerId ?? null,
        document_type: docType,
        invoice_number: invoiceNumber,
        reference_number: data.referenceNumber ?? null,
        invoice_date: data.invoiceDate || new Date().toISOString().substring(0, 10),
        due_date: data.dueDate ?? null,
        place_of_supply: placeOfSupply,
        status,
        subtotal: summary.subtotal,
        discount_type: data.discountType || "percentage",
        discount_value: Number(data.discountValue) || 0,
        discount_amount: summary.totalDiscount,
        taxable_amount: summary.taxableAmount,
        cgst_amount: summary.cgstAmount,
        sgst_amount: summary.sgstAmount,
        igst_amount: summary.igstAmount,
        total_tax: summary.totalTax,
        round_off: summary.roundOff,
        grand_total: grandTotal,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        payment_mode: data.paymentMode || "cash",
        notes: data.notes ?? null,
        terms_and_conditions: data.termsAndConditions || profile?.invoice_terms || null,
      })
      .select("*")
      .single();

    if (invErr || !invoice) {
      throw new Error(`Failed to create invoice: ${invErr?.message}`);
    }

    // 5. Insert Line Items
    const itemInserts = data.items.map((it, idx) => {
      const calc = summary.items[idx]!;
      return {
        invoice_id: invoice.id,
        product_id: it.productId ?? null,
        item_name: it.itemName,
        hsn_code: it.hsnCode ?? null,
        quantity: Number(it.quantity) || 1,
        unit: it.unit || "PCS",
        unit_price: Number(it.unitPrice) || 0,
        discount_percentage: Number(it.discountPercentage) || 0,
        discount_amount: calc.discountAmount,
        taxable_value: calc.taxableValue,
        gst_rate: calc.gstRate,
        cgst_amount: calc.cgstAmount,
        sgst_amount: calc.sgstAmount,
        igst_amount: calc.igstAmount,
        total_tax: calc.totalTax,
        total_amount: calc.totalAmount,
      };
    });

    const { error: itemsErr } = await admin.from("sales_invoice_items").insert(itemInserts);

    if (itemsErr) {
      console.error("Error inserting invoice items:", itemsErr);
    }

    // 6. Update Product Stock (auto-decrement on tax invoice, or increment on credit note)
    if (docType === "tax_invoice" || docType === "credit_note") {
      for (const it of data.items) {
        if (!it.productId) continue;

        const qty = Number(it.quantity) || 0;
        const { data: prod } = await admin
          .from("products")
          .select("current_stock")
          .eq("id", it.productId)
          .eq("user_id", context.userId)
          .single();

        if (prod) {
          const current = Number(prod.current_stock) || 0;
          const delta = docType === "credit_note" ? qty : -qty;
          const newStock = Math.max(0, current + delta);

          await admin
            .from("products")
            .update({ current_stock: newStock })
            .eq("id", it.productId)
            .eq("user_id", context.userId);

          await admin.from("stock_adjustments").insert({
            user_id: context.userId,
            product_id: it.productId,
            adjustment_type: docType === "credit_note" ? "return" : "reduce",
            quantity: qty,
            previous_stock: current,
            new_stock: newStock,
            reason: `${docType === "credit_note" ? "Credit Note" : "Invoice"} ${invoice.invoice_number}`,
            reference_id: invoice.id,
          });
        }
      }
    }

    // 7. Update Customer Balance
    if (data.customerId && (docType === "tax_invoice" || docType === "credit_note")) {
      const { data: cust } = await admin
        .from("customers")
        .select("current_balance")
        .eq("id", data.customerId)
        .eq("user_id", context.userId)
        .single();

      if (cust) {
        const currentBal = Number(cust.current_balance) || 0;
        // Tax invoice increases receivable by balanceDue (if unpaid)
        // Credit note decreases receivable by grandTotal
        const balanceChange = docType === "credit_note" ? -grandTotal : balanceDue;
        const newBal = currentBal + balanceChange;

        await admin
          .from("customers")
          .update({ current_balance: newBal })
          .eq("id", data.customerId)
          .eq("user_id", context.userId);
      }

      // If initial payment was made with invoice, record payment entry
      if (amountPaid > 0 && docType === "tax_invoice") {
        await admin.from("payments").insert({
          user_id: context.userId,
          payment_type: "payment_in",
          payment_number: `PAY-${invoice.invoice_number}`,
          payment_date: invoice.invoice_date,
          party_type: "customer",
          customer_id: data.customerId,
          invoice_id: invoice.id,
          payment_mode: data.paymentMode || "cash",
          amount: amountPaid,
          notes: `Initial payment for invoice ${invoice.invoice_number}`,
        });
      }
    }

    return invoice;
  });

export const deleteSalesInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();

    const { data: invoice } = await admin
      .from("sales_invoices")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();

    if (!invoice) throw new Error("Invoice not found");

    // Fetch items to revert stock
    const { data: items } = await admin
      .from("sales_invoice_items")
      .select("product_id, quantity")
      .eq("invoice_id", data.id);

    // If was tax_invoice and not cancelled, revert stock
    if (invoice.document_type === "tax_invoice" && invoice.status !== "cancelled") {
      for (const it of items ?? []) {
        if (!it.product_id) continue;
        const qty = Number(it.quantity) || 0;
        const { data: prod } = await admin
          .from("products")
          .select("current_stock")
          .eq("id", it.product_id)
          .eq("user_id", context.userId)
          .single();

        if (prod) {
          const current = Number(prod.current_stock) || 0;
          await admin
            .from("products")
            .update({ current_stock: current + qty })
            .eq("id", it.product_id)
            .eq("user_id", context.userId);
        }
      }

      // Revert customer balance
      if (invoice.customer_id) {
        const { data: cust } = await admin
          .from("customers")
          .select("current_balance")
          .eq("id", invoice.customer_id)
          .eq("user_id", context.userId)
          .single();

        if (cust) {
          const newBal = Number(cust.current_balance) - Number(invoice.balance_due);
          await admin
            .from("customers")
            .update({ current_balance: newBal })
            .eq("id", invoice.customer_id)
            .eq("user_id", context.userId);
        }
      }
    }

    // Mark as cancelled
    const { error } = await admin
      .from("sales_invoices")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(`Failed to cancel invoice: ${error.message}`);
    return { success: true };
  });
