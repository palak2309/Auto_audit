import React, { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  FileText,
  Edit2,
  Trash2,
  Download,
  Printer,
  CreditCard,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  listSuppliers,
  getSupplier,
  saveSupplier,
  deleteSupplier,
  getSupplierLedger,
} from "@/lib/billing/parties.functions";
import { INDIAN_STATES } from "@/lib/gst/calculator";
import { currencyIn, dateShort } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_shell/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers & Vendors — Auto Audit" },
      { name: "description", content: "Manage suppliers, vendor bank details, GSTIN, purchase history and outstanding payables." },
    ],
  }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [hasBalanceOnly, setHasBalanceOnly] = useState(false);

  // Dialogs
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);

  // Server functions
  const listSuppliersFn = useServerFn(listSuppliers);
  const saveSupplierFn = useServerFn(saveSupplier);
  const deleteSupplierFn = useServerFn(deleteSupplier);
  const getSupplierLedgerFn = useServerFn(getSupplierLedger);

  // Queries
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", search, hasBalanceOnly],
    queryFn: () => listSuppliersFn({ data: { search: search || undefined, hasBalanceOnly } }),
  });

  const { data: ledgerData, isLoading: isLedgerLoading } = useQuery({
    queryKey: ["supplierLedger", selectedSupplier?.id],
    queryFn: () => getSupplierLedgerFn({ data: { supplierId: selectedSupplier?.id } }),
    enabled: isLedgerOpen && Boolean(selectedSupplier?.id),
  });

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    companyName: "",
    phone: "",
    email: "",
    gstin: "",
    pan: "",
    address: "",
    city: "",
    state: "Maharashtra",
    pincode: "",
    openingBalance: 0,
    paymentTermsDays: 30,
    bankName: "",
    accountNumber: "",
    ifscCode: "",
  });

  const handleOpenAdd = (sup?: any) => {
    if (sup) {
      setEditingSupplier(sup);
      setFormData({
        name: sup.name || "",
        companyName: sup.company_name || "",
        phone: sup.phone || "",
        email: sup.email || "",
        gstin: sup.gstin || "",
        pan: sup.pan || "",
        address: sup.address || "",
        city: sup.city || "",
        state: sup.state || "Maharashtra",
        pincode: sup.pincode || "",
        openingBalance: Number(sup.opening_balance) || 0,
        paymentTermsDays: Number(sup.payment_terms_days) || 30,
        bankName: sup.bank_name || "",
        accountNumber: sup.account_number || "",
        ifscCode: sup.ifsc_code || "",
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: "",
        companyName: "",
        phone: "",
        email: "",
        gstin: "",
        pan: "",
        address: "",
        city: "",
        state: "Maharashtra",
        pincode: "",
        openingBalance: 0,
        paymentTermsDays: 30,
        bankName: "",
        accountNumber: "",
        ifscCode: "",
      });
    }
    setIsAddOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      await saveSupplierFn({
        data: {
          id: editingSupplier?.id,
          name: formData.name.trim(),
          company_name: formData.companyName.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          gstin: formData.gstin.trim() || null,
          pan: formData.pan.trim() || null,
          address: formData.address.trim() || null,
          city: formData.city.trim() || null,
          state: formData.state,
          pincode: formData.pincode.trim() || null,
          opening_balance: Number(formData.openingBalance) || 0,
          payment_terms_days: Number(formData.paymentTermsDays) || 30,
          bank_name: formData.bankName.trim() || null,
          account_number: formData.accountNumber.trim() || null,
          ifsc_code: formData.ifscCode.trim() || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setIsAddOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to save supplier");
    }
  };

  const handleDeleteSupplier = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove supplier "${name}"?`)) return;
    try {
      await deleteSupplierFn({ data: { id } });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    } catch (err: any) {
      alert(err.message || "Failed to delete supplier");
    }
  };

  const handleExportCsv = () => {
    const rows = suppliers.map((s) => ({
      Name: s.name,
      Company: s.company_name || "",
      Phone: s.phone || "",
      Email: s.email || "",
      GSTIN: s.gstin || "",
      State: s.state || "",
      "Outstanding Payable": s.current_balance,
      Bank: s.bank_name || "",
      "A/C Number": s.account_number || "",
    }));
    downloadCsv(`suppliers-${new Date().toISOString().substring(0, 10)}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Manage vendor accounts, bank details, purchase histories and outstanding payables."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={suppliers.length === 0}>
              <Download className="w-4 h-4 mr-1.5" />
              Export CSV
            </Button>
            <Button size="sm" onClick={() => handleOpenAdd()}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Supplier
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-card rounded-xl border">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search suppliers by name, company, phone, email or GSTIN..."
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
          {hasBalanceOnly ? "Showing With Payables" : "Pending Payables Only"}
        </Button>
      </div>

      {/* Suppliers Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">Supplier / Vendor</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-3">GSTIN / State</th>
                <th className="py-3 px-3">Bank Details</th>
                <th className="py-3 px-3 text-right">Outstanding Payable</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Loading suppliers...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Building2 className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="font-medium text-base text-foreground">No suppliers found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add your vendors and suppliers to record purchase bills and track payables.
                    </p>
                    <Button size="sm" className="mt-4" onClick={() => handleOpenAdd()}>
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add First Supplier
                    </Button>
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => {
                  const bal = Number(s.current_balance) || 0;
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{s.name}</div>
                        {s.company_name && (
                          <div className="text-xs text-muted-foreground">{s.company_name}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs space-y-0.5">
                        {s.phone && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="w-3 h-3" /> {s.phone}
                          </div>
                        )}
                        {s.email && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="w-3 h-3" /> {s.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <div className="font-mono font-medium text-foreground">{s.gstin || "-"}</div>
                        <div className="text-muted-foreground text-[11px]">{s.state}</div>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground font-mono">
                        {s.bank_name ? (
                          <div>
                            <div>{s.bank_name}</div>
                            <div className="text-[11px] text-muted-foreground">{s.account_number}</div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span className={bal > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}>
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
                              setSelectedSupplier(s);
                              setIsLedgerOpen(true);
                            }}
                          >
                            <FileText className="w-3.5 h-3.5 mr-1" />
                            Ledger
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit Supplier"
                            onClick={() => handleOpenAdd(s)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete"
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => handleDeleteSupplier(s.id, s.name)}
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

      {/* Add / Edit Supplier Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSupplier} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold">Vendor / Supplier Name *</label>
                <Input
                  required
                  placeholder="e.g. Apex Wholesalers Ltd"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Contact Person</label>
                <Input
                  placeholder="e.g. Suresh Patel"
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
                  placeholder="e.g. vendor@apex.com"
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
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
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
                <label className="text-xs font-semibold">Address</label>
                <Input
                  placeholder="Street address, industrial area, warehouse..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold">City</label>
                <Input
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold">State *</label>
                <select
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.name}>
                      {s.name} ({s.tin})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 border-t pt-2">
                <span className="text-xs font-bold text-muted-foreground uppercase">Bank Details for Payouts</span>
              </div>

              <div>
                <label className="text-xs font-semibold">Bank Name</label>
                <Input
                  placeholder="e.g. HDFC Bank, SBI"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Account Number</label>
                <Input
                  placeholder="A/C Number"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold">IFSC Code</label>
                <Input
                  placeholder="e.g. HDFC0001234"
                  maxLength={11}
                  value={formData.ifscCode}
                  onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                />
              </div>

              {!editingSupplier && (
                <div>
                  <label className="text-xs font-semibold">Opening Balance (Rs.)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Positive if you owe supplier"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Supplier</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Supplier Ledger Dialog */}
      <Dialog open={isLedgerOpen} onOpenChange={setIsLedgerOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center pr-6">
              <div>
                <DialogTitle>Supplier Ledger Statement</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedSupplier?.name}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => window.print()} className="print:hidden">
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
                  <span className="text-[11px] text-muted-foreground uppercase">Bills (Credits)</span>
                  <p className="font-mono font-bold text-foreground">{currencyIn(ledgerData.totalCredits, "INR")}</p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase">Paid (Debits)</span>
                  <p className="font-mono font-bold text-emerald-600">{currencyIn(ledgerData.totalDebits, "INR")}</p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase">Closing Payable Due</span>
                  <p className="font-mono font-bold text-amber-600">{currencyIn(ledgerData.closingBalance, "INR")}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/60 text-muted-foreground font-semibold uppercase">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-2">Type</th>
                      <th className="py-2 px-2">Ref / No</th>
                      <th className="py-2 px-2 text-right">Debit (Paid)</th>
                      <th className="py-2 px-2 text-right">Credit (Billed)</th>
                      <th className="py-2 px-3 text-right">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ledgerData.entries.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-muted/20">
                        <td className="py-2 px-3 text-muted-foreground">{dateShort(entry.date)}</td>
                        <td className="py-2 px-2 font-medium">{entry.type}</td>
                        <td className="py-2 px-2 font-mono">{entry.referenceNumber}</td>
                        <td className="py-2 px-2 text-right font-mono text-emerald-600">
                          {entry.debit > 0 ? currencyIn(entry.debit, "INR") : "-"}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
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
            <div className="py-8 text-center text-muted-foreground">No ledger transactions found</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
