import React, { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Share2,
  Trash2,
  Eye,
  Calendar,
  FileCheck,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingDown,
  Building2,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  listSalesInvoices,
  getSalesInvoice,
  createSalesInvoice,
  deleteSalesInvoice,
  getNextInvoiceNumber,
  type CreateInvoiceItemInput,
} from "@/lib/billing/sales.functions";
import { listCustomers } from "@/lib/billing/parties.functions";
import { listProducts } from "@/lib/billing/products.functions";
import { getBusinessProfile } from "@/lib/billing/business.functions";
import {
  calculateDocumentSummary,
  STANDARD_GST_RATES,
  INDIAN_STATES,
} from "@/lib/gst/calculator";
import { currencyIn, dateShort } from "@/lib/format";
import { InvoicePreview, type InvoicePreviewData } from "@/components/billing/invoice-preview";
import { downloadCsv } from "@/lib/csv";
import { useErpFinancials } from "@/hooks/use-erp";

export const Route = createFileRoute("/_shell/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices & Billing — Auto Audit" },
      { name: "description", content: "Create professional GST invoices, quotations, proforma bills and track payment collections." },
    ],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState<string>("tax_invoice");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [previewData, setPreviewData] = useState<InvoicePreviewData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Server functions
  const listInvoicesFn = useServerFn(listSalesInvoices);
  const getInvoiceFn = useServerFn(getSalesInvoice);
  const createInvoiceFn = useServerFn(createSalesInvoice);
  const deleteInvoiceFn = useServerFn(deleteSalesInvoice);
  const getNextNoFn = useServerFn(getNextInvoiceNumber);
  const listCustomersFn = useServerFn(listCustomers);
  const listProductsFn = useServerFn(listProducts);
  const getProfileFn = useServerFn(getBusinessProfile);

  // Existing ERP hook for the "Imported ERP Invoices" tab
  const { data: erpData, isLoading: isErpLoading } = useErpFinancials();

  // Queries
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", docType, statusFilter, search, fromDate, toDate],
    queryFn: () =>
      listInvoicesFn({
        data: {
          documentType: docType === "erp_imported" ? "tax_invoice" : docType,
          status: statusFilter,
          search: search || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        },
      }),
    enabled: docType !== "erp_imported",
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomersFn({ data: {} }),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => listProductsFn({ data: {} }),
  });

  const { data: businessProfile } = useQuery({
    queryKey: ["businessProfile"],
    queryFn: () => getProfileFn(),
  });

  // Invoice Builder Form State
  const [customerId, setCustomerId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().substring(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("Maharashtra");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "amount">("percentage");
  const [discountValue, setDiscountValue] = useState(0);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  const [items, setItems] = useState<CreateInvoiceItemInput[]>([
    {
      productId: null,
      itemName: "",
      hsnCode: "",
      quantity: 1,
      unit: "PCS",
      unitPrice: 0,
      discountPercentage: 0,
      discountAmount: 0,
      gstRate: 18,
      taxInclusive: false,
    },
  ]);

  // Open Create Dialog
  const handleOpenCreate = async (targetType = "tax_invoice") => {
    try {
      const nextNo = await getNextNoFn({ data: { documentType: targetType } });
      setInvoiceNumber(nextNo);
    } catch {
      setInvoiceNumber("");
    }

    setCustomerId("");
    setInvoiceDate(new Date().toISOString().substring(0, 10));
    setDueDate("");
    setPlaceOfSupply(businessProfile?.state || "Maharashtra");
    setReferenceNumber("");
    setDiscountType("percentage");
    setDiscountValue(0);
    setPaymentMode("cash");
    setAmountPaid(0);
    setNotes("");
    setTerms(businessProfile?.invoice_terms || "");
    setItems([
      {
        productId: null,
        itemName: "",
        hsnCode: "",
        quantity: 1,
        unit: "PCS",
        unitPrice: 0,
        discountPercentage: 0,
        discountAmount: 0,
        gstRate: 18,
        taxInclusive: false,
      },
    ]);
    setIsCreateOpen(true);
  };

  // When customer changes, auto-fill place of supply
  const handleCustomerChange = (id: string) => {
    setCustomerId(id);
    const selected = customers.find((c) => c.id === id);
    if (selected?.billing_state) {
      setPlaceOfSupply(selected.billing_state);
    }
  };

  // Product Selection on a row
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
      unitPrice: Number(prod.selling_price) || 0,
      discountPercentage: 0,
      discountAmount: 0,
      gstRate: Number(prod.tax_rate) || 18,
      taxInclusive: Boolean(prod.tax_inclusive),
    };
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: keyof CreateInvoiceItemInput, value: any) => {
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
        discountPercentage: 0,
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

  // Live Calculations for Invoice Builder
  const liveSummary = calculateDocumentSummary({
    items: items.map((it) => ({
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      discountPercentage: Number(it.discountPercentage) || 0,
      discountAmount: Number(it.discountAmount) || 0,
      gstRate: Number(it.gstRate) || 0,
      taxInclusive: Boolean(it.taxInclusive),
    })),
    businessState: businessProfile?.state || "Maharashtra",
    placeOfSupply,
    documentDiscountType: discountType,
    documentDiscountValue: Number(discountValue) || 0,
  });

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some((it) => !it.itemName.trim())) {
      alert("All items must have a name or description");
      return;
    }

    try {
      await createInvoiceFn({
        data: {
          documentType: docType as any,
          customerId: customerId || null,
          invoiceNumber: invoiceNumber.trim() || undefined,
          referenceNumber: referenceNumber.trim() || null,
          invoiceDate,
          dueDate: dueDate || null,
          placeOfSupply,
          discountType,
          discountValue: Number(discountValue) || 0,
          paymentMode,
          amountPaid: Number(amountPaid) || 0,
          notes: notes.trim() || null,
          termsAndConditions: terms.trim() || null,
          items,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setIsCreateOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to create invoice");
    }
  };

  const handleViewPreview = async (invId: string) => {
    try {
      const details = await getInvoiceFn({ data: { id: invId } });
      setPreviewData(details as any);
      setIsPreviewOpen(true);
    } catch (err: any) {
      alert(err.message || "Failed to fetch invoice details");
    }
  };

  const handleCancelInvoice = async (id: string, no: string) => {
    if (!confirm(`Are you sure you want to cancel invoice "${no}"? This will revert inventory deductions.`)) return;
    try {
      await deleteInvoiceFn({ data: { id } });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (err: any) {
      alert(err.message || "Failed to cancel invoice");
    }
  };

  // Metrics summary
  const totalBilled = invoices.reduce((acc, i) => acc + (Number(i.grand_total) || 0), 0);
  const totalPaid = invoices.reduce((acc, i) => acc + (Number(i.amount_paid) || 0), 0);
  const totalDue = invoices.reduce((acc, i) => acc + (Number(i.balance_due) || 0), 0);

  const handleExportCsv = () => {
    const rows = invoices.map((i) => ({
      "Invoice Number": i.invoice_number,
      Date: i.invoice_date,
      Customer: (i.customer as any)?.name || "Cash Customer",
      "Grand Total": i.grand_total,
      "Amount Paid": i.amount_paid,
      "Balance Due": i.balance_due,
      Status: i.status,
      "Place of Supply": i.place_of_supply,
    }));
    downloadCsv(`invoices-${docType}-${new Date().toISOString().substring(0, 10)}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales & Invoicing"
        description="Generate GST compliant tax invoices, quotations, proforma bills and manage payment collections."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={invoices.length === 0}>
              <Download className="w-4 h-4 mr-1.5" />
              Export CSV
            </Button>
            <Button size="sm" onClick={() => handleOpenCreate(docType === "erp_imported" ? "tax_invoice" : docType)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create Invoice
            </Button>
          </div>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-card rounded-xl border">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Total Billed</span>
          <p className="text-2xl font-bold font-mono text-foreground mt-1">{currencyIn(totalBilled, "INR")}</p>
          <span className="text-xs text-muted-foreground">{invoices.length} total documents</span>
        </div>
        <div className="p-4 bg-card rounded-xl border">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Collected</span>
          <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">{currencyIn(totalPaid, "INR")}</p>
          <span className="text-xs text-emerald-600">Settled payments</span>
        </div>
        <div className="p-4 bg-card rounded-xl border">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Balance Outstanding</span>
          <p className="text-2xl font-bold font-mono text-rose-600 mt-1">{currencyIn(totalDue, "INR")}</p>
          <span className="text-xs text-rose-600">Receivable from clients</span>
        </div>
      </div>

      {/* Document Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        {[
          { id: "tax_invoice", label: "Tax Invoices" },
          { id: "quotation", label: "Quotations / Estimates" },
          { id: "proforma", label: "Proforma Invoices" },
          { id: "credit_note", label: "Credit Notes" },
          { id: "erp_imported", label: "Imported ERP Invoices" },
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
      {docType !== "erp_imported" && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-card rounded-xl border">
          <div className="flex flex-1 items-center gap-3 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search by invoice number or reference..."
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
      )}

      {/* Invoices Table */}
      {docType === "erp_imported" ? (
        /* Preserved view of connected ERP Invoices */
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="p-3 bg-muted/40 border-b text-xs font-medium text-muted-foreground">
            Invoices synchronized from connected ERP / Accounting software
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-3">Party</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-right">Paid</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isErpLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      Loading ERP records...
                    </td>
                  </tr>
                ) : (erpData?.invoices ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No ERP invoices synchronized yet. Connect your ERP in Settings or record manual invoices.
                    </td>
                  </tr>
                ) : (
                  (erpData?.invoices ?? []).map((r: any, idx: number) => (
                    <tr key={r.id || idx} className="hover:bg-muted/30">
                      <td className="py-3 px-4 font-mono font-medium">{r.invoice_number || r.external_id}</td>
                      <td className="py-3 px-3">{r.vendor_name || "—"}</td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">{dateShort(r.issue_date)}</td>
                      <td className="py-3 px-3 text-right font-mono font-medium">{currencyIn(r.amount, "INR")}</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-600">
                        {currencyIn(r.amount_paid, "INR")}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-xs px-2 py-0.5 rounded bg-muted capitalize">{r.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3 text-right">Total Amount</th>
                  <th className="py-3 px-3 text-right">Balance Due</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      Loading invoices...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <Receipt className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="font-medium text-base text-foreground">No invoices found</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Create your first invoice to bill customers and manage receivables.
                      </p>
                      <Button size="sm" className="mt-4" onClick={() => handleOpenCreate(docType)}>
                        <Plus className="w-4 h-4 mr-1.5" />
                        Create {docType === "quotation" ? "Quotation" : "Invoice"} Now
                      </Button>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-foreground">{inv.invoice_number}</div>
                        {inv.reference_number && (
                          <div className="text-xs text-muted-foreground">Ref: {inv.reference_number}</div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-foreground">
                          {(inv.customer as any)?.name || "Cash Customer"}
                        </div>
                        {(inv.customer as any)?.company_name && (
                          <div className="text-xs text-muted-foreground">
                            {(inv.customer as any).company_name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">
                        <div>{dateShort(inv.invoice_date)}</div>
                        {inv.due_date && <div className="text-[11px]">Due: {dateShort(inv.due_date)}</div>}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                        {currencyIn(inv.grand_total, "INR")}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-medium">
                        <span className={Number(inv.balance_due) > 0 ? "text-rose-600" : "text-emerald-600"}>
                          {currencyIn(inv.balance_due, "INR")}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize ${
                            inv.status === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : inv.status === "partially_paid"
                              ? "bg-amber-100 text-amber-800"
                              : inv.status === "cancelled"
                              ? "bg-muted text-muted-foreground line-through"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {inv.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="View / Print Invoice"
                            onClick={() => handleViewPreview(inv.id)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            View
                          </Button>
                          {inv.status !== "cancelled" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Cancel Invoice"
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              onClick={() => handleCancelInvoice(inv.id, inv.invoice_number)}
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
      )}

      {/* Create Invoice Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Create New {docType === "quotation" ? "Quotation" : docType === "credit_note" ? "Credit Note" : "Tax Invoice"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveInvoice} className="space-y-6">
            {/* Customer & Invoice Meta Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/40 rounded-xl border">
              <div>
                <label className="text-xs font-semibold">Select Customer</label>
                <select
                  value={customerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
                >
                  <option value="">Cash Customer (Walk-in)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company_name ? `(${c.company_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold">Invoice Number</label>
                <Input
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Invoice Date</label>
                <Input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Place of Supply (State)</label>
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

              <div>
                <label className="text-xs font-semibold">Payment Due Date</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Ref / PO Number</label>
                <Input
                  placeholder="Optional reference"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Line Items</span>
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
                      <th className="py-2.5 px-2 w-24">Price (Rs.)</th>
                      <th className="py-2.5 px-2 w-20">Disc %</th>
                      <th className="py-2.5 px-2 w-24">GST Rate</th>
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
                                  {p.name} (Stock: {p.current_stock})
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
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={it.discountPercentage || 0}
                              onChange={(e) =>
                                handleItemChange(idx, "discountPercentage", parseFloat(e.target.value) || 0)
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
                    <label className="text-xs font-semibold">Payment Received (Rs.)</label>
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
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                      <option value="upi">UPI / QR Code</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold">Customer Notes</label>
                  <Input
                    placeholder="Thanks for your business!"
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
                {liveSummary.totalDiscount > 0 && (
                  <div className="flex justify-between py-1 border-b text-rose-600">
                    <span>Discount:</span>
                    <span className="font-mono font-medium">- {currencyIn(liveSummary.totalDiscount, "INR")}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Taxable Value:</span>
                  <span className="font-mono font-medium">{currencyIn(liveSummary.taxableAmount, "INR")}</span>
                </div>

                {liveSummary.igstAmount > 0 ? (
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">IGST (Inter-state):</span>
                    <span className="font-mono font-medium">{currencyIn(liveSummary.igstAmount, "INR")}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">CGST:</span>
                      <span className="font-mono font-medium">{currencyIn(liveSummary.cgstAmount, "INR")}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">SGST:</span>
                      <span className="font-mono font-medium">{currencyIn(liveSummary.sgstAmount, "INR")}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between py-2 border-t-2 border-foreground text-sm font-bold text-foreground">
                  <span>Grand Total:</span>
                  <span className="font-mono text-base">{currencyIn(liveSummary.grandTotal, "INR")}</span>
                </div>

                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Paid:</span>
                  <span className="font-mono text-emerald-600">{currencyIn(amountPaid, "INR")}</span>
                </div>

                <div className="flex justify-between py-1 text-foreground font-bold bg-amber-500/10 px-2 rounded">
                  <span>Balance Due:</span>
                  <span className="font-mono text-rose-600">
                    {currencyIn(Math.max(0, liveSummary.grandTotal - amountPaid), "INR")}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Generate & Save Invoice</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invoice Visual Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          {previewData && (
            <InvoicePreview
              data={previewData}
              template={
                (previewData.businessProfile?.invoice_template as any) || "classic"
              }
              onClose={() => setIsPreviewOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
