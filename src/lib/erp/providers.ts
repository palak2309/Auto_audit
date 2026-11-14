// Client-safe provider registry. No secrets here.

export type ErpProviderId =
  "xero" | "quickbooks" | "zoho_books" | "netsuite" | "sap" | "oracle" | "custom_api";

export interface ErpProviderMeta {
  id: ErpProviderId;
  name: string;
  category: "Accounting" | "ERP";
  blurb: string;
  /** OAuth providers can be connected by the user directly from the app. */
  oauth: boolean;
  docsUrl: string;
}

export const ERP_PROVIDERS: ErpProviderMeta[] = [
  {
    id: "xero",
    name: "Xero",
    category: "Accounting",
    blurb: "Bills, invoices, payments and contacts from your Xero organisation.",
    oauth: true,
    docsUrl: "https://developer.xero.com/app/manage",
  },
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    category: "Accounting",
    blurb: "Bills, invoices, vendors and payments from your QuickBooks company.",
    oauth: true,
    docsUrl: "https://developer.intuit.com/app/developer/dashboard",
  },
  {
    id: "zoho_books",
    name: "Zoho Books",
    category: "Accounting",
    blurb: "Invoices, bills, payments and contacts from your Zoho Books organisation.",
    oauth: true,
    docsUrl: "https://api-console.zoho.com/",
  },
  {
    id: "custom_api",
    name: "Custom ERP & Accounting API",
    category: "ERP",
    blurb: "Directly push bills, invoices and payment ledgers via REST API or webhook.",
    oauth: false,
    docsUrl: "#custom-api",
  },
  {
    id: "netsuite",
    name: "Oracle NetSuite",
    category: "ERP",
    blurb: "Requires a tenant-specific integration record from your NetSuite admin.",
    oauth: false,
    docsUrl: "https://docs.oracle.com/en/cloud/saas/netsuite/",
  },
  {
    id: "sap",
    name: "SAP S/4HANA",
    category: "ERP",
    blurb: "Requires an SAP BTP destination configured by your Basis team.",
    oauth: false,
    docsUrl: "https://api.sap.com/",
  },
  {
    id: "oracle",
    name: "Oracle Fusion",
    category: "ERP",
    blurb: "Requires Oracle Fusion REST credentials issued by your administrator.",
    oauth: false,
    docsUrl: "https://docs.oracle.com/en/cloud/saas/",
  },
];

export function providerMeta(id: string): ErpProviderMeta | undefined {
  return ERP_PROVIDERS.find((p) => p.id === id);
}

export interface ErpConnectionView {
  id: string;
  provider: ErpProviderId;
  accountName: string | null;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
}
