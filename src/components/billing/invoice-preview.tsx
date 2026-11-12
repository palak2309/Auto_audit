import React, { useRef } from "react";
import { Printer, Download, Share2, Copy, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { numberToIndianWords } from "@/lib/gst/calculator";
import { currencyIn, dateShort } from "@/lib/format";

export interface InvoicePreviewData {
  invoice: {
    id: string;
    invoice_number: string;
    reference_number?: string | null;
    invoice_date: string;
    due_date?: string | null;
    place_of_supply: string;
    document_type: string;
    status: string;
    subtotal: number;
    discount_amount: number;
    taxable_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    total_tax: number;
    round_off: number;
    grand_total: number;
    amount_paid: number;
    balance_due: number;
    payment_mode?: string | null;
    notes?: string | null;
    terms_and_conditions?: string | null;
  };
  customer?: {
    name: string;
    company_name?: string | null;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    billing_address?: string | null;
    billing_city?: string | null;
    billing_state?: string | null;
    billing_pincode?: string | null;
  } | null;
  items: Array<{
    id: string;
    item_name: string;
    hsn_code?: string | null;
    quantity: number;
    unit: string;
    unit_price: number;
    discount_amount: number;
    taxable_value: number;
    gst_rate: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    total_tax: number;
    total_amount: number;
  }>;
  businessProfile?: {
    company_name: string;
    business_type?: string | null;
    gstin?: string | null;
    pan?: string | null;
    email?: string | null;
    phone?: string | null;
    address_line1?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    bank_name?: string | null;
    account_number?: string | null;
    ifsc_code?: string | null;
    branch_name?: string | null;
    upi_id?: string | null;
    invoice_terms?: string | null;
    invoice_template?: string | null;
  } | null;
}

export function InvoicePreview({
  data,
  template = "classic",
  onClose,
}: {
  data: InvoicePreviewData;
  template?: "classic" | "modern" | "compact";
  onClose?: () => void;
}) {
  const [currentTemplate, setCurrentTemplate] = React.useState<"classic" | "modern" | "compact">(template);
  const [copied, setCopied] = React.useState(false);

  const { invoice, customer, items, businessProfile } = data;
  const isInterState = invoice.igst_amount > 0;
  const docTitle =
    invoice.document_type === "tax_invoice"
      ? "TAX INVOICE"
      : invoice.document_type === "quotation"
      ? "QUOTATION / ESTIMATE"
      : invoice.document_type === "proforma"
      ? "PROFORMA INVOICE"
      : invoice.document_type === "credit_note"
      ? "CREDIT NOTE"
      : "INVOICE";

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Hello ${customer?.name || "Customer"},\n\nHere are the details for your ${docTitle} *${invoice.invoice_number}* from *${businessProfile?.company_name || "Auto Audit"}*:\n\nDate: ${dateShort(invoice.invoice_date)}\nAmount: Rs. ${invoice.grand_total.toLocaleString("en-IN")}\nBalance Due: Rs. ${invoice.balance_due.toLocaleString("en-IN")}\n\nThank you for your business!`
    );
    window.open(`https://wa.me/${customer?.phone ? customer.phone.replace(/\D/g, "") : ""}?text=${text}`, "_blank");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Action Header (Hidden in Print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/40 rounded-xl border print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Template:</span>
          <div className="inline-flex rounded-lg border bg-background p-0.5">
            <button
              onClick={() => setCurrentTemplate("classic")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                currentTemplate === "classic" ? "bg-primary text-primary-foreground shadow-xs" : "hover:text-foreground"
              }`}
            >
              Classic
            </button>
            <button
              onClick={() => setCurrentTemplate("modern")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                currentTemplate === "modern" ? "bg-primary text-primary-foreground shadow-xs" : "hover:text-foreground"
              }`}
            >
              Modern
            </button>
            <button
              onClick={() => setCurrentTemplate("compact")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                currentTemplate === "compact" ? "bg-primary text-primary-foreground shadow-xs" : "hover:text-foreground"
              }`}
            >
              Compact
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleWhatsAppShare} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
            <Share2 className="w-4 h-4 mr-1.5" />
            WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            {copied ? <Check className="w-4 h-4 mr-1.5 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1.5" />
            Print / PDF
          </Button>
        </div>
      </div>

      {/* Printable Invoice Document */}
      <div
        id="printable-invoice"
        className={`bg-white text-slate-900 shadow-sm border rounded-xl overflow-hidden print:border-none print:shadow-none print:m-0 print:p-0 ${
          currentTemplate === "compact" ? "p-6 text-xs" : currentTemplate === "modern" ? "p-8 text-sm" : "p-8 text-sm"
        }`}
        style={{ minHeight: "1050px", fontFamily: "'Inter', sans-serif" }}
      >
        {/* Modern Accent Bar */}
        {currentTemplate === "modern" && (
          <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 -mx-8 -mt-8 mb-6" />
        )}

        {/* Invoice Top Header */}
        <div className="flex justify-between items-start border-b pb-6 mb-6">
          <div className="max-w-[60%]">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {businessProfile?.company_name || "Auto Audit Business"}
            </h1>
            <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">
              {[
                businessProfile?.address_line1,
                businessProfile?.city,
                businessProfile?.state,
                businessProfile?.pincode,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 mt-2">
              {businessProfile?.phone && <span>Phone: {businessProfile.phone}</span>}
              {businessProfile?.email && <span>Email: {businessProfile.email}</span>}
              {businessProfile?.gstin && (
                <span className="font-semibold text-slate-900">GSTIN: {businessProfile.gstin}</span>
              )}
              {businessProfile?.pan && <span>PAN: {businessProfile.pan}</span>}
            </div>
          </div>

          <div className="text-right">
            <span
              className={`inline-block px-3 py-1 font-bold rounded text-xs uppercase tracking-wider mb-2 ${
                currentTemplate === "modern"
                  ? "bg-indigo-100 text-indigo-800"
                  : "bg-slate-100 text-slate-800 border"
              }`}
            >
              {docTitle}
            </span>
            <div className="text-xs space-y-1">
              <div>
                <span className="text-slate-500">Invoice No: </span>
                <span className="font-bold text-slate-900">{invoice.invoice_number}</span>
              </div>
              <div>
                <span className="text-slate-500">Date: </span>
                <span className="font-medium text-slate-800">{dateShort(invoice.invoice_date)}</span>
              </div>
              {invoice.due_date && (
                <div>
                  <span className="text-slate-500">Due Date: </span>
                  <span className="font-medium text-slate-800">{dateShort(invoice.due_date)}</span>
                </div>
              )}
              <div>
                <span className="text-slate-500">Place of Supply: </span>
                <span className="font-medium text-slate-800">{invoice.place_of_supply}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To & Ship To */}
        <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg mb-6 border border-slate-100">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Billed To:</h3>
            <p className="font-bold text-slate-900">{customer?.name || "Cash Customer"}</p>
            {customer?.company_name && <p className="text-xs text-slate-700">{customer.company_name}</p>}
            <p className="text-xs text-slate-600 mt-0.5">
              {[customer?.billing_address, customer?.billing_city, customer?.billing_state, customer?.billing_pincode]
                .filter(Boolean)
                .join(", ")}
            </p>
            {customer?.phone && <p className="text-xs text-slate-600 mt-1">Phone: {customer.phone}</p>}
            {customer?.gstin && (
              <p className="text-xs font-semibold text-slate-900 mt-0.5">GSTIN: {customer.gstin}</p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Invoice Status:</h3>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize ${
                  invoice.status === "paid"
                    ? "bg-emerald-100 text-emerald-800"
                    : invoice.status === "partially_paid"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {invoice.status.replace("_", " ")}
              </span>
              {invoice.payment_mode && (
                <span className="text-xs text-slate-600">Mode: {invoice.payment_mode.toUpperCase()}</span>
              )}
            </div>
            {invoice.reference_number && (
              <p className="text-xs text-slate-600">Ref: {invoice.reference_number}</p>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100/70">
                <th className="py-2.5 px-3 w-8">#</th>
                <th className="py-2.5 px-3">Item & Description</th>
                <th className="py-2.5 px-2 text-center w-20">HSN/SAC</th>
                <th className="py-2.5 px-2 text-right w-16">Qty</th>
                <th className="py-2.5 px-2 text-right w-20">Rate</th>
                <th className="py-2.5 px-2 text-right w-20">Discount</th>
                <th className="py-2.5 px-2 text-right w-24">Taxable</th>
                <th className="py-2.5 px-2 text-right w-16">GST</th>
                <th className="py-2.5 px-3 text-right w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {items.map((it, idx) => (
                <tr key={it.id || idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">{it.item_name}</td>
                  <td className="py-2.5 px-2 text-center text-slate-600 font-mono">{it.hsn_code || "-"}</td>
                  <td className="py-2.5 px-2 text-right font-medium text-slate-800">
                    {it.quantity} {it.unit}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-800">
                    {Number(it.unit_price).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                    {Number(it.discount_amount) > 0 ? Number(it.discount_amount).toFixed(2) : "-"}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-medium text-slate-800">
                    {Number(it.taxable_value).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-700">{it.gst_rate}%</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    {Number(it.total_amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculations & Bank Info Section */}
        <div className="grid grid-cols-2 gap-8 border-t pt-4 mb-6">
          {/* Left: Bank details & Words */}
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total in Words:</span>
              <p className="text-xs font-semibold text-slate-900 mt-1 italic bg-slate-50 p-2 rounded border border-slate-100">
                {numberToIndianWords(invoice.grand_total)}
              </p>
            </div>

            {businessProfile?.bank_name && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-1">
                <span className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Bank Details for Transfer:
                </span>
                <p>
                  <span className="text-slate-500">Bank Name:</span>{" "}
                  <span className="font-semibold text-slate-800">{businessProfile.bank_name}</span>
                </p>
                {businessProfile.account_number && (
                  <p>
                    <span className="text-slate-500">A/C No:</span>{" "}
                    <span className="font-mono font-semibold text-slate-900">{businessProfile.account_number}</span>
                  </p>
                )}
                {businessProfile.ifsc_code && (
                  <p>
                    <span className="text-slate-500">IFSC Code:</span>{" "}
                    <span className="font-mono font-semibold text-slate-800">{businessProfile.ifsc_code}</span>
                  </p>
                )}
                {businessProfile.upi_id && (
                  <p>
                    <span className="text-slate-500">UPI ID:</span>{" "}
                    <span className="font-mono font-semibold text-indigo-700">{businessProfile.upi_id}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: Totals summary */}
          <div className="space-y-1.5 text-xs text-right">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-mono font-medium text-slate-900">{currencyIn(invoice.subtotal, "INR")}</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600">
                <span>Discount:</span>
                <span className="font-mono font-medium">- {currencyIn(invoice.discount_amount, "INR")}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Taxable Value:</span>
              <span className="font-mono font-medium text-slate-900">{currencyIn(invoice.taxable_amount, "INR")}</span>
            </div>

            {isInterState ? (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Integrated GST (IGST):</span>
                <span className="font-mono font-medium text-slate-900">{currencyIn(invoice.igst_amount, "INR")}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Central GST (CGST):</span>
                  <span className="font-mono font-medium text-slate-900">{currencyIn(invoice.cgst_amount, "INR")}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">State GST (SGST):</span>
                  <span className="font-mono font-medium text-slate-900">{currencyIn(invoice.sgst_amount, "INR")}</span>
                </div>
              </>
            )}

            {invoice.round_off !== 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-slate-500">
                <span>Round Off:</span>
                <span className="font-mono">{invoice.round_off > 0 ? `+${invoice.round_off}` : invoice.round_off}</span>
              </div>
            )}

            <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-bold text-slate-900">
              <span>Grand Total:</span>
              <span className="font-mono text-base">{currencyIn(invoice.grand_total, "INR")}</span>
            </div>

            <div className="flex justify-between py-1 text-slate-600">
              <span>Amount Paid:</span>
              <span className="font-mono font-medium text-emerald-600">{currencyIn(invoice.amount_paid, "INR")}</span>
            </div>

            <div className="flex justify-between py-1 text-slate-900 font-bold bg-amber-50 px-2 rounded">
              <span>Balance Due:</span>
              <span className="font-mono text-rose-600">{currencyIn(invoice.balance_due, "INR")}</span>
            </div>
          </div>
        </div>

        {/* Footer & Terms */}
        <div className="border-t pt-4 grid grid-cols-2 gap-6 text-xs text-slate-600 mt-8">
          <div>
            <span className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Terms & Conditions:</span>
            <p className="whitespace-pre-line text-slate-500">
              {invoice.terms_and_conditions ||
                businessProfile?.invoice_terms ||
                "1. Goods once sold will not be returned.\n2. Subject to local jurisdiction."}
            </p>
          </div>

          <div className="text-right flex flex-col justify-end items-end">
            <div className="h-16 w-36 border-b border-slate-400 mb-1" />
            <span className="font-bold text-slate-800">
              For {businessProfile?.company_name || "Auto Audit Business"}
            </span>
            <span className="text-slate-500 text-[10px] uppercase">Authorized Signatory</span>
          </div>
        </div>
      </div>
    </div>
  );
}
