import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/legal-layout";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — AutoAudit" },
      {
        name: "description",
        content:
          "Privacy Policy for AutoAudit compliant with India DPDP Act 2023, IT Act 2000, and global data protection standards.",
      },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="September 28, 2026">
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">1. Introduction & Regulatory Scope</h2>
        <p>
          AutoAudit Technologies Private Limited (“AutoAudit”, “we”, “our”, or “us”) respects your
          privacy and is committed to protecting your corporate financial metadata and personal
          data. This Privacy Policy details our data collection, processing, retention, and transfer
          practices in strict accordance with the{" "}
          <strong>Digital Personal Data Protection (DPDP) Act, 2023 (India)</strong>, the{" "}
          <strong>Information Technology Act, 2000</strong>, the{" "}
          <strong>
            Information Technology (Reasonable Security Practices and Procedures and Sensitive
            Personal Data or Information) Rules, 2011
          </strong>
          , and internationally recognized privacy principles (including the EU GDPR and CCPA/CPRA).
        </p>
        <p>
          AutoAudit operates as a business-to-business (B2B) enterprise financial control and audit
          SaaS platform. In relation to enterprise ERP ledgers synchronized by corporate customers,
          AutoAudit acts primarily as a <strong>Data Processor</strong> (Data Fiduciary’s
          Processor). In relation to account holders, workspace users, and administrative contacts,
          AutoAudit acts as a <strong>Data Fiduciary</strong>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          2. Principles of Data Minimisation (Only Necessary Data Collected)
        </h2>
        <p>
          We adhere to strict data minimisation principles under Section 6 of the DPDP Act. We do
          not collect extraneous personal information, biometric identifiers, or consumer browsing
          profiles. The information collected is strictly limited to:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Identity & Account Data:</strong> Name, business email address,
            company/organisation name, workspace role, and encrypted password hash (managed via
            secure authentication protocols).
          </li>
          <li>
            <strong>Financial & Operational Metadata:</strong> Invoices, payment records, purchase
            order numbers, vendor names, tax IDs (e.g., GSTIN/PAN), transaction amounts, currencies,
            and invoice timestamps necessary solely to audit financial leakage, duplicate payments,
            and billing errors.
          </li>
          <li>
            <strong>Technical & Security Telemetry:</strong> IP address, device user-agent string,
            session tokens, audit trail event logs, and timestamps strictly for intrusion
            prevention, fraud mitigation, and SOC compliance.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          3. Purpose of Processing & Legal Grounds
        </h2>
        <p>
          We process your data strictly under lawful grounds including express consent, contractual
          performance, and legitimate regulatory compliance:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            To identify billing anomalies, overpayments, duplicate disbursements, and contract
            non-compliance across synchronized ERP records.
          </li>
          <li>
            To generate evidence-based audit reports, recovery claim notices, and vendor dispute
            documentation.
          </li>
          <li>
            To provide AI-assisted pattern analysis via server-side isolated models where corporate
            credentials and raw financial data remain unexposed to public models.
          </li>
          <li>
            To maintain immutable audit logs for corporate governance, statutory financial audits,
            and platform access control.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          4. Artificial Intelligence & Third-Party LLM Policy
        </h2>
        <p>
          AutoAudit utilizes AI algorithms (including Google Vertex AI / Google Gemini and OpenAI
          enterprise endpoints) for structured financial pattern explanation. We enforce strict
          contractual zero-data-retention and zero-model-training guarantees:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>No Model Training:</strong> Your financial records, vendor terms, and
            transaction amounts are never used to train, retrain, or improve foundational commercial
            LLM models.
          </li>
          <li>
            <strong>Server-Side Execution:</strong> All AI processing occurs within secured backend
            execution containers with enterprise cryptographic controls; no unauthenticated
            client-side leakage occurs.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          5. Zero Third-Party Advertising & Tracking
        </h2>
        <p>We take a zero-surveillance stance:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            We <strong>do not sell, rent, monetize, or trade</strong> your personal or financial
            data under any circumstance.
          </li>
          <li>
            We <strong>do not employ third-party advertising cookies, pixels, or trackers</strong>{" "}
            (such as Facebook Pixel, Google AdSense, or data broker beacons).
          </li>
          <li>
            All product analytics are telemetry-based and operational, focused entirely on platform
            security, latency, and uptime.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          6. Data Principal Rights under India DPDP Act, 2023
        </h2>
        <p>
          As a Data Principal under Indian law and equivalent privacy statutes, you possess
          actionable rights:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Right to Access Information:</strong> Request a summary of personal data
            processed by us and the identities of any data processors involved.
          </li>
          <li>
            <strong>Right to Correction & Erasure:</strong> Request the correction of misleading or
            outdated data, or the deletion of data no longer required for statutory or contractual
            purposes.
          </li>
          <li>
            <strong>Right of Grievance Redressal:</strong> Submit a complaint directly to our
            designated Grievance Officer, with response guaranteed within 30 days.
          </li>
          <li>
            <strong>Right to Nominate:</strong> Nominate another individual to exercise your rights
            in the event of death or incapacity.
          </li>
          <li>
            <strong>Right to Withdraw Consent:</strong> You may revoke consent at any time via your
            workspace settings or by writing to privacy@autoaudit.app.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          7. Data Storage, Security & International Transfers
        </h2>
        <p>
          All production databases are encrypted at rest using AES-256 and in transit using TLS 1.3.
          Where data is transferred cross-border for processing with cloud infrastructure providers,
          transfers occur strictly in compliance with Section 16 of the DPDP Act and approved
          standard contractual clauses.
        </p>
      </section>
    </LegalLayout>
  );
}
