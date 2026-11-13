export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      erp_connections: {
        Row: {
          account_name: string | null
          created_at: string
          credentials_ciphertext: string | null
          external_account_id: string | null
          id: string
          last_error: string | null
          last_sync_at: string | null
          metadata: Json
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          created_at?: string
          credentials_ciphertext?: string | null
          external_account_id?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json
          provider: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          created_at?: string
          credentials_ciphertext?: string | null
          external_account_id?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      erp_contracts: {
        Row: {
          connection_id: string
          created_at: string
          currency: string | null
          end_date: string | null
          external_id: string
          id: string
          name: string | null
          raw: Json
          start_date: string | null
          status: string | null
          updated_at: string
          user_id: string
          value: number | null
          vendor_name: string | null
        }
        Insert: {
          connection_id: string
          created_at?: string
          currency?: string | null
          end_date?: string | null
          external_id: string
          id?: string
          name?: string | null
          raw?: Json
          start_date?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          value?: number | null
          vendor_name?: string | null
        }
        Update: {
          connection_id?: string
          created_at?: string
          currency?: string | null
          end_date?: string | null
          external_id?: string
          id?: string
          name?: string | null
          raw?: Json
          start_date?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          value?: number | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_contracts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "erp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_invoices: {
        Row: {
          amount: number | null
          amount_paid: number | null
          connection_id: string
          created_at: string
          currency: string | null
          due_date: string | null
          external_id: string
          id: string
          invoice_number: string | null
          issue_date: string | null
          raw: Json
          status: string | null
          tax_amount: number | null
          type: string | null
          updated_at: string
          user_id: string
          vendor_external_id: string | null
          vendor_name: string | null
        }
        Insert: {
          amount?: number | null
          amount_paid?: number | null
          connection_id: string
          created_at?: string
          currency?: string | null
          due_date?: string | null
          external_id: string
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          raw?: Json
          status?: string | null
          tax_amount?: number | null
          type?: string | null
          updated_at?: string
          user_id: string
          vendor_external_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number | null
          amount_paid?: number | null
          connection_id?: string
          created_at?: string
          currency?: string | null
          due_date?: string | null
          external_id?: string
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          raw?: Json
          status?: string | null
          tax_amount?: number | null
          type?: string | null
          updated_at?: string
          user_id?: string
          vendor_external_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_invoices_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "erp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_leak_activity: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          leak_id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          leak_id: string
          metadata?: Json
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          leak_id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_leak_activity_leak_id_fkey"
            columns: ["leak_id"]
            isOneToOne: false
            referencedRelation: "erp_leaks"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_leaks: {
        Row: {
          amount: number
          assigned_to: string | null
          connection_id: string | null
          created_at: string
          currency: string
          detected_at: string
          evidence: Json
          fingerprint: string
          id: string
          resolution_notes: string | null
          resolved_at: string | null
          severity: string
          source: string
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
          vendor_name: string
        }
        Insert: {
          amount?: number
          assigned_to?: string | null
          connection_id?: string | null
          created_at?: string
          currency?: string
          detected_at?: string
          evidence?: Json
          fingerprint: string
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          title: string
          type: string
          updated_at?: string
          user_id: string
          vendor_name: string
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          connection_id?: string | null
          created_at?: string
          currency?: string
          detected_at?: string
          evidence?: Json
          fingerprint?: string
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_leaks_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "erp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_oauth_states: {
        Row: {
          code_verifier: string | null
          created_at: string
          origin: string
          provider: string
          redirect_to: string | null
          state: string
          user_id: string
        }
        Insert: {
          code_verifier?: string | null
          created_at?: string
          origin: string
          provider: string
          redirect_to?: string | null
          state: string
          user_id: string
        }
        Update: {
          code_verifier?: string | null
          created_at?: string
          origin?: string
          provider?: string
          redirect_to?: string | null
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      erp_payments: {
        Row: {
          amount: number | null
          connection_id: string
          created_at: string
          currency: string | null
          external_id: string
          id: string
          invoice_external_id: string | null
          method: string | null
          paid_date: string | null
          raw: Json
          reference: string | null
          status: string | null
          updated_at: string
          user_id: string
          vendor_name: string | null
        }
        Insert: {
          amount?: number | null
          connection_id: string
          created_at?: string
          currency?: string | null
          external_id: string
          id?: string
          invoice_external_id?: string | null
          method?: string | null
          paid_date?: string | null
          raw?: Json
          reference?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number | null
          connection_id?: string
          created_at?: string
          currency?: string | null
          external_id?: string
          id?: string
          invoice_external_id?: string | null
          method?: string | null
          paid_date?: string | null
          raw?: Json
          reference?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_payments_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "erp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_provider_config: {
        Row: {
          client_id: string
          client_secret_ciphertext: string
          configured_by: string | null
          created_at: string
          extra_config: Json
          provider: string
          updated_at: string
        }
        Insert: {
          client_id: string
          client_secret_ciphertext: string
          configured_by?: string | null
          created_at?: string
          extra_config?: Json
          provider: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_secret_ciphertext?: string
          configured_by?: string | null
          created_at?: string
          extra_config?: Json
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      erp_recovery_cases: {
        Row: {
          claim_reference: string | null
          closed_at: string | null
          created_at: string
          currency: string
          id: string
          leak_id: string
          notes: string | null
          opened_at: string
          owner_id: string | null
          recovered_amount: number
          stage: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          claim_reference?: string | null
          closed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          leak_id: string
          notes?: string | null
          opened_at?: string
          owner_id?: string | null
          recovered_amount?: number
          stage?: string
          target_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          claim_reference?: string | null
          closed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          leak_id?: string
          notes?: string | null
          opened_at?: string
          owner_id?: string | null
          recovered_amount?: number
          stage?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_recovery_cases_leak_id_fkey"
            columns: ["leak_id"]
            isOneToOne: false
            referencedRelation: "erp_leaks"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_sync_runs: {
        Row: {
          connection_id: string
          contracts_synced: number
          error: string | null
          finished_at: string | null
          id: string
          invoices_synced: number
          payments_synced: number
          started_at: string
          status: string
          user_id: string
          vendors_synced: number
        }
        Insert: {
          connection_id: string
          contracts_synced?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          invoices_synced?: number
          payments_synced?: number
          started_at?: string
          status?: string
          user_id: string
          vendors_synced?: number
        }
        Update: {
          connection_id?: string
          contracts_synced?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          invoices_synced?: number
          payments_synced?: number
          started_at?: string
          status?: string
          user_id?: string
          vendors_synced?: number
        }
        Relationships: [
          {
            foreignKeyName: "erp_sync_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "erp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_vendors: {
        Row: {
          connection_id: string
          created_at: string
          email: string | null
          external_id: string
          id: string
          name: string
          phone: string | null
          raw: Json
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          email?: string | null
          external_id: string
          id?: string
          name: string
          phone?: string | null
          raw?: Json
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          email?: string | null
          external_id?: string
          id?: string
          name?: string
          phone?: string | null
          raw?: Json
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_vendors_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "erp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          job_title: string | null
          last_seen_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          last_seen_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          last_seen_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      business_profiles: {
        Row: {
          id: string
          user_id: string
          company_name: string
          business_type: string | null
          gstin: string | null
          pan: string | null
          email: string | null
          phone: string | null
          address_line1: string | null
          address_line2: string | null
          city: string | null
          state: string
          pincode: string | null
          country: string | null
          bank_name: string | null
          account_number: string | null
          ifsc_code: string | null
          branch_name: string | null
          upi_id: string | null
          upi_qr_url: string | null
          logo_url: string | null
          signature_url: string | null
          invoice_prefix: string | null
          invoice_template: string | null
          invoice_terms: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_name?: string
          business_type?: string | null
          gstin?: string | null
          pan?: string | null
          email?: string | null
          phone?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string
          pincode?: string | null
          country?: string | null
          bank_name?: string | null
          account_number?: string | null
          ifsc_code?: string | null
          branch_name?: string | null
          upi_id?: string | null
          upi_qr_url?: string | null
          logo_url?: string | null
          signature_url?: string | null
          invoice_prefix?: string | null
          invoice_template?: string | null
          invoice_terms?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_name?: string
          business_type?: string | null
          gstin?: string | null
          pan?: string | null
          email?: string | null
          phone?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string
          pincode?: string | null
          country?: string | null
          bank_name?: string | null
          account_number?: string | null
          ifsc_code?: string | null
          branch_name?: string | null
          upi_id?: string | null
          upi_qr_url?: string | null
          logo_url?: string | null
          signature_url?: string | null
          invoice_prefix?: string | null
          invoice_template?: string | null
          invoice_terms?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          user_id: string
          name: string
          company_name: string | null
          phone: string | null
          email: string | null
          gstin: string | null
          pan: string | null
          billing_address: string | null
          billing_city: string | null
          billing_state: string | null
          billing_pincode: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_state: string | null
          shipping_pincode: string | null
          opening_balance: number
          current_balance: number
          credit_limit: number
          payment_terms_days: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          company_name?: string | null
          phone?: string | null
          email?: string | null
          gstin?: string | null
          pan?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_state?: string | null
          billing_pincode?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_state?: string | null
          shipping_pincode?: string | null
          opening_balance?: number
          current_balance?: number
          credit_limit?: number
          payment_terms_days?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          company_name?: string | null
          phone?: string | null
          email?: string | null
          gstin?: string | null
          pan?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_state?: string | null
          billing_pincode?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_state?: string | null
          shipping_pincode?: string | null
          opening_balance?: number
          current_balance?: number
          credit_limit?: number
          payment_terms_days?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          id: string
          user_id: string
          name: string
          company_name: string | null
          phone: string | null
          email: string | null
          gstin: string | null
          pan: string | null
          address: string | null
          city: string | null
          state: string | null
          pincode: string | null
          opening_balance: number
          current_balance: number
          payment_terms_days: number
          bank_name: string | null
          account_number: string | null
          ifsc_code: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          company_name?: string | null
          phone?: string | null
          email?: string | null
          gstin?: string | null
          pan?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          opening_balance?: number
          current_balance?: number
          payment_terms_days?: number
          bank_name?: string | null
          account_number?: string | null
          ifsc_code?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          company_name?: string | null
          phone?: string | null
          email?: string | null
          gstin?: string | null
          pan?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          opening_balance?: number
          current_balance?: number
          payment_terms_days?: number
          bank_name?: string | null
          account_number?: string | null
          ifsc_code?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
          name: string
          item_code: string | null
          barcode: string | null
          hsn_code: string | null
          description: string | null
          unit: string
          purchase_price: number
          selling_price: number
          mrp: number | null
          min_selling_price: number | null
          tax_rate: number
          tax_inclusive: boolean
          current_stock: number
          low_stock_threshold: number
          opening_stock: number
          opening_stock_date: string | null
          batch_number: string | null
          expiry_date: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id?: string | null
          name: string
          item_code?: string | null
          barcode?: string | null
          hsn_code?: string | null
          description?: string | null
          unit?: string
          purchase_price?: number
          selling_price?: number
          mrp?: number | null
          min_selling_price?: number | null
          tax_rate?: number
          tax_inclusive?: boolean
          current_stock?: number
          low_stock_threshold?: number
          opening_stock?: number
          opening_stock_date?: string | null
          batch_number?: string | null
          expiry_date?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string | null
          name?: string
          item_code?: string | null
          barcode?: string | null
          hsn_code?: string | null
          description?: string | null
          unit?: string
          purchase_price?: number
          selling_price?: number
          mrp?: number | null
          min_selling_price?: number | null
          tax_rate?: number
          tax_inclusive?: boolean
          current_stock?: number
          low_stock_threshold?: number
          opening_stock?: number
          opening_stock_date?: string | null
          batch_number?: string | null
          expiry_date?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_adjustments: {
        Row: {
          id: string
          user_id: string
          product_id: string
          adjustment_type: string
          quantity: number
          previous_stock: number
          new_stock: number
          reason: string | null
          reference_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          adjustment_type: string
          quantity: number
          previous_stock: number
          new_stock: number
          reason?: string | null
          reference_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          adjustment_type?: string
          quantity?: number
          previous_stock?: number
          new_stock?: number
          reason?: string | null
          reference_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      sales_invoices: {
        Row: {
          id: string
          user_id: string
          customer_id: string | null
          document_type: string
          invoice_number: string
          reference_number: string | null
          invoice_date: string
          due_date: string | null
          place_of_supply: string
          status: string
          subtotal: number
          discount_type: string | null
          discount_value: number
          discount_amount: number
          taxable_amount: number
          cgst_amount: number
          sgst_amount: number
          igst_amount: number
          total_tax: number
          round_off: number
          grand_total: number
          amount_paid: number
          balance_due: number
          payment_mode: string | null
          notes: string | null
          terms_and_conditions: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          customer_id?: string | null
          document_type?: string
          invoice_number: string
          reference_number?: string | null
          invoice_date?: string
          due_date?: string | null
          place_of_supply?: string
          status?: string
          subtotal?: number
          discount_type?: string | null
          discount_value?: number
          discount_amount?: number
          taxable_amount?: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          total_tax?: number
          round_off?: number
          grand_total?: number
          amount_paid?: number
          balance_due?: number
          payment_mode?: string | null
          notes?: string | null
          terms_and_conditions?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          customer_id?: string | null
          document_type?: string
          invoice_number?: string
          reference_number?: string | null
          invoice_date?: string
          due_date?: string | null
          place_of_supply?: string
          status?: string
          subtotal?: number
          discount_type?: string | null
          discount_value?: number
          discount_amount?: number
          taxable_amount?: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          total_tax?: number
          round_off?: number
          grand_total?: number
          amount_paid?: number
          balance_due?: number
          payment_mode?: string | null
          notes?: string | null
          terms_and_conditions?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_invoice_items: {
        Row: {
          id: string
          invoice_id: string
          product_id: string | null
          item_name: string
          hsn_code: string | null
          quantity: number
          unit: string
          unit_price: number
          discount_percentage: number
          discount_amount: number
          taxable_value: number
          gst_rate: number
          cgst_amount: number
          sgst_amount: number
          igst_amount: number
          total_tax: number
          total_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          product_id?: string | null
          item_name: string
          hsn_code?: string | null
          quantity?: number
          unit?: string
          unit_price?: number
          discount_percentage?: number
          discount_amount?: number
          taxable_value?: number
          gst_rate?: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          total_tax?: number
          total_amount?: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          product_id?: string | null
          item_name?: string
          hsn_code?: string | null
          quantity?: number
          unit?: string
          unit_price?: number
          discount_percentage?: number
          discount_amount?: number
          taxable_value?: number
          gst_rate?: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          total_tax?: number
          total_amount?: number
          created_at?: string
        }
        Relationships: []
      }
      purchase_bills: {
        Row: {
          id: string
          user_id: string
          supplier_id: string | null
          document_type: string
          bill_number: string
          supplier_invoice_number: string | null
          bill_date: string
          due_date: string | null
          place_of_supply: string
          status: string
          subtotal: number
          discount_amount: number
          taxable_amount: number
          cgst_amount: number
          sgst_amount: number
          igst_amount: number
          total_tax: number
          round_off: number
          grand_total: number
          amount_paid: number
          balance_due: number
          payment_mode: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          supplier_id?: string | null
          document_type?: string
          bill_number: string
          supplier_invoice_number?: string | null
          bill_date?: string
          due_date?: string | null
          place_of_supply?: string
          status?: string
          subtotal?: number
          discount_amount?: number
          taxable_amount?: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          total_tax?: number
          round_off?: number
          grand_total?: number
          amount_paid?: number
          balance_due?: number
          payment_mode?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          supplier_id?: string | null
          document_type?: string
          bill_number?: string
          supplier_invoice_number?: string | null
          bill_date?: string
          due_date?: string | null
          place_of_supply?: string
          status?: string
          subtotal?: number
          discount_amount?: number
          taxable_amount?: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          total_tax?: number
          round_off?: number
          grand_total?: number
          amount_paid?: number
          balance_due?: number
          payment_mode?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_bill_items: {
        Row: {
          id: string
          bill_id: string
          product_id: string | null
          item_name: string
          hsn_code: string | null
          quantity: number
          unit: string
          unit_price: number
          discount_amount: number
          taxable_value: number
          gst_rate: number
          cgst_amount: number
          sgst_amount: number
          igst_amount: number
          total_tax: number
          total_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          bill_id: string
          product_id?: string | null
          item_name: string
          hsn_code?: string | null
          quantity?: number
          unit?: string
          unit_price?: number
          discount_amount?: number
          taxable_value?: number
          gst_rate?: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          total_tax?: number
          total_amount?: number
          created_at?: string
        }
        Update: {
          id?: string
          bill_id?: string
          product_id?: string | null
          item_name?: string
          hsn_code?: string | null
          quantity?: number
          unit?: string
          unit_price?: number
          discount_amount?: number
          taxable_value?: number
          gst_rate?: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          total_tax?: number
          total_amount?: number
          created_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          user_id: string
          payment_type: string
          payment_number: string
          payment_date: string
          party_type: string
          customer_id: string | null
          supplier_id: string | null
          invoice_id: string | null
          bill_id: string | null
          payment_mode: string
          bank_name: string | null
          reference_number: string | null
          amount: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          payment_type: string
          payment_number: string
          payment_date?: string
          party_type: string
          customer_id?: string | null
          supplier_id?: string | null
          invoice_id?: string | null
          bill_id?: string | null
          payment_mode?: string
          bank_name?: string | null
          reference_number?: string | null
          amount?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          payment_type?: string
          payment_number?: string
          payment_date?: string
          party_type?: string
          customer_id?: string | null
          supplier_id?: string | null
          invoice_id?: string | null
          bill_id?: string | null
          payment_mode?: string
          bank_name?: string | null
          reference_number?: string | null
          amount?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          id: string
          user_id: string
          expense_number: string
          expense_date: string
          category: string
          amount: number
          payment_mode: string
          paid_to: string | null
          reference_number: string | null
          notes: string | null
          receipt_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          expense_number: string
          expense_date?: string
          category: string
          amount?: number
          payment_mode?: string
          paid_to?: string | null
          reference_number?: string | null
          notes?: string | null
          receipt_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          expense_number?: string
          expense_date?: string
          category?: string
          amount?: number
          payment_mode?: string
          paid_to?: string | null
          reference_number?: string | null
          notes?: string | null
          receipt_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      workflow_update_leak_status: {
        Args: {
          p_leak_id: string
          p_actor_id: string
          p_next_status: string
          p_expected_status?: string | null
          p_notes?: string | null
        }
        Returns: Json
      }
      workflow_assign_leak: {
        Args: {
          p_leak_id: string
          p_actor_id: string
          p_new_assignee?: string | null
        }
        Returns: Json
      }
      workflow_add_leak_note: {
        Args: {
          p_leak_id: string
          p_actor_id: string
          p_note: string
        }
        Returns: Json
      }
      workflow_open_recovery_case: {
        Args: {
          p_leak_id: string
          p_actor_id: string
          p_target_amount?: number | null
          p_notes?: string | null
          p_claim_reference?: string | null
        }
        Returns: Json
      }
      workflow_update_recovery_case: {
        Args: {
          p_recovery_case_id: string
          p_actor_id: string
          p_next_stage?: string | null
          p_recovered_amount?: number | null
          p_claim_reference?: string | null
          p_notes?: string | null
          p_owner_id?: string | null
        }
        Returns: Json
      }
    }
    Enums: {
      app_permission:
        | "view"
        | "create"
        | "edit"
        | "delete"
        | "approve"
        | "recover"
        | "manage_users"
        | "manage_roles"
        | "export"
        | "configure"
      app_role:
        | "admin"
        | "cfo"
        | "finance_manager"
        | "accountant"
        | "procurement_manager"
        | "auditor"
        | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_permission: [
        "view",
        "create",
        "edit",
        "delete",
        "approve",
        "recover",
        "manage_users",
        "manage_roles",
        "export",
        "configure",
      ],
      app_role: [
        "admin",
        "cfo",
        "finance_manager",
        "accountant",
        "procurement_manager",
        "auditor",
        "viewer",
      ],
    },
  },
} as const
