import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type BusinessProfileRow = Database["public"]["Tables"]["business_profiles"]["Row"];
type BusinessProfileInsert = Database["public"]["Tables"]["business_profiles"]["Insert"];
type BusinessProfileUpdate = Database["public"]["Tables"]["business_profiles"]["Update"];

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getBusinessProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BusinessProfileRow> => {
    const admin = await getAdmin();
    const { data, error } = await admin
      .from("business_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching business profile:", error);
    }

    if (data) return data;

    // Create default profile for the user if none exists
    const defaultProfile: BusinessProfileInsert = {
      user_id: context.userId,
      company_name: "My Business",
      business_type: "Retail",
      state: "Maharashtra",
      invoice_prefix: "INV",
      invoice_template: "classic",
      invoice_terms:
        "1. Goods once sold will not be taken back or exchanged.\n2. All disputes subject to local jurisdiction.",
    };

    const { data: created, error: createError } = await admin
      .from("business_profiles")
      .insert(defaultProfile)
      .select("*")
      .single();

    if (createError || !created) {
      throw new Error(`Failed to initialize business profile: ${createError?.message}`);
    }

    return created;
  });

export const updateBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: BusinessProfileUpdate) => input)
  .handler(async ({ data, context }): Promise<BusinessProfileRow> => {
    const admin = await getAdmin();
    const { user_id, id, created_at, ...updateData } = data;

    // Check if profile exists
    const { data: existing } = await admin
      .from("business_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await admin
        .from("business_profiles")
        .update(updateData)
        .eq("user_id", context.userId)
        .select("*")
        .single();

      if (error || !updated) {
        throw new Error(`Failed to update business profile: ${error?.message}`);
      }
      return updated;
    } else {
      const insertData: BusinessProfileInsert = {
        ...updateData,
        user_id: context.userId,
      };
      const { data: created, error } = await admin
        .from("business_profiles")
        .insert(insertData)
        .select("*")
        .single();

      if (error || !created) {
        throw new Error(`Failed to create business profile: ${error?.message}`);
      }
      return created;
    }
  });
