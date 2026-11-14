import React, { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  FileText,
  Edit2,
  Trash2,
  Download,
  Receipt,
  Printer,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listCustomers,
  getCustomer,
  saveCustomer,
  deleteCustomer,
  getCustomerLedger,
} from "@/lib/billing/parties.functions";
import { INDIAN_STATES } from "@/lib/gst/calculator";
import { currencyIn, dateShort } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_shell/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Auto Audit" },
      {
        name: "description",
        content:
          "Manage customer directory, contact info, GSTIN, credit limits and outstanding receivables.",
      },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [hasBalanceOnly, setHasBalanceOnly] = useState(false);

  // Dialogs
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  // Server functions
  const listCustomersFn = useServerFn(listCustomers);
  const saveCustomerFn = useServerFn(saveCustomer);
  const deleteCustomerFn = useServerFn(deleteCustomer);
  const getCustomerLedgerFn = useServerFn(getCustomerLedger);

  // Queries
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", search, hasBalanceOnly],
    queryFn: () => listCustomersFn({ data: { search: search || undefined, hasBalanceOnly } }),
  });

  const { data: ledgerData, isLoading: isLedgerLoading } = useQuery({
    queryKey: ["customerLedger", selectedCustomer?.id],
    queryFn: () => getCustomerLedgerFn({ data: { customerId: selectedCustomer?.id } }),
    enabled: isLedgerOpen && Boolean(selectedCustomer?.id),
  });

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    companyName: "",
    phone: "",
    email: "",
    gstin: "",
    pan: "",
    billingAddress: "",
    billingCity: "",
    billingState: "Maharashtra",
    billingPincode: "",
    shippingAddress: "",
    shippingCity: "",
    shippingState: "Maharashtra",
    shippingPincode: "",
    openingBalance: 0,
    creditLimit: 0,
    paymentTermsDays: 30,
  });

  const handleOpenAdd = (cust?: any) => {
    if (cust) {
      setEditingCustomer(cust);
      setFormData({
        name: cust.name || "",
        companyName: cust.company_name || "",
        phone: cust.phone || "",
        email: cust.email || "",
        gstin: cust.gstin || "",
        pan: cust.pan || "",
        billingAddress: cust.billing_address || "",
        billingCity: cust.billing_city || "",
        billingState: cust.billing_state || "Maharashtra",
        billingPincode: cust.billing_pincode || "",
        shippingAddress: cust.shipping_address || "",
        shippingCity: cust.shipping_city || "",
        shippingState: cust.shipping_state || "Maharashtra",
        shippingPincode: cust.shipping_pincode || "",
        openingBalance: Number(cust.opening_balance) || 0,
        creditLimit: Number(cust.credit_limit) || 0,
        paymentTermsDays: Number(cust.payment_terms_days) || 30,
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: "",
        companyName: "",
        phone: "",
        email: "",
        gstin: "",
        pan: "",
        billingAddress: "",
        billingCity: "",
        billingState: "Maharashtra",
        billingPincode: "",
        shippingAddress: "",
        shippingCity: "",
        shippingState: "Maharashtra",
        shippingPincode: "",
        openingBalance: 0,
        creditLimit: 0,
        paymentTermsDays: 30,
      });
    }
    setIsAddOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      await saveCustomerFn({
        data: {
          id: editingCustomer?.id,
          name: formData.name.trim(),
          company_name: formData.companyName.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          gstin: formData.gstin.trim() || null,
          pan: formData.pan.trim() || null,
          billing_address: formData.billingAddress.trim() || null,
          billing_city: formData.billingCity.trim() || null,
          billing_state: formData.billingState,
          billing_pincode: formData.billingPincode.trim() || null,
          shipping_address: formData.shippingAddress.trim() || null,
          shipping_city: formData.shippingCity.trim() || null,
          shipping_state: formData.shippingState,
          shipping_pincode: formData.shippingPincode.trim() || null,
          opening_balance: Number(formData.openingBalance) || 0,
          credit_limit: Number(formData.creditLimit) || 0,
          payment_terms_days: Number(formData.paymentTermsDays) || 30,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setIsAddOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to save customer");
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove customer "${name}"?`)) return;
    try {
      await deleteCustomerFn({ data: { id } });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (err: any) {
      alert(err.message || "Failed to delete customer");
    }
  };

  const handleExportCsv = () => {
    const rows = customers.map((c) => ({
      Name: c.name,
      Company: c.company_name || "",
      Phone: c.phone || "",
      Email: c.email || "",
      GSTIN: c.gstin || "",
      State: c.billing_state || "",
      "Outstanding Balance": c.current_balance,
      "Credit Limit": c.credit_limit,
    }));
    downloadCsv(`customers-${new Date().toISOString().substring(0, 10)}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage your client directory, GST numbers, contact info and track receivables."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={customers.length === 0}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export CSV
            </Button>
            <Button size="sm" onClick={() => handleOpenAdd()}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Customer
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-card rounded-xl border">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search customers by name, company, phone, email or GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Button
          variant={hasBalanceOnly ? "secondary" : "outline"}
          size="sm"
          onClick={() => setHasBalanceOnly(!hasBalanceOnly)}
        >
          {hasBalanceOnly ? "Showing With Balance" : "Pending Balance Only"}
        </Button>
      </div>

      {/* Customers Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-3">GSTIN / State</th>
                <th className="py-3 px-3 text-right">Credit Limit</th>
                <th className="py-3 px-3 text-right">Outstanding Due</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="font-medium text-base text-foreground">No customers found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add your customers to issue GST invoices and track payment collections.
                    </p>
                    <Button size="sm" className="mt-4" onClick={() => handleOpenAdd()}>
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add First Customer
                    </Button>
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const bal = Number(c.current_balance) || 0;
                  return (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{c.name}</div>
                        {c.company_name && (
                          <div className="text-xs text-muted-foreground">{c.company_name}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs space-y-0.5">
                        {c.phone && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="w-3 h-3" /> {c.phone}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="w-3 h-3" /> {c.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <div className="font-mono font-medium text-foreground">
                          {c.gstin || "-"}
                        </div>
                        <div className="text-muted-foreground text-[11px]">{c.billing_state}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-muted-foreground text-xs">
                        {Number(c.credit_limit) > 0 ? currencyIn(c.credit_limit, "INR") : "-"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span className={bal > 0 ? "text-rose-600" : "text-emerald-600"}>
                          {currencyIn(bal, "INR")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="View Statement / Ledger"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setIsLedgerOpen(true);
                            }}
                          >
                            <FileText className="w-3.5 h-3.5 mr-1" />
                            Ledger
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit Customer"
                            onClick={() => handleOpenAdd(c)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete"
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => handleDeleteCustomer(c.id, c.name)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCustomer} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold">Contact / Customer Name *</label>
                <Input
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Business / Company Name</label>
                <Input
                  placeholder="e.g. Sharma Enterprises"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Phone Number</label>
                <Input
                  placeholder="e.g. +91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Email</label>
                <Input
                  type="email"
                  placeholder="e.g. rahul@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold">GSTIN (Optional)</label>
                <Input
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  maxLength={15}
                  value={formData.gstin}
                  onChange={(e) =>
                    setFormData({ ...formData, gstin: e.target.value.toUpperCase() })
                  }
                />
              </div>

              <div>
                <label className="text-xs font-semibold">PAN</label>
                <Input
                  placeholder="e.g. AAAAA0000A"
                  maxLength={10}
                  value={formData.pan}
                  onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-semibold">Billing Address</label>
                <Input
                  placeholder="Street address, shop number, building..."
                  value={formData.billingAddress}
                  onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold">City</label>
                <Input
                  placeholder="City"
                  value={formData.billingCity}
                  onChange={(e) => setFormData({ ...formData, billingCity: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold">State (Place of Supply) *</label>
                <select
                  value={formData.billingState}
                  onChange={(e) => setFormData({ ...formData, billingState: e.target.value })}
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
                <label className="text-xs font-semibold">Pincode</label>
                <Input
                  placeholder="Pincode"
                  value={formData.billingPincode}
                  onChange={(e) => setFormData({ ...formData, billingPincode: e.target.value })}
                />
              </div>

              {!editingCustomer && (
                <div>
                  <label className="text-xs font-semibold">Opening Balance (Rs.)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Positive if customer owes money"
                    value={formData.openingBalance}
                    onChange={(e) =>
                      setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold">Credit Limit (Rs.)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.creditLimit}
                  onChange={(e) =>
                    setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Payment Terms (Days)</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.paymentTermsDays}
                  onChange={(e) =>
                    setFormData({ ...formData, paymentTermsDays: parseInt(e.target.value) || 30 })
                  }
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Customer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Ledger Dialog */}
      <Dialog open={isLedgerOpen} onOpenChange={setIsLedgerOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center pr-6">
              <div>
                <DialogTitle>Customer Ledger Statement</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedCustomer?.name}{" "}
                  {selectedCustomer?.company_name && `(${selectedCustomer.company_name})`}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.print()}
                className="print:hidden"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Print Statement
              </Button>
            </div>
          </DialogHeader>

          {isLedgerLoading ? (
            <div className="py-12 text-center text-muted-foreground">Calculating statement...</div>
          ) : ledgerData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-lg text-center">
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase">
                    Total Invoiced (Debits)
                  </span>
                  <p className="font-mono font-bold text-foreground">
                    {currencyIn(ledgerData.totalDebits, "INR")}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase">
                    Total Received (Credits)
                  </span>
                  <p className="font-mono font-bold text-emerald-600">
                    {currencyIn(ledgerData.totalCredits, "INR")}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase">
                    Closing Balance Due
                  </span>
                  <p className="font-mono font-bold text-rose-600">
                    {currencyIn(ledgerData.closingBalance, "INR")}
                  </p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/60 text-muted-foreground font-semibold uppercase">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-2">Type</th>
                      <th className="py-2 px-2">Ref / No</th>
                      <th className="py-2 px-2 text-right">Debit (Dr)</th>
                      <th className="py-2 px-2 text-right">Credit (Cr)</th>
                      <th className="py-2 px-3 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ledgerData.entries.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-muted/20">
                        <td className="py-2 px-3 text-muted-foreground">{dateShort(entry.date)}</td>
                        <td className="py-2 px-2 font-medium">{entry.type}</td>
                        <td className="py-2 px-2 font-mono">{entry.referenceNumber}</td>
                        <td className="py-2 px-2 text-right font-mono">
                          {entry.debit > 0 ? currencyIn(entry.debit, "INR") : "-"}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-emerald-600">
                          {entry.credit > 0 ? currencyIn(entry.credit, "INR") : "-"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {currencyIn(entry.runningBalance, "INR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No ledger transactions found
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
