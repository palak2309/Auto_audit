import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
type CategoryRow = Database["public"]["Tables"]["product_categories"]["Row"];
type StockAdjustmentRow = Database["public"]["Tables"]["stock_adjustments"]["Row"];

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: { search?: string | undefined; categoryId?: string | undefined; lowStockOnly?: boolean | undefined }) => input ?? {})
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    let query = admin
      .from("products")
      .select(`
        *,
        category:product_categories(id, name)
      `)
      .eq("user_id", context.userId)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (data.categoryId) {
      query = query.eq("category_id", data.categoryId);
    }

    if (data.search?.trim()) {
      const term = `%${data.search.trim()}%`;
      query = query.or(`name.ilike.${term},item_code.ilike.${term},barcode.ilike.${term},hsn_code.ilike.${term}`);
    }

    const { data: products, error } = await query;
    if (error) {
      throw new Error(`Failed to list products: ${error.message}`);
    }

    if (data.lowStockOnly) {
      return (products ?? []).filter((p) => Number(p.current_stock) <= Number(p.low_stock_threshold));
    }

    return products ?? [];
  });

export const getProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<ProductRow> => {
    const admin = await getAdmin();
    const { data: product, error } = await admin
      .from("products")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();

    if (error || !product) {
      throw new Error(`Product not found: ${error?.message}`);
    }
    return product;
  });

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: {
    id?: string;
    category_id?: string | null;
    name: string;
    item_code?: string | null;
    barcode?: string | null;
    hsn_code?: string | null;
    description?: string | null;
    unit?: string;
    purchase_price: number;
    selling_price: number;
    mrp?: number | null;
    min_selling_price?: number | null;
    tax_rate?: number;
    tax_inclusive?: boolean;
    opening_stock?: number;
    low_stock_threshold?: number;
    batch_number?: string | null;
    expiry_date?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();

    if (data.id) {
      // Update existing
      const updatePayload: ProductUpdate = {
        name: data.name,
        category_id: data.category_id ?? null,
        item_code: data.item_code ?? null,
        barcode: data.barcode ?? null,
        hsn_code: data.hsn_code ?? null,
        description: data.description ?? null,
        unit: data.unit ?? "PCS",
        purchase_price: Number(data.purchase_price) || 0,
        selling_price: Number(data.selling_price) || 0,
        mrp: data.mrp !== undefined ? Number(data.mrp) : null,
        min_selling_price: data.min_selling_price !== undefined ? Number(data.min_selling_price) : null,
        tax_rate: Number(data.tax_rate) || 0,
        tax_inclusive: Boolean(data.tax_inclusive),
        low_stock_threshold: Number(data.low_stock_threshold) || 5,
        batch_number: data.batch_number ?? null,
        expiry_date: data.expiry_date ?? null,
      };

      const { data: updated, error } = await admin
        .from("products")
        .update(updatePayload)
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select("*")
        .single();

      if (error || !updated) {
        throw new Error(`Failed to update product: ${error?.message}`);
      }
      return updated;
    } else {
      // Create new
      const initialStock = Number(data.opening_stock) || 0;
      const insertPayload: ProductInsert = {
        user_id: context.userId,
        name: data.name,
        category_id: data.category_id ?? null,
        item_code: data.item_code ?? null,
        barcode: data.barcode ?? null,
        hsn_code: data.hsn_code ?? null,
        description: data.description ?? null,
        unit: data.unit ?? "PCS",
        purchase_price: Number(data.purchase_price) || 0,
        selling_price: Number(data.selling_price) || 0,
        mrp: data.mrp !== undefined ? Number(data.mrp) : null,
        min_selling_price: data.min_selling_price !== undefined ? Number(data.min_selling_price) : null,
        tax_rate: Number(data.tax_rate) || 0,
        tax_inclusive: Boolean(data.tax_inclusive),
        opening_stock: initialStock,
        current_stock: initialStock,
        low_stock_threshold: Number(data.low_stock_threshold) || 5,
        batch_number: data.batch_number ?? null,
        expiry_date: data.expiry_date ?? null,
        status: "active",
      };

      const { data: created, error } = await admin
        .from("products")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error || !created) {
        throw new Error(`Failed to create product: ${error?.message}`);
      }

      if (initialStock > 0) {
        // Record initial stock adjustment
        await admin.from("stock_adjustments").insert({
          user_id: context.userId,
          product_id: created.id,
          adjustment_type: "add",
          quantity: initialStock,
          previous_stock: 0,
          new_stock: initialStock,
          reason: "Opening Stock initialization",
        });
      }

      return created;
    }
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const { error } = await admin
      .from("products")
      .update({ status: "inactive" })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) {
      throw new Error(`Failed to delete product: ${error.message}`);
    }
    return { success: true };
  });

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CategoryRow[]> => {
    const admin = await getAdmin();
    const { data, error } = await admin
      .from("product_categories")
      .select("*")
      .eq("user_id", context.userId)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to list categories: ${error.message}`);
    }
    return data ?? [];
  });

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id?: string; name: string; description?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    if (data.id) {
      const { data: updated, error } = await admin
        .from("product_categories")
        .update({ name: data.name.trim(), description: data.description ?? null })
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select("*")
        .single();

      if (error) throw new Error(`Failed to update category: ${error.message}`);
      return updated;
    } else {
      const { data: created, error } = await admin
        .from("product_categories")
        .insert({
          user_id: context.userId,
          name: data.name.trim(),
          description: data.description ?? null,
        })
        .select("*")
        .single();

      if (error) throw new Error(`Failed to create category: ${error.message}`);
      return created;
    }
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const { error } = await admin
      .from("product_categories")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(`Failed to delete category: ${error.message}`);
    return { success: true };
  });

export const recordStockAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: {
    productId: string;
    adjustmentType: "add" | "reduce" | "audit_correction" | "damage" | "loss" | "return";
    quantity: number;
    reason?: string | null;
    referenceId?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const { data: prod, error: prodErr } = await admin
      .from("products")
      .select("id, current_stock")
      .eq("id", data.productId)
      .eq("user_id", context.userId)
      .single();

    if (prodErr || !prod) {
      throw new Error(`Product not found: ${prodErr?.message}`);
    }

    const currentStock = Number(prod.current_stock) || 0;
    const qty = Math.abs(Number(data.quantity) || 0);
    let newStock = currentStock;

    if (data.adjustmentType === "add" || data.adjustmentType === "return") {
      newStock = currentStock + qty;
    } else if (data.adjustmentType === "reduce" || data.adjustmentType === "damage" || data.adjustmentType === "loss") {
      newStock = Math.max(0, currentStock - qty);
    } else if (data.adjustmentType === "audit_correction") {
      newStock = Number(data.quantity) || 0;
    }

    // Update product stock
    const { error: updateErr } = await admin
      .from("products")
      .update({ current_stock: newStock })
      .eq("id", data.productId)
      .eq("user_id", context.userId);

    if (updateErr) {
      throw new Error(`Failed to update product stock: ${updateErr.message}`);
    }

    // Record adjustment audit
    const { data: adj, error: adjErr } = await admin
      .from("stock_adjustments")
      .insert({
        user_id: context.userId,
        product_id: data.productId,
        adjustment_type: data.adjustmentType,
        quantity: qty,
        previous_stock: currentStock,
        new_stock: newStock,
        reason: data.reason ?? null,
        reference_id: data.referenceId ?? null,
      })
      .select("*")
      .single();

    if (adjErr) {
      throw new Error(`Failed to record stock adjustment: ${adjErr.message}`);
    }

    return { product_id: data.productId, previous_stock: currentStock, new_stock: newStock, adjustment: adj };
  });

export const listStockAdjustments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: { productId?: string | undefined; limit?: number | undefined }) => input ?? {})
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    let query = admin
      .from("stock_adjustments")
      .select(`
        *,
        product:products(id, name, unit, item_code)
      `)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);

    if (data.productId) {
      query = query.eq("product_id", data.productId);
    }

    const { data: list, error } = await query;
    if (error) {
      throw new Error(`Failed to list stock adjustments: ${error.message}`);
    }
    return list ?? [];
  });
