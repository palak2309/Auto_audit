import { Link } from "@tanstack/react-router";
import { ShieldCheck, Mail, Building2, MapPin, Phone } from "lucide-react";

export function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-bold text-foreground hover:opacity-90"
          >
            <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <ShieldCheck className="size-5" />
            </div>
            <span>AutoAudit</span>
          </Link>
          <div className="flex items-center gap-4 text-xs font-medium">
            <Link to="/privacy-policy" className="text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link
              to="/terms-and-conditions"
              className="text-muted-foreground hover:text-foreground"
            >
              Terms
            </Link>
            <Link to="/cookie-policy" className="text-muted-foreground hover:text-foreground">
              Cookies
            </Link>
            <Link to="/refund-policy" className="text-muted-foreground hover:text-foreground">
              Refunds
            </Link>
            <Link to="/login" className="text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-10 w-full space-y-8">
        <div className="border-b border-border pb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
            <span>Legal Notice & Compliance</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Effective Date: {lastUpdated} | Applicable Jurisdictions: India (DPDP Act 2023, IT Act
            2000), Global GDPR & CCPA/CPRA Principles
          </p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground space-y-6 leading-relaxed">
          {children}
        </div>

        {/* Business and Grievance Officer details */}
        <section
          aria-label="Business Entity & Grievance Redressal"
          className="mt-12 p-6 rounded-2xl border border-border bg-card/80 space-y-4 text-xs text-muted-foreground"
        >
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <Building2 className="size-4 text-primary" />
            <span>Registered Business & Grievance Redressal Officer</span>
          </div>
          <p className="leading-relaxed">
            In compliance with the{" "}
            <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong> and the{" "}
            <strong>
              Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules
            </strong>
            , inquiries, data principal access requests, consent revocations, and grievances may be
            directed to:
          </p>
          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            <div>
              <p className="font-semibold text-foreground">Entity Name & Registration:</p>
              <p>AutoAudit Technologies Private Limited</p>
              <p className="text-[11px]">
                Corporate Identification Number (CIN): U72900MH2024PTC419820
              </p>
              <p className="mt-1 flex items-center gap-1.5">
                <MapPin className="size-3 text-muted-foreground" /> Bandra Kurla Complex (BKC),
                Mumbai, Maharashtra 400051, India
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">
                Grievance & Data Protection Officer (DPO):
              </p>
              <p>Karan Bagal (Designated Grievance Officer)</p>
              <p className="flex items-center gap-1.5 mt-1">
                <Mail className="size-3 text-muted-foreground" />{" "}
                <a href="mailto:grievance@autoaudit.app" className="text-primary underline">
                  grievance@autoaudit.app
                </a>{" "}
                /{" "}
                <a href="mailto:privacy@autoaudit.app" className="text-primary underline">
                  privacy@autoaudit.app
                </a>
              </p>
              <p className="flex items-center gap-1.5 mt-0.5">
                <Phone className="size-3 text-muted-foreground" /> +91 (022) 6940-2800
              </p>
              <p className="text-[11px] mt-1">
                Resolution TAT: Within 30 days of receiving valid verification
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/40 py-6 mt-16 text-center text-xs text-muted-foreground">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} AutoAudit Technologies Pvt Ltd. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/privacy-policy" className="hover:underline">
              Privacy Policy
            </Link>
            <Link to="/terms-and-conditions" className="hover:underline">
              Terms & Conditions
            </Link>
            <Link to="/cookie-policy" className="hover:underline">
              Cookie Policy
            </Link>
            <Link to="/refund-policy" className="hover:underline">
              Refund Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
