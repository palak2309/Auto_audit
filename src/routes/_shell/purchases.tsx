import React, { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Trash2,
  Eye,
  Calendar,
  Building2,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  listPurchaseBills,
  getPurchaseBill,
  createPurchaseBill,
  deletePurchaseBill,
  getNextBillNumber,
  type CreatePurchaseItemInput,
} from "@/lib/billing/purchases.functions";
import { listSuppliers } from "@/lib/billing/parties.functions";
import { listProducts } from "@/lib/billing/products.functions";
import { getBusinessProfile } from "@/lib/billing/business.functions";
import {
  calculateDocumentSummary,
  STANDARD_GST_RATES,
  INDIAN_STATES,
} from "@/lib/gst/calculator";
import { currencyIn, dateShort } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_shell/purchases")({
  head: () => ({
    meta: [
      { title: "Purchases & Bills — Auto Audit" },
      { name: "description", content: "Record vendor purchase bills, debit notes, track inventory replenishment and manage payables." },
    ],
  }),
  component: PurchasesPage,
});

function PurchasesPage() {
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState<string>("bill");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  // Server functions
  const listBillsFn = useServerFn(listPurchaseBills);
  const getBillFn = useServerFn(getPurchaseBill);
  const createBillFn = useServerFn(createPurchaseBill);
  const deleteBillFn = useServerFn(deletePurchaseBill);
  const getNextNoFn = useServerFn(getNextBillNumber);
  const listSuppliersFn = useServerFn(listSuppliers);
  const listProductsFn = useServerFn(listProducts);
  const getProfileFn = useServerFn(getBusinessProfile);

  // Queries
  const { data: bills = [], isLoading } = useQuery({
    queryKey: ["purchases", docType, statusFilter, search, fromDate, toDate],
    queryFn: () =>
      listBillsFn({
        data: {
          documentType: docType,
          status: statusFilter,
          search: search || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        },
      }),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => listSuppliersFn({ data: {} }),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => listProductsFn({ data: {} }),
  });

  const { data: businessProfile } = useQuery({
    queryKey: ["businessProfile"],
    queryFn: () => getProfileFn(),
  });

  // Builder state
  const [supplierId, setSupplierId] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().substring(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("Maharashtra");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("bank");
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<CreatePurchaseItemInput[]>([
    {
      productId: null,
      itemName: "",
      hsnCode: "",
      quantity: 1,
      unit: "PCS",
      unitPrice: 0,
      discountAmount: 0,
      gstRate: 18,
      taxInclusive: false,
    },
  ]);

  const handleOpenCreate = async (targetType = "bill") => {
    try {
      const nextNo = await getNextNoFn({ data: { documentType: targetType } });
      setBillNumber(nextNo);
    } catch {
      setBillNumber("");
    }

    setSupplierId("");
    setSupplierInvoiceNumber("");
    setBillDate(new Date().toISOString().substring(0, 10));
    setDueDate("");
    setPlaceOfSupply(businessProfile?.state || "Maharashtra");
    setDiscountAmount(0);
    setPaymentMode("bank");
    setAmountPaid(0);
    setNotes("");
    setItems([
      {
        productId: null,
        itemName: "",
        hsnCode: "",
        quantity: 1,
        unit: "PCS",
        unitPrice: 0,
        discountAmount: 0,
        gstRate: 18,
        taxInclusive: false,
      },
    ]);
    setIsCreateOpen(true);
  };

  const handleSupplierChange = (id: string) => {
    setSupplierId(id);
    const selected = suppliers.find((s) => s.id === id);
    if (selected?.state) {
      setPlaceOfSupply(selected.state);
    }
  };

  const handleProductSelect = (index: number, prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    const newItems = [...items];
    newItems[index] = {
      productId: prod.id,
      itemName: prod.name,
      hsnCode: prod.hsn_code || "",
      quantity: 1,
      unit: prod.unit || "PCS",
      unitPrice: Number(prod.purchase_price) || 0,
      discountAmount: 0,
      gstRate: Number(prod.tax_rate) || 18,
      taxInclusive: false,
    };
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: keyof CreatePurchaseItemInput, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index]!, [field]: value };
    setItems(newItems);
  };

  const handleAddItemRow = () => {
    setItems([
      ...items,
      {
        productId: null,
        itemName: "",
        hsnCode: "",
        quantity: 1,
        unit: "PCS",
        unitPrice: 0,
        discountAmount: 0,
        gstRate: 18,
        taxInclusive: false,
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const liveSummary = calculateDocumentSummary({
    items: items.map((it) => ({
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      discountAmount: Number(it.discountAmount) || 0,
      gstRate: Number(it.gstRate) || 0,
      taxInclusive: Boolean(it.taxInclusive),
    })),
    businessState: businessProfile?.state || "Maharashtra",
    placeOfSupply,
    documentDiscountType: "amount",
    documentDiscountValue: Number(discountAmount) || 0,
  });

  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some((it) => !it.itemName.trim())) {
      alert("All items must have a name or description");
      return;
    }

    try {
      await createBillFn({
        data: {
          documentType: docType as any,
          supplierId: supplierId || null,
          billNumber: billNumber.trim() || undefined,
          supplierInvoiceNumber: supplierInvoiceNumber.trim() || null,
          billDate,
          dueDate: dueDate || null,
          placeOfSupply,
          discountAmount: Number(discountAmount) || 0,
          paymentMode,
          amountPaid: Number(amountPaid) || 0,
          notes: notes.trim() || null,
          items,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setIsCreateOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to record purchase bill");
    }
  };

  const handleViewBill = async (id: string) => {
    try {
      const details = await getBillFn({ data: { id } });
      setSelectedBill(details);
      setIsViewOpen(true);
    } catch (err: any) {
      alert(err.message || "Failed to load bill");
    }
  };

  const handleCancelBill = async (id: string, no: string) => {
    if (!confirm(`Are you sure you want to cancel purchase bill "${no}"? This will revert inventory additions.`)) return;
    try {
      await deleteBillFn({ data: { id } });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    } catch (err: any) {
      alert(err.message || "Failed to cancel bill");
    }
  };

  const totalPurchases = bills.reduce((acc, b) => acc + (Number(b.grand_total) || 0), 0);
  const totalPaid = bills.reduce((acc, b) => acc + (Number(b.amount_paid) || 0), 0);
  const totalDue = bills.reduce((acc, b) => acc + (Number(b.balance_due) || 0), 0);

  const handleExportCsv = () => {
    const rows = bills.map((b) => ({
      "Bill Number": b.bill_number,
      "Supplier Bill No": b.supplier_invoice_number || "",
      Date: b.bill_date,
      Supplier: (b.supplier as any)?.name || "Vendor",
      "Grand Total": b.grand_total,
      "Amount Paid": b.amount_paid,
      "Balance Due": b.balance_due,
      Status: b.status,
    }));
    downloadCsv(`purchases-${docType}-${new Date().toISOString().substring(0, 10)}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchases & Vendor Bills"
        description="Record vendor bills, debit notes, automatic inventory stock additions and track vendor payables."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={bills.length === 0}>
              <Download className="w-4 h-4 mr-1.5" />
              Export CSV
            </Button>
            <Button size="sm" onClick={() => handleOpenCreate(docType)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Record Purchase Bill
            </Button>
          </div>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-card rounded-xl border">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Total Purchases</span>
          <p className="text-2xl font-bold font-mono text-foreground mt-1">{currencyIn(totalPurchases, "INR")}</p>
          <span className="text-xs text-muted-foreground">{bills.length} total bills</span>
        </div>
        <div className="p-4 bg-card rounded-xl border">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Paid to Suppliers</span>
          <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">{currencyIn(totalPaid, "INR")}</p>
          <span className="text-xs text-emerald-600">Settled purchases</span>
        </div>
        <div className="p-4 bg-card rounded-xl border">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Payables Outstanding</span>
          <p className="text-2xl font-bold font-mono text-amber-600 mt-1">{currencyIn(totalDue, "INR")}</p>
          <span className="text-xs text-amber-600">Owed to vendors</span>
        </div>
      </div>

      {/* Document Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        {[
          { id: "bill", label: "Purchase Bills" },
          { id: "debit_note", label: "Debit Notes (Purchase Returns)" },
          { id: "purchase_order", label: "Purchase Orders" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setDocType(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              docType === tab.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-card rounded-xl border">
        <div className="flex flex-1 items-center gap-3 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search by bill number, vendor or supplier bill no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-md border text-sm bg-background"
          >
            <option value="all">All Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                <th className="py-3 px-4">Bill #</th>
                <th className="py-3 px-3">Supplier / Vendor</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3 text-right">Grand Total</th>
                <th className="py-3 px-3 text-right">Payable Balance</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Loading purchase records...
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <ShoppingCart className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="font-medium text-base text-foreground">No purchase bills found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Record purchase bills from suppliers to replenish inventory stock automatically.
                    </p>
                    <Button size="sm" className="mt-4" onClick={() => handleOpenCreate(docType)}>
                      <Plus className="w-4 h-4 mr-1.5" />
                      Record First Bill
                    </Button>
                  </td>
                </tr>
              ) : (
                bills.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-foreground">{b.bill_number}</div>
                      {b.supplier_invoice_number && (
                        <div className="text-xs text-muted-foreground">Supplier Ref: {b.supplier_invoice_number}</div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-foreground">
                        {(b.supplier as any)?.name || "Vendor"}
                      </div>
                      {(b.supplier as any)?.company_name && (
                        <div className="text-xs text-muted-foreground">
                          {(b.supplier as any).company_name}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-xs text-muted-foreground">
                      <div>{dateShort(b.bill_date)}</div>
                      {b.due_date && <div className="text-[11px]">Due: {dateShort(b.due_date)}</div>}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                      {currencyIn(b.grand_total, "INR")}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium">
                      <span className={Number(b.balance_due) > 0 ? "text-amber-600 font-bold" : "text-emerald-600"}>
                        {currencyIn(b.balance_due, "INR")}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize ${
                          b.status === "paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : b.status === "partially_paid"
                            ? "bg-amber-100 text-amber-800"
                            : b.status === "cancelled"
                            ? "bg-muted text-muted-foreground line-through"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {b.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View Bill Details"
                          onClick={() => handleViewBill(b.id)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                        {b.status !== "cancelled" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Cancel Bill"
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => handleCancelBill(b.id, b.bill_number)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Purchase Bill Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Record {docType === "debit_note" ? "Debit Note" : docType === "purchase_order" ? "Purchase Order" : "Purchase Bill"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveBill} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/40 rounded-xl border">
              <div>
                <label className="text-xs font-semibold">Select Supplier / Vendor</label>
                <select
                  value={supplierId}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
                >
                  <option value="">Cash / Direct Vendor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.company_name ? `(${s.company_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold">Internal Bill Number</label>
                <Input
                  required
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Supplier's Bill / Invoice No.</label>
                <Input
                  placeholder="e.g. APX-9821"
                  value={supplierInvoiceNumber}
                  onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Bill Date</label>
                <Input
                  type="date"
                  required
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Due Date</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Supplier State</label>
                <select
                  value={placeOfSupply}
                  onChange={(e) => setPlaceOfSupply(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.name}>
                      {s.name} ({s.tin})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Purchased Items</span>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItemRow}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
                </Button>
              </div>

              <div className="border rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/60 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3 min-w-[200px]">Item Description</th>
                      <th className="py-2.5 px-2 w-20">HSN</th>
                      <th className="py-2.5 px-2 w-16">Qty</th>
                      <th className="py-2.5 px-2 w-20">Unit</th>
                      <th className="py-2.5 px-2 w-24">Buy Price</th>
                      <th className="py-2.5 px-2 w-24">GST %</th>
                      <th className="py-2.5 px-3 text-right w-28">Total</th>
                      <th className="py-2.5 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((it, idx) => {
                      const lineCalc = liveSummary.items[idx];
                      return (
                        <tr key={idx} className="hover:bg-muted/10">
                          <td className="p-2 space-y-1">
                            <select
                              value={it.productId || ""}
                              onChange={(e) => handleProductSelect(idx, e.target.value)}
                              className="w-full h-8 px-2 rounded border text-xs bg-background mb-1"
                            >
                              <option value="">-- Choose Existing Product --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Current Stock: {p.current_stock})
                                </option>
                              ))}
                            </select>
                            <Input
                              required
                              placeholder="Item name / description"
                              value={it.itemName}
                              onChange={(e) => handleItemChange(idx, "itemName", e.target.value)}
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              placeholder="HSN"
                              value={it.hsnCode || ""}
                              onChange={(e) => handleItemChange(idx, "hsnCode", e.target.value)}
                              className="h-8 text-xs font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="0.01"
                              step="any"
                              required
                              value={it.quantity}
                              onChange={(e) =>
                                handleItemChange(idx, "quantity", parseFloat(e.target.value) || 0)
                              }
                              className="h-8 text-xs font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={it.unit || "PCS"}
                              onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              value={it.unitPrice}
                              onChange={(e) =>
                                handleItemChange(idx, "unitPrice", parseFloat(e.target.value) || 0)
                              }
                              className="h-8 text-xs font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={it.gstRate}
                              onChange={(e) =>
                                handleItemChange(idx, "gstRate", parseFloat(e.target.value) || 0)
                              }
                              className="w-full h-8 px-2 rounded border text-xs bg-background"
                            >
                              {STANDARD_GST_RATES.map((r) => (
                                <option key={r} value={r}>
                                  {r}%
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-foreground">
                            {currencyIn(lineCalc?.totalAmount || 0, "INR")}
                          </td>
                          <td className="p-2 text-center">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                className="text-muted-foreground hover:text-rose-600 p-1"
                              >
                                &times;
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/40 rounded-xl border">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold">Payment Paid Out (Rs.)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold">Payment Mode</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
                    >
                      <option value="bank">Bank Transfer (NEFT/RTGS)</option>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold">Vendor Notes / Remarks</label>
                  <Input
                    placeholder="Batch delivery note or terms"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Total calculations */}
              <div className="space-y-1.5 text-xs text-right">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-mono font-medium">{currencyIn(liveSummary.subtotal, "INR")}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Taxable Value:</span>
                  <span className="font-mono font-medium">{currencyIn(liveSummary.taxableAmount, "INR")}</span>
                </div>

                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Input Tax (ITC):</span>
                  <span className="font-mono font-medium">{currencyIn(liveSummary.totalTax, "INR")}</span>
                </div>

                <div className="flex justify-between py-2 border-t-2 border-foreground text-sm font-bold text-foreground">
                  <span>Grand Total:</span>
                  <span className="font-mono text-base">{currencyIn(liveSummary.grandTotal, "INR")}</span>
                </div>

                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Paid:</span>
                  <span className="font-mono text-emerald-600">{currencyIn(amountPaid, "INR")}</span>
                </div>

                <div className="flex justify-between py-1 text-foreground font-bold bg-amber-500/10 px-2 rounded">
                  <span>Payable Due:</span>
                  <span className="font-mono text-amber-600">
                    {currencyIn(Math.max(0, liveSummary.grandTotal - amountPaid), "INR")}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Record Bill & Update Inventory</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bill View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Purchase Bill: {selectedBill?.bill?.bill_number}</DialogTitle>
          </DialogHeader>

          {selectedBill && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg">
                <div>
                  <span className="text-muted-foreground block">Supplier:</span>
                  <p className="font-bold text-foreground text-sm">
                    {selectedBill.bill.supplier?.name || "Direct Vendor"}
                  </p>
                  <p className="text-muted-foreground">{selectedBill.bill.supplier?.gstin}</p>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground block">Bill Date:</span>
                  <p className="font-medium text-foreground">{dateShort(selectedBill.bill.bill_date)}</p>
                  <p className="text-muted-foreground">Supplier Ref: {selectedBill.bill.supplier_invoice_number || "-"}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/60 font-semibold text-muted-foreground">
                      <th className="p-2">Item</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Price</th>
                      <th className="p-2 text-right">GST %</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedBill.items.map((it: any) => (
                      <tr key={it.id}>
                        <td className="p-2 font-medium">{it.item_name}</td>
                        <td className="p-2 text-right font-mono">
                          {it.quantity} {it.unit}
                        </td>
                        <td className="p-2 text-right font-mono">{currencyIn(it.unit_price, "INR")}</td>
                        <td className="p-2 text-right">{it.gst_rate}%</td>
                        <td className="p-2 text-right font-mono font-bold">
                          {currencyIn(it.total_amount, "INR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center p-3 bg-muted/40 rounded-lg text-sm font-bold">
                <span>Grand Total:</span>
                <span className="font-mono text-base">{currencyIn(selectedBill.bill.grand_total, "INR")}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
