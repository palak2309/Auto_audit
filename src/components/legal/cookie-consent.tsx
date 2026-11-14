import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

const COOKIE_CONSENT_KEY = "autoaudit_cookie_consent_v1";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consent) {
        setVisible(true);
      }
    } catch {
      // localStorage may be disabled in private browsing
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(
        COOKIE_CONSENT_KEY,
        JSON.stringify({ essential: true, analytics: false, timestamp: new Date().toISOString() }),
      );
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const handleDecline = () => {
    try {
      localStorage.setItem(
        COOKIE_CONSENT_KEY,
        JSON.stringify({
          essential: true,
          analytics: false,
          declined: true,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      role="region"
      aria-label="Cookie and Privacy Preferences"
      className="fixed bottom-0 inset-x-0 z-50 p-4 md:p-6 bg-background/95 backdrop-blur-md border-t border-border shadow-2xl animate-in fade-in slide-in-from-bottom duration-300"
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
            <Cookie className="size-5" />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
              <span>Cookie & Privacy Notice</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                DPDP Act & GDPR Compliant
              </span>
            </p>
            <p className="leading-relaxed max-w-3xl">
              AutoAudit uses strictly necessary session cookies required for secure user
              authentication, workspace tenancy, and CSRF protection. We do not use third-party
              advertising trackers or sell personal data. Learn more in our{" "}
              <Link to="/cookie-policy" className="text-primary underline hover:text-primary/80">
                Cookie Policy
              </Link>{" "}
              and{" "}
              <Link to="/privacy-policy" className="text-primary underline hover:text-primary/80">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDecline}
            className="text-xs"
          >
            Essential Only
          </Button>
          <Button type="button" size="sm" onClick={handleAccept} className="text-xs">
            Accept Essential Cookies
          </Button>
        </div>
      </div>
    </aside>
  );
}
