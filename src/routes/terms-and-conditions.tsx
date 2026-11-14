import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/legal-layout";

export const Route = createFileRoute("/terms-and-conditions")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions — AutoAudit" },
      {
        name: "description",
        content:
          "Terms of Service and Conditions governing the use of AutoAudit enterprise SaaS platform.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout title="Terms and Conditions of Service" lastUpdated="September 28, 2026">
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">1. Agreement to Terms</h2>
        <p>
          These Terms and Conditions of Service (“Terms”) constitute a legally binding agreement
          between AutoAudit Technologies Private Limited (“Company”, “AutoAudit”, “we”, “us”) and
          the corporate customer or individual subscriber (“Customer”, “you”, “User”) accessing or
          using the AutoAudit software platform, API endpoints, and associated services
          (collectively, the “Service”).
        </p>
        <p>
          By creating an account, registering an organisation workspace, connecting an ERP
          integration, or submitting data to our APIs, you acknowledge that you have read,
          understood, and agreed to be bound by these Terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          2. Description of Service & Disclaimers
        </h2>
        <p>
          AutoAudit provides an automated financial controls, audit trail, and disbursement
          risk-detection SaaS platform designed to assist corporate finance teams in identifying
          potential duplicate invoices, overpayments, billing discrepancies, and vendor-related
          leakage.
        </p>
        <div className="p-4 rounded-xl border border-warning/30 bg-warning/5 text-xs text-foreground space-y-2">
          <p className="font-semibold text-warning flex items-center gap-1.5">
            <span>IMPORTANT LEGAL & FINANCIAL DISCLAIMER:</span>
          </p>
          <p>
            AutoAudit is a computational data analytics and workflow tool. AutoAudit is{" "}
            <strong>
              not a chartered accountancy firm, law firm, registered tax practitioner, or statutory
              auditor
            </strong>
            . The platform’s automated findings, leakage classifications, and AI-generated claim
            notices are advisory intelligence intended to aid human finance professionals in their
            internal review.
          </p>
          <p>
            Customers retain sole responsibility for evaluating findings, authorizing credit note
            requests, verifying vendor agreements, and ensuring tax filings comply with applicable
            laws (including GST, TDS, and corporate tax regulations).
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">3. Customer Accounts & Authority</h2>
        <p>You represent and warrant that:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            You possess the corporate legal authority to enter into this agreement on behalf of your
            organisation.
          </li>
          <li>
            All account registration information submitted (including company name, GSTIN/tax
            identifier, and corporate email) is true, accurate, and current.
          </li>
          <li>
            You are authorized to connect and synchronize the specified ERP accounts (e.g., Zoho
            Books, QuickBooks, Xero, or Custom ERP API).
          </li>
          <li>
            You will safeguard workspace administrative credentials and notify us immediately of any
            unauthorized access or breach.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">4. Acceptable Use Policy</h2>
        <p>You agree not to misuse the Service. Specifically, you shall not:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Submit unlawful, fraudulent, defamatory, or infringing content.</li>
          <li>
            Reverse engineer, decompile, or disassemble any component of the Service or its
            detection algorithms.
          </li>
          <li>
            Attempt to breach or probe vulnerabilities in AutoAudit’s network infrastructure,
            authentication mechanisms, or database tiers.
          </li>
          <li>
            Resell, sublicense, or operate the Service as a managed bureau service without express
            prior written consent.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">5. Intellectual Property Rights</h2>
        <p>
          <strong>Our IP:</strong> The platform, proprietary algorithms, deterministic detection
          heuristics, software architectures, UI designs, codebases, and trademarks are and remain
          the exclusive property of AutoAudit Technologies Private Limited and its licensors.
        </p>
        <p>
          <strong>Your Data:</strong> You retain all ownership rights in the corporate financial
          datasets, invoices, payments, and vendor records you upload or synchronize. You grant
          AutoAudit a limited, revocable license strictly to host, parse, and analyze said data to
          deliver the contracted services.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">6. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by applicable Indian law (including the Indian Contract
          Act, 1872):
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            AutoAudit shall not be liable for indirect, incidental, special, consequential, or
            punitive damages, including loss of profits, goodwill, anticipated savings, or business
            interruption.
          </li>
          <li>
            AutoAudit is not responsible for any vendor disputes, tax penalties, or third-party
            claims arising from recovery claim letters, clawbacks, or withholding actions initiated
            by the Customer.
          </li>
          <li>
            Our total cumulative liability arising out of or related to these Terms shall not exceed
            the total fees actually paid by Customer to AutoAudit in the twelve (12) months
            preceding the incident giving rise to liability.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">7. Governing Law & Dispute Resolution</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of the Republic
          of India. Any dispute, controversy, or claim arising out of or relating to these Terms
          shall be subject to the exclusive jurisdiction of the competent courts located in{" "}
          <strong>Mumbai, Maharashtra, India</strong>.
        </p>
      </section>
    </LegalLayout>
  );
}
