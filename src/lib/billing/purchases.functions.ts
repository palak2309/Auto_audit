import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { calculateDocumentSummary, type ItemCalculationInput } from "@/lib/gst/calculator";

type PurchaseBillRow = Database["public"]["Tables"]["purchase_bills"]["Row"];
type PurchaseBillItemRow = Database["public"]["Tables"]["purchase_bill_items"]["Row"];

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface CreatePurchaseItemInput {
  productId?: string | null | undefined;
  itemName: string;
  hsnCode?: string | null | undefined;
  quantity: number;
  unit?: string | undefined;
  unitPrice: number;
  discountAmount?: number | undefined;
  gstRate: number;
  taxInclusive?: boolean | undefined;
}

export interface CreatePurchaseBillInput {
  supplierId?: string | null | undefined;
  documentType?: "bill" | "debit_note" | "purchase_order" | undefined;
  billNumber?: string | undefined;
  supplierInvoiceNumber?: string | null | undefined;
  billDate?: string | undefined;
  dueDate?: string | null | undefined;
  placeOfSupply?: string | undefined;
  discountAmount?: number | undefined;
  paymentMode?: string | undefined;
  amountPaid?: number | undefined;
  notes?: string | null | undefined;
  items: CreatePurchaseItemInput[];
}

export const listPurchaseBills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: {
    documentType?: string | undefined;
    status?: string | undefined;
    supplierId?: string | undefined;
    search?: string | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    limit?: number | undefined;
  }) => input ?? {})
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    let query = admin
      .from("purchase_bills")
      .select(`
        *,
        supplier:suppliers(id, name, company_name, phone, gstin)
      `)
      .eq("user_id", context.userId)
      .order("bill_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (data.documentType) {
      query = query.eq("document_type", data.documentType);
    } else {
      query = query.eq("document_type", "bill");
    }

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }

    if (data.supplierId) {
      query = query.eq("supplier_id", data.supplierId);
    }

    if (data.fromDate) {
      query = query.gte("bill_date", data.fromDate);
    }

    if (data.toDate) {
      query = query.lte("bill_date", data.toDate);
    }

    if (data.search?.trim()) {
      const term = `%${data.search.trim()}%`;
      query = query.or(`bill_number.ilike.${term},supplier_invoice_number.ilike.${term}`);
    }

    if (data.limit) {
      query = query.limit(data.limit);
    }

    const { data: bills, error } = await query;
    if (error) {
      throw new Error(`Failed to list purchase bills: ${error.message}`);
    }
    return bills ?? [];
  });

export const getPurchaseBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();

    const { data: bill, error: billErr } = await admin
      .from("purchase_bills")
      .select(`
        *,
        supplier:suppliers(*)
      `)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();

    if (billErr || !bill) {
      throw new Error(`Purchase bill not found: ${billErr?.message}`);
    }

    const { data: items, error: itemsErr } = await admin
      .from("purchase_bill_items")
      .select("*")
      .eq("bill_id", data.id)
      .order("created_at", { ascending: true });

    if (itemsErr) {
      throw new Error(`Failed to load bill items: ${itemsErr.message}`);
    }

    const { data: profile } = await admin
      .from("business_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      bill,
      items: items ?? [],
      businessProfile: profile,
    };
  });

export const getNextBillNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: { documentType?: string | undefined }) => input ?? {})
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const docType = data.documentType || "bill";
    let prefix = "BILL";
    if (docType === "debit_note") prefix = "DN";
    else if (docType === "purchase_order") prefix = "PO";

    const currentYear = new Date().getFullYear();

    const { count } = await admin
      .from("purchase_bills")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("document_type", docType);

    const seqStr = String((count ?? 0) + 1).padStart(4, "0");
    return `${prefix}-${currentYear}-${seqStr}`;
  });

export const createPurchaseBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: CreatePurchaseBillInput) => input)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();

    if (!data.items || data.items.length === 0) {
      throw new Error("Bill must contain at least one line item");
    }

    const { data: profile } = await admin
      .from("business_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    const businessState = profile?.state || "Maharashtra";

    let supplierState = businessState;
    if (data.supplierId) {
      const { data: sup } = await admin
        .from("suppliers")
        .select("state, current_balance")
        .eq("id", data.supplierId)
        .eq("user_id", context.userId)
        .single();

      if (sup?.state) {
        supplierState = sup.state;
      }
    }

    const placeOfSupply = data.placeOfSupply || supplierState || businessState;

    const calcItems: ItemCalculationInput[] = data.items.map((it) => ({
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
      discountAmount: Number(it.discountAmount) || 0,
      gstRate: Number(it.gstRate) || 0,
      taxInclusive: Boolean(it.taxInclusive),
    }));

    const summary = calculateDocumentSummary({
      items: calcItems,
      businessState,
      placeOfSupply,
      documentDiscountType: "amount",
      documentDiscountValue: Number(data.discountAmount) || 0,
    });

    const docType = data.documentType || "bill";

    let billNumber = data.billNumber?.trim();
    if (!billNumber) {
      const currentYear = new Date().getFullYear();
      let prefix = docType === "debit_note" ? "DN" : docType === "purchase_order" ? "PO" : "BILL";
      const { count } = await admin
        .from("purchase_bills")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("document_type", docType);

      const seqStr = String((count ?? 0) + 1).padStart(4, "0");
      billNumber = `${prefix}-${currentYear}-${seqStr}`;
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

    // Insert Purchase Bill
    const { data: bill, error: billErr } = await admin
      .from("purchase_bills")
      .insert({
        user_id: context.userId,
        supplier_id: data.supplierId ?? null,
        document_type: docType,
        bill_number: billNumber,
        supplier_invoice_number: data.supplierInvoiceNumber ?? null,
        bill_date: data.billDate || new Date().toISOString().substring(0, 10),
        due_date: data.dueDate ?? null,
        place_of_supply: placeOfSupply,
        status,
        subtotal: summary.subtotal,
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
        payment_mode: data.paymentMode || "bank",
        notes: data.notes ?? null,
      })
      .select("*")
      .single();

    if (billErr || !bill) {
      throw new Error(`Failed to create purchase bill: ${billErr?.message}`);
    }

    // Insert Bill Items
    const itemInserts = data.items.map((it, idx) => {
      const calc = summary.items[idx]!;
      return {
        bill_id: bill.id,
        product_id: it.productId ?? null,
        item_name: it.itemName,
        hsn_code: it.hsnCode ?? null,
        quantity: Number(it.quantity) || 1,
        unit: it.unit || "PCS",
        unit_price: Number(it.unitPrice) || 0,
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

    const { error: itemsErr } = await admin
      .from("purchase_bill_items")
      .insert(itemInserts);

    if (itemsErr) {
      console.error("Error inserting bill items:", itemsErr);
    }

    // Auto-update Product Stock (increment on bill, decrement on debit note)
    if (docType === "bill" || docType === "debit_note") {
      for (const it of data.items) {
        if (!it.productId) continue;
        const qty = Number(it.quantity) || 0;

        const { data: prod } = await admin
          .from("products")
          .select("current_stock, purchase_price")
          .eq("id", it.productId)
          .eq("user_id", context.userId)
          .single();

        if (prod) {
          const current = Number(prod.current_stock) || 0;
          const delta = docType === "debit_note" ? -qty : qty;
          const newStock = Math.max(0, current + delta);

          await admin
            .from("products")
            .update({
              current_stock: newStock,
              purchase_price: Number(it.unitPrice) > 0 ? Number(it.unitPrice) : prod.purchase_price,
            })
            .eq("id", it.productId)
            .eq("user_id", context.userId);

          await admin.from("stock_adjustments").insert({
            user_id: context.userId,
            product_id: it.productId,
            adjustment_type: docType === "debit_note" ? "damage" : "add",
            quantity: qty,
            previous_stock: current,
            new_stock: newStock,
            reason: `${docType === "debit_note" ? "Debit Note" : "Purchase Bill"} ${bill.bill_number}`,
            reference_id: bill.id,
          });
        }
      }
    }

    // Update Supplier Balance
    if (data.supplierId && (docType === "bill" || docType === "debit_note")) {
      const { data: sup } = await admin
        .from("suppliers")
        .select("current_balance")
        .eq("id", data.supplierId)
        .eq("user_id", context.userId)
        .single();

      if (sup) {
        const currentBal = Number(sup.current_balance) || 0;
        // Purchase bill increases payable by balanceDue
        // Debit note decreases payable by grandTotal
        const balanceChange = docType === "debit_note" ? -grandTotal : balanceDue;
        const newBal = currentBal + balanceChange;

        await admin
          .from("suppliers")
          .update({ current_balance: newBal })
          .eq("id", data.supplierId)
          .eq("user_id", context.userId);
      }

      // If initial payment was made with bill, record payment_out
      if (amountPaid > 0 && docType === "bill") {
        await admin.from("payments").insert({
          user_id: context.userId,
          payment_type: "payment_out",
          payment_number: `PAY-${bill.bill_number}`,
          payment_date: bill.bill_date,
          party_type: "supplier",
          supplier_id: data.supplierId,
          bill_id: bill.id,
          payment_mode: data.paymentMode || "bank",
          amount: amountPaid,
          notes: `Payment for purchase bill ${bill.bill_number}`,
        });
      }
    }

    return bill;
  });

export const deletePurchaseBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();

    const { data: bill } = await admin
      .from("purchase_bills")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();

    if (!bill) throw new Error("Purchase bill not found");

    const { data: items } = await admin
      .from("purchase_bill_items")
      .select("product_id, quantity")
      .eq("bill_id", data.id);

    // Revert stock if bill was active
    if (bill.document_type === "bill" && bill.status !== "cancelled") {
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
            .update({ current_stock: Math.max(0, current - qty) })
            .eq("id", it.product_id)
            .eq("user_id", context.userId);
        }
      }

      // Revert supplier balance
      if (bill.supplier_id) {
        const { data: sup } = await admin
          .from("suppliers")
          .select("current_balance")
          .eq("id", bill.supplier_id)
          .eq("user_id", context.userId)
          .single();

        if (sup) {
          const newBal = Number(sup.current_balance) - Number(bill.balance_due);
          await admin
            .from("suppliers")
            .update({ current_balance: newBal })
            .eq("id", bill.supplier_id)
            .eq("user_id", context.userId);
        }
      }
    }

    // Mark as cancelled
    const { error } = await admin
      .from("purchase_bills")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(`Failed to cancel bill: ${error.message}`);
    return { success: true };
  });
