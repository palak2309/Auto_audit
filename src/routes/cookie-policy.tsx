import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/legal-layout";

export const Route = createFileRoute("/cookie-policy")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — AutoAudit" },
      {
        name: "description",
        content:
          "Cookie Policy detailing necessary cookies, security tokens, and privacy controls on AutoAudit.",
      },
    ],
  }),
  component: CookiePolicyPage,
});

function CookiePolicyPage() {
  return (
    <LegalLayout title="Cookie & Local Storage Policy" lastUpdated="September 28, 2026">
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">1. What Are Cookies & Local Storage?</h2>
        <p>
          Cookies and modern web storage (such as HTML5 LocalStorage and SessionStorage) are small
          pieces of data stored on your device by your browser when you visit a web application.
          They allow the platform to remember your authenticated session, maintain active workspace
          settings, and provide secure access.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          2. Our Policy: Strictly Necessary Cookies Only
        </h2>
        <p>
          Unlike consumer ad-supported websites, AutoAudit is an enterprise financial auditing
          platform.{" "}
          <strong>
            We do not use advertising cookies, marketing tracking pixels, or cross-site tracking
            beacons.
          </strong>
        </p>
        <p>We classify all storage used on AutoAudit into strictly necessary categories:</p>

        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b border-border text-foreground font-semibold">
              <tr>
                <th className="p-3">Cookie / Key</th>
                <th className="p-3">Purpose</th>
                <th className="p-3">Type</th>
                <th className="p-3">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="p-3 font-mono font-medium text-foreground">
                  sb-[project]-auth-token
                </td>
                <td className="p-3">
                  Secures your authenticated user session with Supabase, validates JWT signatures,
                  and prevents unauthorized workspace access.
                </td>
                <td className="p-3">Strictly Necessary</td>
                <td className="p-3">Session / 30 Days (if Remember Me selected)</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-medium text-foreground">autoaudit_theme</td>
                <td className="p-3">
                  Stores user presentation preference (Dark Mode / Light Mode).
                </td>
                <td className="p-3">Functional / Preferences</td>
                <td className="p-3">Persistent (LocalStorage)</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-medium text-foreground">
                  autoaudit_cookie_consent_v1
                </td>
                <td className="p-3">
                  Records that you have acknowledged our Cookie Notice and selected essential
                  storage settings.
                </td>
                <td className="p-3">Strictly Necessary (Compliance)</td>
                <td className="p-3">1 Year (LocalStorage)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          3. Third-Party Trackers & Embeds Verification
        </h2>
        <p>We have verified that the AutoAudit application contains:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>No Google Analytics or Google Tag Manager trackers</strong> injecting
            surveillance cookies.
          </li>
          <li>
            <strong>No Meta / Facebook Pixels, LinkedIn Insight Tags, or TikTok pixels</strong>.
          </li>
          <li>
            <strong>No third-party iframe ad embeds or behavioral profiling engines</strong>.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">4. How to Manage or Disable Cookies</h2>
        <p>
          Most browsers allow you to block or delete cookies in your browser settings (Chrome,
          Safari, Firefox, Edge). However, please note that blocking strictly necessary
          authentication cookies will prevent you from signing in to your AutoAudit workspace.
        </p>
      </section>
    </LegalLayout>
  );
}
