import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Link } from "@tanstack/react-router";
import { Sparkles, TrendingUp } from "lucide-react";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-secondary" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
        <div className="relative flex h-full flex-col justify-between p-12 text-foreground">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="AutoAudit" className="size-9 rounded-xl object-contain" />
            <span className="text-sm font-semibold">AutoAudit</span>
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="max-w-md text-4xl leading-tight font-semibold tracking-tight">
              Find the money your ERP already lost.
            </h2>
            <p className="mt-4 max-w-md text-sm/relaxed opacity-90">
              AutoAudit analyses every transaction, invoice and contract to surface duplicate
              payments, overcharges, tax errors and fraud — with an explanation you can act on.
            </p>
            <dl className="mt-10 grid grid-cols-2 gap-6 max-w-md">
              <div>
                <dt className="text-xs opacity-80">Audit Coverage</dt>
                <dd className="mt-1 text-2xl font-semibold">100% Invoices</dd>
              </div>
              <div>
                <dt className="text-xs opacity-80">Algorithm Accuracy</dt>
                <dd className="mt-1 text-2xl font-semibold">Deterministic</dd>
              </div>
            </dl>
          </motion.div>
          <div className="flex items-center gap-4 text-xs opacity-85">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> DPDP Act Aligned
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="size-3.5" /> AES-256 Encryption
            </span>
          </div>
        </div>
      </div>

      <div className="relative flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="grid-pattern pointer-events-none absolute inset-0 opacity-40 lg:hidden" />
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-md"
        >
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src="/logo.png" alt="AutoAudit" className="size-9 rounded-xl object-contain" />
            <span className="text-sm font-semibold">AutoAudit</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
          <div className="mt-6 pt-4 border-t border-border/60 text-center text-xs text-muted-foreground space-x-3">
            <Link to="/privacy-policy" className="hover:text-foreground underline">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/terms-and-conditions" className="hover:text-foreground underline">
              Terms of Service
            </Link>
            <span>•</span>
            <Link to="/cookie-policy" className="hover:text-foreground underline">
              Cookie Policy
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
