import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Receipt,
  CreditCard,
  Settings as SettingsIcon,
  ShieldCheck,
  CheckCircle2,
  Save,
} from "lucide-react";
import { PermissionGate } from "@/components/common/permission-gate";
import { PageHeader } from "@/components/common/page-header";
import { ToneBadge } from "@/components/common/tone-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/providers/theme-provider";
import { useErpOverview } from "@/hooks/use-erp";
import { useMockAuth } from "@/providers/mock-auth-provider";
import { getBusinessProfile, updateBusinessProfile } from "@/lib/billing/business.functions";
import { INDIAN_STATES } from "@/lib/gst/calculator";

export const Route = createFileRoute("/_shell/settings")({
  head: () => ({
    meta: [
      { title: "Business Settings & Profile — Auto Audit" },
      {
        name: "description",
        content: "Configure business details, GSTIN, bank accounts, UPI ID, invoice templates and workspace preferences.",
      },
      { property: "og:title", content: "Settings — Auto Audit" },
      {
        property: "og:description",
        content: "Configure business details, GSTIN, bank accounts, UPI ID and invoice templates.",
      },
    ],
  }),
  component: () => (
    <PermissionGate permission="configure">
      <SettingsPage />
    </PermissionGate>
  ),
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const { data: erp } = useErpOverview();
  const { workspace } = useMockAuth();

  const getProfileFn = useServerFn(getBusinessProfile);
  const updateProfileFn = useServerFn(updateBusinessProfile);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["businessProfile"],
    queryFn: () => getProfileFn(),
  });

  const [form, setForm] = useState({
    companyName: "",
    businessType: "Retail",
    gstin: "",
    pan: "",
    email: "",
    phone: "",
    addressLine1: "",
    city: "",
    state: "Maharashtra",
    pincode: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    branchName: "",
    upiId: "",
    invoicePrefix: "INV",
    invoiceTemplate: "classic",
    invoiceTerms: "",
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        companyName: profile.company_name || "",
        businessType: profile.business_type || "Retail",
        gstin: profile.gstin || "",
        pan: profile.pan || "",
        email: profile.email || "",
        phone: profile.phone || "",
        addressLine1: profile.address_line1 || "",
        city: profile.city || "",
        state: profile.state || "Maharashtra",
        pincode: profile.pincode || "",
        bankName: profile.bank_name || "",
        accountNumber: profile.account_number || "",
        ifscCode: profile.ifsc_code || "",
        branchName: profile.branch_name || "",
        upiId: profile.upi_id || "",
        invoicePrefix: profile.invoice_prefix || "INV",
        invoiceTemplate: profile.invoice_template || "classic",
        invoiceTerms: profile.invoice_terms || "",
      });
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfileFn({
        data: {
          company_name: form.companyName.trim() || "My Business",
          business_type: form.businessType,
          gstin: form.gstin.trim() || null,
          pan: form.pan.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          address_line1: form.addressLine1.trim() || null,
          city: form.city.trim() || null,
          state: form.state,
          pincode: form.pincode.trim() || null,
          bank_name: form.bankName.trim() || null,
          account_number: form.accountNumber.trim() || null,
          ifsc_code: form.ifscCode.trim() || null,
          branch_name: form.branchName.trim() || null,
          upi_id: form.upiId.trim() || null,
          invoice_prefix: form.invoicePrefix.trim() || "INV",
          invoice_template: form.invoiceTemplate,
          invoice_terms: form.invoiceTerms.trim() || null,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["businessProfile"] });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update profile");
    }
  };

  return (
    <>
      <PageHeader
        title="Business Profile & Settings"
        description="Configure your business registration, GSTIN, bank details, invoice layout, and security policies."
        crumbs={[{ label: "Settings" }]}
        actions={
          savedSuccess ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" /> Changes Saved
            </span>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Business Details Form */}
        <section className="surface-card p-6 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold">Business Profile & GST Registration</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                These details appear on your printed GST invoices, quotes, and payment receipts.
              </p>
            </div>
            <Button size="sm" onClick={handleSaveProfile} className="gap-1.5">
              <Save className="w-4 h-4" /> Save Business Profile
            </Button>
          </div>

          <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="companyName">Business / Company Name *</Label>
              <Input
                id="companyName"
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="businessType">Business Type</Label>
              <select
                id="businessType"
                value={form.businessType}
                onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
              >
                <option value="Retail">Retailer</option>
                <option value="Wholesale">Wholesaler / Distributor</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Services">Services & IT</option>
                <option value="Trader">Trader / Dealer</option>
              </select>
            </div>

            <div>
              <Label htmlFor="gstin">GSTIN</Label>
              <Input
                id="gstin"
                placeholder="27AAAAA0000A1Z5"
                maxLength={15}
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label htmlFor="pan">PAN</Label>
              <Input
                id="pan"
                placeholder="AAAAA0000A"
                maxLength={10}
                value={form.pan}
                onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone / Mobile</Label>
              <Input
                id="phone"
                placeholder="+91 9876543210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="email">Business Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="billing@mybusiness.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="address">Address Line</Label>
              <Input
                id="address"
                placeholder="Shop number, street, complex, locality..."
                value={form.addressLine1}
                onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="state">State (Principal Place of Business) *</Label>
              <select
                id="state"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.name} ({s.tin})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                placeholder="400001"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Bank & UPI Section */}
            <div className="md:col-span-3 border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-foreground mb-1">Bank & UPI Settlement Accounts</h3>
              <p className="text-xs text-muted-foreground">
                Printed on invoices so your customers can transfer money directly to your account.
              </p>
            </div>

            <div>
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                placeholder="e.g. HDFC Bank, ICICI, SBI"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input
                id="accountNumber"
                placeholder="Bank Account Number"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label htmlFor="ifscCode">IFSC Code</Label>
              <Input
                id="ifscCode"
                placeholder="e.g. HDFC0000123"
                maxLength={11}
                value={form.ifscCode}
                onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label htmlFor="upiId">UPI ID (GooglePay / PhonePe / Paytm)</Label>
              <Input
                id="upiId"
                placeholder="business@okaxis or 9876543210@paytm"
                value={form.upiId}
                onChange={(e) => setForm({ ...form, upiId: e.target.value })}
                className="mt-1 font-mono"
              />
            </div>

            {/* Invoicing Preferences */}
            <div className="md:col-span-3 border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-foreground mb-1">Invoice Layout & Terms</h3>
            </div>

            <div>
              <Label htmlFor="invoicePrefix">Invoice Number Prefix</Label>
              <Input
                id="invoicePrefix"
                placeholder="INV"
                value={form.invoicePrefix}
                onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label htmlFor="invoiceTemplate">Default Template</Label>
              <select
                id="invoiceTemplate"
                value={form.invoiceTemplate}
                onChange={(e) => setForm({ ...form, invoiceTemplate: e.target.value })}
                className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
              >
                <option value="classic">Classic (Traditional Clean Layout)</option>
                <option value="modern">Modern (Gradient Accent & Contemporary)</option>
                <option value="compact">Compact (POS / Fast-Billing Layout)</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <Label htmlFor="terms">Invoice Terms & Conditions</Label>
              <textarea
                id="terms"
                rows={3}
                value={form.invoiceTerms}
                onChange={(e) => setForm({ ...form, invoiceTerms: e.target.value })}
                className="w-full p-2.5 rounded-md border text-xs bg-background mt-1 font-mono"
                placeholder="1. Goods once sold will not be returned.&#10;2. Subject to local jurisdiction."
              />
            </div>
          </form>
        </section>

        {/* Detection & Audit Guardrails */}
        <section className="surface-card p-6 space-y-4">
          <h2 className="text-sm font-semibold border-b border-border pb-3">Automated Leakage Detection Rules</h2>
          <div className="space-y-4">
            {[
              ["Duplicate purchase bill guardrail", "Flags identical bill numbers and amounts across vendors"],
              ["Duplicate payment detector", "Holds duplicate transactions before bank settlement"],
              ["Overpayment alerts", "Warns when bill payment exceeds total invoice liability"],
              ["Dormant vendor alert", "Alerts when invoices arrive from vendors inactive > 180 days"],
            ].map(([t, d]) => (
              <div key={t} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t}</p>
                  <p className="text-xs text-muted-foreground">{d}</p>
                </div>
                <Switch defaultChecked />
              </div>
            ))}
          </div>
        </section>

        {/* Appearance & Theme */}
        <section className="surface-card p-6 space-y-3">
          <h2 className="text-sm font-semibold">Appearance & UI Theme</h2>
          <p className="text-xs text-muted-foreground">Switch between light and dark presentation.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={toggleTheme}>
            Switch to {theme === "dark" ? "light" : "dark"} mode
          </Button>

          <div className="pt-4 border-t border-border mt-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Connected Accounting Systems</h3>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Auto Audit Rule Engine</span>
              <ToneBadge tone="success" size="sm">Active (Real-time)</ToneBadge>
            </div>
          </div>
        </section>

        {/* Legal & Statutory Information */}
        <section className="surface-card p-6 space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold border-b border-border pb-3">Legal & Statutory Information</h2>
          <div className="text-xs text-muted-foreground space-y-2">
            <p><strong className="text-foreground">Operating Platform:</strong> Auto Audit Business & Financial Management</p>
            <p><strong className="text-foreground">Compliance:</strong> Indian GST (CGST/SGST/IGST), DPDP Act & Statutory Accounting Standards</p>
            <div className="pt-2 flex flex-wrap gap-3 font-medium">
              <a href="/privacy-policy" className="text-primary underline">Privacy Policy</a>
              <a href="/terms-and-conditions" className="text-primary underline">Terms & Conditions</a>
              <a href="/cookie-policy" className="text-primary underline">Cookie Policy</a>
              <a href="/refund-policy" className="text-primary underline">Refund Policy</a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
