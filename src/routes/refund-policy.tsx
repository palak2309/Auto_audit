import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/legal-layout";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — AutoAudit" },
      {
        name: "description",
        content:
          "Subscription cancellation, trial, and refund terms for AutoAudit enterprise platform.",
      },
    ],
  }),
  component: RefundPolicyPage,
});

function RefundPolicyPage() {
  return (
    <LegalLayout title="Subscription & Refund Policy" lastUpdated="September 28, 2026">
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">1. Overview</h2>
        <p>
          AutoAudit Technologies Private Limited (“AutoAudit”, “we”) provides enterprise SaaS
          software for financial controls, disbursement audits, and leakage detection. This
          Subscription & Refund Policy governs all billing cycles, plan upgrades, downgrades,
          cancellations, and refund evaluations.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          2. 14-Day Free Trial & Evaluation Period
        </h2>
        <p>We encourage prospective enterprise customers to evaluate AutoAudit risk-free:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            New workspaces are eligible for a <strong>14-day full-feature trial</strong> to test
            accounting connectors, run duplicate disbursement scans, and verify ROI before any paid
            subscription commences.
          </li>
          <li>
            No long-term commitment or automated charge occurs during the active trial period unless
            explicitly authorized by the Customer.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">3. Cancellation Terms</h2>
        <p>
          You may cancel your AutoAudit subscription at any time directly through your workspace
          settings or by submitting a written notice to{" "}
          <a href="mailto:billing@autoaudit.app" className="text-primary underline">
            billing@autoaudit.app
          </a>
          :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Monthly Subscriptions:</strong> Cancellation takes effect at the end of the
            current monthly billing period. You retain uninterrupted access to your audit registers
            until that date.
          </li>
          <li>
            <strong>Annual Subscriptions:</strong> Cancellation prevents auto-renewal for the
            subsequent annual term. Access remains active through the contracted prepaid annual
            term.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          4. Refund Eligibility & Service Guarantees
        </h2>
        <p>
          Because AutoAudit provides immediate computational access to automated forensic algorithms
          upon ingestion:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Standard Policy:</strong> Paid subscription fees are non-refundable once a
            billing cycle begins, except as required by law or as expressly set out below.
          </li>
          <li>
            <strong>Technical Failure / SLA Inability:</strong> If the platform experiences verified
            persistent technical downtime exceeding our 99.9% uptime SLA, or is unable to
            synchronize due to platform-side defects unrectified within 14 business days of formal
            notice, customers are entitled to a pro-rata refund for the unexpired portion of the
            paid period.
          </li>
          <li>
            <strong>Billing Discrepancies:</strong> Duplicate charges or incorrect billing tier
            calculations reported within 30 days of the invoice date will be refunded in full to the
            original payment method within 5–7 business days.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">5. How to Request a Refund</h2>
        <p>To submit a billing inquiry or refund request:</p>
        <div className="p-4 rounded-xl border border-border bg-card/60 text-xs text-foreground space-y-1">
          <p>
            <strong>Email:</strong>{" "}
            <a href="mailto:billing@autoaudit.app" className="text-primary underline">
              billing@autoaudit.app
            </a>
          </p>
          <p>
            <strong>Subject Line:</strong> Refund Request — [Workspace Name] — [Invoice Number]
          </p>
          <p>
            <strong>Required Info:</strong> Registered email address, invoice date, and reason for
            the refund request.
          </p>
        </div>
      </section>
    </LegalLayout>
  );
}
