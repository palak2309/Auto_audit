# AutoAudit — Antigravity Context & Architecture Working Memory

> **Status:** Audited & Cleaned  
> **Source of Truth:** Workspace Source Code  
> **Last Updated:** 2026-11-02

---

## 1. Project Purpose

**AutoAudit** is an AI-powered Financial Leakage Detection and Spend Analytics platform. It ingests accounting and ERP data (bills, invoices, payments, vendor master data) via OAuth or direct sync, runs deterministic rule engines (duplicate invoice, duplicate payment, overpayment, overdue liabilities), and layers authenticated AI reasoning (Google Gemini, Google Vertex AI, OpenAI, or local heuristics) to identify financial leakage, control breakages, and recovery opportunities.

---

## 2. Tech Stack & Architecture

- **Framework:** TanStack Start (`@tanstack/react-start` v1.168.32) with React 19 (`react` v19.2.0)
- **Routing:** TanStack Router (`@tanstack/react-router` v1.170.18) with code-based route tree generation (`src/routeTree.gen.ts`)
- **State & Server Cache:** TanStack Query (`@tanstack/react-query` v5.101.1) + Server Functions (`createServerFn`)
- **Build & Server Engine:** Vite v8.2 + Nitro v3.0 with standard TanStack Start Vite plugin
- **Styling & UI:** TailwindCSS v4 (`@tailwindcss/vite` + `tailwindcss` v4.2.1), Radix UI primitives, Lucide React (`lucide-react` v0.575.0), Recharts (`recharts` v2.15.4), Motion (`motion` v13.0.0), Sonner toast (`sonner` v2.0.7)
- **Validation:** Zod v3.24.2
- **Backend / Database:** Supabase (`@supabase/supabase-js` v2.117.1) with PostgreSQL, Row Level Security (RLS), and database triggers
- **AI Analytics:** Vercel AI SDK (`ai` v7.0.107, `@ai-sdk/google`, `@ai-sdk/google-vertex`, `@ai-sdk/openai`) with fallback to local forensic analysis

---

## 3. Directory Structure

```
├── public/                        # Static assets (favicons, robots.txt, etc.)
├── src/
│   ├── components/
│   │   ├── common/                # Shared UI: DataTable, PageHeader, StatCard, ToneBadge, PermissionGate, NoData
│   │   ├── dashboard/             # Charts (SavingsTrend, LeakBreakdown, RiskRadar, AnomalyBar)
│   │   ├── erp/                   # ConnectWizard, ImportDashboard, ProviderConfigDialog, SyncTimeline
│   │   ├── layout/                # AppShell, AppSidebar, Topbar, AuthLayout
│   │   ├── leaks/                 # LeakActionDrawer (Status transition, assignment, audit notes)
│   │   ├── legal/                 # Cookie consent, legal layout
│   │   └── ui/                    # shadcn / Radix UI component library
│   ├── constants/
│   │   └── navigation.ts          # Nav links, RBAC role metadata & descriptions
│   ├── data/
│   │   └── mock.ts                # Static fallback demo data
│   ├── hooks/
│   │   ├── use-erp.ts             # React Query hooks wrapping ERP server functions
│   │   ├── use-mobile.tsx         # Media query hook for mobile navigation
│   │   └── use-notifications.ts   # Notification stream hook
│   ├── integrations/
│   │   └── supabase/              # client.ts (browser), client.server.ts (service-role admin),
│   │                              # auth-middleware.ts, types.ts (database schema)
│   ├── lib/
│   │   ├── account.functions.ts   # Server function: getAccountStatus, updateMyProfile
│   │   ├── admin.functions.ts     # RBAC server functions (getMyAccess, listMembers, setMemberRole, etc.)
│   │   ├── erp.functions.ts       # ERP API gateway functions (connect, sync, status, financials, ai)
│   │   ├── leak.functions.ts      # Leakage triage & durable recovery workflow mutations
│   │   ├── notifications.functions.ts # Live notification query server function
│   │   ├── csv.ts                 # Client CSV export helper
│   │   ├── format.ts              # Currency, date, percentage formatting utilities
│   │   └── erp/
│   │       ├── activity.server.ts # Sync runs & connection metrics query engine
│   │       ├── ai-analysis.server.ts # AI leakage analysis engine via streamText + Zod schema
│   │       ├── crypto.server.ts   # AES-256-GCM token encryption/decryption
│   │       ├── data.server.ts     # Ingested ERP data reader & rule-based leak detection algorithms
│   │       ├── fingerprint.server.ts # Deterministic SHA-256 leak case deduplication
│   │       ├── leak-persistence.server.ts # Durable erp_leaks idempotent persistence
│   │       ├── leak-workflow.server.ts # Recovery case progression & atomic audit trails
│   │       ├── oauth.server.ts    # OAuth flows, token exchange, refresh routines
│   │       ├── providers.ts       # Supported ERP provider metadata catalog
│   │       ├── service.server.ts  # ERP orchestration (begin/complete OAuth, sync, disconnect)
│   │       └── sync.server.ts     # Real API sync fetchers (Xero, QuickBooks, Zoho Books)
│   ├── providers/
│   │   ├── mock-auth-provider.tsx # Auth context bridging Supabase Auth + getMyAccess
│   │   └── theme-provider.tsx    # Light/Dark mode state management
│   ├── routes/                    # TanStack file-based routes
│   │   ├── __root.tsx             # Root HTML shell, styles, ThemeProvider, MockAuthProvider
│   │   ├── _shell.tsx             # Protected layout gate: checks session & active status
│   │   ├── _shell/
│   │   │   ├── index.tsx          # Real Dashboard (ERP aggregates, leak charts, top vendors)
│   │   │   ├── ai-insights.tsx    # AI Leakage scan trigger + synthesized findings
│   │   │   ├── analytics.tsx      # Spend & exposure analytics charts
│   │   │   ├── contracts.tsx      # Placeholder empty state
│   │   │   ├── integrations.tsx   # Live ERP connection & sync management center
│   │   │   ├── invoices.tsx       # Live imported bills and invoices data table
│   │   │   ├── leaks.tsx          # Live rule-detected leakage register with evidence drawer
│   │   │   ├── notifications.tsx  # Real-time alert feed
│   │   │   ├── payments.tsx       # Live imported payment disbursements data table
│   │   │   ├── profile.tsx        # Profile details & update form
│   │   │   ├── recovery.tsx       # Recovery Center & Kanban claim progression
│   │   │   ├── reports.tsx        # Dynamic report builder with live CSV export
│   │   │   ├── roles.tsx          # Live RBAC permission matrix editor
│   │   │   ├── security.tsx       # Security overview & global session revocation
│   │   │   ├── settings.tsx       # Workspace settings & appearance
│   │   │   ├── transactions.tsx   # Unified ledger (invoices + bills + payments)
│   │   │   ├── users.tsx          # Live workspace member management (invite, role, suspend, remove)
│   │   │   └── vendors.tsx        # Live vendor rollups (spend, invoices, leak counts)
│   │   ├── api/
│   │   │   └── public/erp/
│   │   │       ├── callback.ts    # Public OAuth redirect receiver GET handler
│   │   │       └── ingest.ts      # Public REST API for ledger and bill ingestion
│   │   ├── forgot-password.tsx    # Supabase password reset request
│   │   ├── login.tsx              # Password sign-in with email validation & redirection
│   │   ├── mfa.tsx                # Simulated MFA screen
│   │   ├── register.tsx           # Supabase sign-up with organization setup
│   │   └── verify-email.tsx       # Email OTP / magic link verification
│   ├── router.tsx                 # Router instance constructor
│   ├── routeTree.gen.ts           # Auto-generated routing manifest
│   ├── server.ts                  # Nitro SSR entry point & error handler
│   ├── start.ts                   # TanStack Start configuration (attachSupabaseAuth, CSRF)
│   └── styles.css                 # Design system, CSS variables, Tailwind configuration
└── supabase/
    ├── config.toml                # Local Supabase CLI configuration
    └── setup_new_database.sql     # Safe idempotent database bootstrap script
```

---

## 4. ERP Integrations

| Provider              | Category         | Auth Method    | Fetcher Implementation                 |        Status        | Notes                                                           |
| :-------------------- | :--------------- | :------------- | :------------------------------------- | :------------------: | :-------------------------------------------------------------- |
| **Xero**              | Accounting       | OAuth 2.0      | `pullXero()` in `sync.server.ts`       | **Fully Functional** | Live API calls to `/Contacts`, `/Invoices`, `/Payments`         |
| **QuickBooks Online** | Accounting       | OAuth 2.0      | `pullQuickBooks()` in `sync.server.ts` | **Fully Functional** | Live QBO queries on `Vendor`, `Bill`, `BillPayment`             |
| **Zoho Books**        | Accounting       | OAuth 2.0      | `pullZohoBooks()` in `sync.server.ts`  | **Fully Functional** | Traversal for `contacts`, `bills`, `invoices`, `vendorpayments` |
| **Custom REST API**   | ERP / Accounting | REST API       | `/api/public/erp/ingest`               | **Fully Functional** | Direct HTTP POST for external ledger ingestion                  |
| **NetSuite**          | ERP              | Manual / Token | `sync.server.ts`                       |   **Placeholder**    | Enterprise onboarding required                                  |
| **SAP S/4HANA**       | ERP              | BTP / Dest     | `sync.server.ts`                       |   **Placeholder**    | Enterprise onboarding required                                  |
| **Oracle Fusion**     | ERP              | REST API       | `sync.server.ts`                       |   **Placeholder**    | Enterprise onboarding required                                  |

---

## 5. Build & Verification Commands

- **Install:** `npm install`
- **Build:** `npm run build` (runs `vite build`, builds client bundle + Nitro worker)
- **Typecheck:** `npx tsc --noEmit` (passes with 0 errors)
- **Preview:** `npm run preview`
