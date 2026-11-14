// Server-only: pulls real data from a connected accounting/ERP account and
// stores it against the owning user.
import type { StoredTokens } from "./oauth.server";
import { validTokens } from "./oauth.server";

export interface NormalizedVendor {
  external_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  raw: unknown;
}
export interface NormalizedInvoice {
  external_id: string;
  invoice_number?: string | null;
  vendor_name?: string | null;
  vendor_external_id?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  amount?: number | null;
  tax_amount?: number | null;
  amount_paid?: number | null;
  currency?: string | null;
  status?: string | null;
  type?: string | null;
  raw: unknown;
}
export interface NormalizedPayment {
  external_id: string;
  reference?: string | null;
  invoice_external_id?: string | null;
  vendor_name?: string | null;
  paid_date?: string | null;
  amount?: number | null;
  currency?: string | null;
  method?: string | null;
  status?: string | null;
  type?: string | null;
  raw: unknown;
}
export interface PulledData {
  accountName: string | null;
  vendors: NormalizedVendor[];
  invoices: NormalizedInvoice[];
  payments: NormalizedPayment[];
  tokens: StoredTokens;
}

async function getJson(url: string, headers: Record<string, string>, step?: string) {
  const label = step ? `step "${step}"` : "request";
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  const text = await res.text();
  const endpoint = url.split("?")[0];

  let parsed: Record<string, any> | null = null;
  try {
    parsed = JSON.parse(text) as Record<string, any>;
  } catch {
    parsed = null;
  }

  // Providers frequently return a descriptive body even on 2xx (Zoho uses
  // { code, message }); surface that exact text instead of a generic failure.
  const providerCode = parsed?.["code"];
  const providerMessage =
    parsed?.["message"] ??
    parsed?.["Message"] ??
    parsed?.["error_description"] ??
    (typeof parsed?.["error"] === "string" ? parsed["error"] : undefined);

  const failed = !res.ok || (typeof providerCode === "number" && providerCode !== 0);
  if (failed) {
    const detail = providerMessage ?? text.slice(0, 400) ?? "no response body";
    const codePart = providerCode !== undefined ? ` (code ${providerCode})` : "";
    throw new Error(`${detail}${codePart} — ${label}, GET ${endpoint} → HTTP ${res.status}`);
  }
  if (!parsed)
    throw new Error(`Unreadable response — ${label}, GET ${endpoint} → HTTP ${res.status}`);
  return parsed;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function dateOnly(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  const msMatch = s.match(/\/Date\((\d+)/);
  const d = msMatch ? new Date(Number(msMatch[1])) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/* ------------------------------- Xero ---------------------------------- */
async function pullXero(tokens: StoredTokens): Promise<PulledData> {
  const auth = { Authorization: `Bearer ${tokens.access_token}` };
  let tenantId = tokens.tenant_id;
  let accountName: string | null = null;
  const conns = (await getJson("https://api.xero.com/connections", auth)) as unknown as any[];
  const list = Array.isArray(conns) ? conns : [];
  const chosen = list.find((c) => c.tenantId === tenantId) ?? list[0];
  if (!chosen) throw new Error("No Xero organisation is available for this login");
  tenantId = chosen.tenantId;
  accountName = chosen.tenantName ?? null;
  const h = { ...auth, "Xero-tenant-id": tenantId as string };
  const base = "https://api.xero.com/api.xro/2.0";

  const contacts = (await getJson(`${base}/Contacts?page=1`, h))["Contacts"] ?? [];
  const invoices = (await getJson(`${base}/Invoices?page=1`, h))["Invoices"] ?? [];
  const payments = (await getJson(`${base}/Payments?page=1`, h))["Payments"] ?? [];

  return {
    accountName,
    tokens: { ...tokens, tenant_id: tenantId },
    vendors: contacts.map((c: any) => ({
      external_id: c.ContactID,
      name: c.Name ?? "Unknown",
      email: c.EmailAddress ?? null,
      phone: c.Phones?.[0]?.PhoneNumber ?? null,
      status: c.ContactStatus ?? null,
      raw: c,
    })),
    invoices: invoices.map((i: any) => ({
      external_id: i.InvoiceID,
      invoice_number: i.InvoiceNumber ?? null,
      vendor_name: i.Contact?.Name ?? null,
      vendor_external_id: i.Contact?.ContactID ?? null,
      issue_date: dateOnly(i.DateString ?? i.Date),
      due_date: dateOnly(i.DueDateString ?? i.DueDate),
      amount: num(i.Total),
      tax_amount: num(i.TotalTax),
      amount_paid: num(i.AmountPaid),
      currency: i.CurrencyCode ?? null,
      status: i.Status ?? null,
      type: i.Type === "ACCPAY" ? "bill" : "invoice",
      raw: i,
    })),
    payments: payments.map((p: any) => ({
      external_id: p.PaymentID,
      reference: p.Reference ?? null,
      invoice_external_id: p.Invoice?.InvoiceID ?? null,
      vendor_name: p.Invoice?.Contact?.Name ?? null,
      paid_date: dateOnly(p.Date),
      amount: num(p.Amount),
      currency: p.CurrencyRate ? null : null,
      method: p.PaymentType ?? null,
      status: p.Status ?? null,
      type: "payment",
      raw: p,
    })),
  };
}

/* ---------------------------- QuickBooks -------------------------------- */
async function qboQuery(realmId: string, token: string, query: string) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?minorversion=70&query=${encodeURIComponent(query)}`;
  const json = await getJson(url, { Authorization: `Bearer ${token}` });
  return json["QueryResponse"] ?? {};
}

async function pullQuickBooks(tokens: StoredTokens): Promise<PulledData> {
  const realmId = tokens.realm_id;
  if (!realmId) throw new Error("No QuickBooks company id stored — reconnect the account");
  const t = tokens.access_token;
  const info = await getJson(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}?minorversion=70`,
    { Authorization: `Bearer ${t}` },
  );
  const vendors =
    (await qboQuery(realmId, t, "select * from Vendor maxresults 200"))["Vendor"] ?? [];
  const bills = (await qboQuery(realmId, t, "select * from Bill maxresults 200"))["Bill"] ?? [];
  const payments =
    (await qboQuery(realmId, t, "select * from BillPayment maxresults 200"))["BillPayment"] ?? [];

  return {
    accountName: info["CompanyInfo"]?.CompanyName ?? "QuickBooks company",
    tokens,
    vendors: vendors.map((v: any) => ({
      external_id: String(v.Id),
      name: v.DisplayName ?? "Unknown",
      email: v.PrimaryEmailAddr?.Address ?? null,
      phone: v.PrimaryPhone?.FreeFormNumber ?? null,
      status: v.Active ? "ACTIVE" : "INACTIVE",
      raw: v,
    })),
    invoices: bills.map((b: any) => ({
      external_id: String(b.Id),
      invoice_number: b.DocNumber ?? null,
      vendor_name: b.VendorRef?.name ?? null,
      vendor_external_id: b.VendorRef?.value ?? null,
      issue_date: dateOnly(b.TxnDate),
      due_date: dateOnly(b.DueDate),
      amount: num(b.TotalAmt),
      tax_amount: num(b.TxnTaxDetail?.TotalTax),
      amount_paid:
        num(b.TotalAmt) !== null && num(b.Balance) !== null
          ? num(b.TotalAmt)! - num(b.Balance)!
          : null,
      currency: b.CurrencyRef?.value ?? null,
      status: num(b.Balance) === 0 ? "PAID" : "OPEN",
      type: "bill",
      raw: b,
    })),
    payments: payments.map((p: any) => ({
      external_id: String(p.Id),
      reference: p.DocNumber ?? null,
      invoice_external_id: p.Line?.[0]?.LinkedTxn?.[0]?.TxnId ?? null,
      vendor_name: p.VendorRef?.name ?? null,
      paid_date: dateOnly(p.TxnDate),
      amount: num(p.TotalAmt),
      currency: p.CurrencyRef?.value ?? null,
      method: p.PayType ?? null,
      status: null,
      type: "payment",
      raw: p,
    })),
  };
}

/* ----------------------------- Zoho Books ------------------------------- */
async function pullZohoBooks(tokens: StoredTokens): Promise<PulledData> {
  const h = { Authorization: `Zoho-oauthtoken ${tokens.access_token}` };

  // Candidate Zoho API domains. If one DC returns Code 57 / 401 Unauthorized,
  // we automatically probe the other regional DCs to find where the user's
  // organization is actually hosted.
  const candidateDomains = Array.from(
    new Set(
      [
        tokens.api_domain,
        "https://www.zohoapis.in",
        "https://www.zohoapis.com",
        "https://www.zohoapis.eu",
        "https://www.zohoapis.com.au",
        "https://www.zohoapis.ca",
        "https://www.zohoapis.jp",
      ].filter(Boolean) as string[],
    ),
  );

  let workingDomain = tokens.api_domain ?? "https://www.zohoapis.com";
  let orgs: any[] = [];
  let lastAuthError: string | null = null;

  for (const candidate of candidateDomains) {
    try {
      const res = await getJson(`${candidate}/books/v3/organizations`, h, "organizations");
      if (res && Array.isArray(res["organizations"])) {
        orgs = res["organizations"];
        workingDomain = candidate;
        lastAuthError = null;
        break;
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("code 57") ||
        msg.includes("401") ||
        msg.includes("Unauthorized") ||
        msg.includes("not authorized")
      ) {
        lastAuthError = msg;
        continue;
      }
      throw new Error(`Zoho Books: ${msg}`);
    }
  }

  if (lastAuthError && orgs.length === 0) {
    throw new Error(
      `Zoho Books authorization error (code 57): The connected Zoho account is not authorized or has no active organization in Zoho Books.\n` +
        `• Make sure you have logged into Zoho Books (https://books.zoho.com or https://books.zoho.in) and created an organization.\n` +
        `• Verify that your account has Admin permissions in that organization.`,
    );
  }

  const zoho = async (path: string, step: string) => {
    try {
      return await getJson(`${workingDomain}/books/v3/${path}`, h, step);
    } catch (err) {
      throw new Error(`Zoho Books: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const org = orgs.find((o: any) => o.organization_id === tokens.organization_id) ?? orgs[0];
  if (!org)
    throw new Error(
      `Zoho Books: no organisation is available for this login — step "organizations", GET ${workingDomain}/books/v3/organizations`,
    );
  const orgId = org.organization_id;

  // Zoho paginates at 200 rows; walk every page so nothing is silently dropped.
  const zohoAll = async (resource: string, key: string, step: string) => {
    const out: any[] = [];
    for (let page = 1; page <= 20; page++) {
      const json = await zoho(
        `${resource}?organization_id=${orgId}&per_page=200&page=${page}`,
        step,
      );
      const rows = json[key] ?? [];
      out.push(...rows);
      const more = json["page_context"]?.has_more_page;
      if (!more || rows.length === 0) break;
    }
    return out;
  };

  const contacts = await zohoAll("contacts", "contacts", "contacts");
  const bills = await zohoAll("bills", "bills", "bills");
  // Customer invoices are a separate resource from vendor bills — pull both.
  const salesInvoices = await zohoAll("invoices", "invoices", "invoices");
  const vendorPayments = await zohoAll("vendorpayments", "vendorpayments", "vendorpayments");
  const customerPayments = await zohoAll(
    "customerpayments",
    "customerpayments",
    "customerpayments",
  );

  const defaultCurrency = org.currency_code || "INR";

  return {
    accountName: org.name ?? "Zoho Books organisation",
    tokens: { ...tokens, organization_id: orgId, api_domain: workingDomain },
    vendors: contacts.map((c: any) => ({
      external_id: String(c.contact_id),
      name: c.contact_name ?? "Unknown",
      email: c.email ?? null,
      phone: c.phone ?? null,
      status: c.status ?? null,
      raw: c,
    })),
    invoices: [
      ...bills.map((b: any) => ({
        external_id: `bill:${b.bill_id}`,
        invoice_number: b.bill_number ?? null,
        vendor_name: b.vendor_name ?? null,
        vendor_external_id: b.vendor_id ? String(b.vendor_id) : null,
        issue_date: dateOnly(b.date),
        due_date: dateOnly(b.due_date),
        amount: num(b.total),
        tax_amount: num(b.tax_total),
        amount_paid: num(b.payment_made),
        currency: b.currency_code ?? defaultCurrency,
        status: b.status ?? "OPEN",
        type: "bill",
        raw: b,
      })),
      ...salesInvoices.map((i: any) => ({
        external_id: `invoice:${i.invoice_id}`,
        invoice_number: i.invoice_number ?? null,
        vendor_name: i.customer_name ?? null,
        vendor_external_id: i.customer_id ? String(i.customer_id) : null,
        issue_date: dateOnly(i.date),
        due_date: dateOnly(i.due_date),
        amount: num(i.total),
        tax_amount: num(i.tax_total),
        amount_paid:
          num(i.total) !== null && num(i.balance) !== null ? num(i.total)! - num(i.balance)! : null,
        currency: i.currency_code ?? defaultCurrency,
        status: i.status ?? "OPEN",
        type: "invoice",
        raw: i,
      })),
    ],
    payments: [
      ...vendorPayments.map((p: any) => ({
        external_id: `vendorpayment:${p.payment_id}`,
        reference: p.reference_number ?? null,
        invoice_external_id: p.bills?.[0]?.bill_id ? `bill:${p.bills[0].bill_id}` : null,
        vendor_name: p.vendor_name ?? null,
        paid_date: dateOnly(p.date),
        amount: num(p.amount),
        currency: p.currency_code ?? defaultCurrency,
        method: p.payment_mode ?? null,
        status: "PAID",
        type: "vendor_payment",
        raw: p,
      })),
      ...customerPayments.map((p: any) => ({
        external_id: `customerpayment:${p.payment_id}`,
        reference: p.reference_number ?? null,
        invoice_external_id: p.invoices?.[0]?.invoice_id
          ? `invoice:${p.invoices[0].invoice_id}`
          : null,
        vendor_name: p.customer_name ?? null,
        paid_date: dateOnly(p.date),
        amount: num(p.amount),
        currency: p.currency_code ?? defaultCurrency,
        method: p.payment_mode ?? null,
        status: "PAID",
        type: "customer_payment",
        raw: p,
      })),
    ],
  };
}

export async function pullProviderData(provider: string, tokens: StoredTokens) {
  const { tokens: fresh, refreshed } = await validTokens(provider, tokens);
  let data: PulledData;
  switch (provider) {
    case "xero":
      data = await pullXero(fresh);
      break;
    case "quickbooks":
      data = await pullQuickBooks(fresh);
      break;
    case "zoho_books":
      data = await pullZohoBooks(fresh);
      break;
    default:
      throw new Error(`${provider} cannot be synced automatically yet`);
  }
  return { data, refreshed };
}
