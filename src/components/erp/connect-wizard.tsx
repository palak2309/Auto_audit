import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToneBadge } from "@/components/common/tone-badge";
import { ERP_PROVIDERS, type ErpProviderMeta } from "@/lib/erp/providers";
import { cn } from "@/lib/utils";

const STEPS = ["Choose provider", "Review access", "Authorise"] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configured: string[];
  connectedProviders: string[];
  onConnect: (providerId: string) => Promise<void>;
  initialProvider?: string | undefined;
}

export function ConnectWizard({
  open,
  onOpenChange,
  configured,
  connectedProviders,
  onConnect,
  initialProvider,
}: Props) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string | null>(initialProvider ?? null);
  const [busy, setBusy] = useState(false);

  const provider = useMemo<ErpProviderMeta | undefined>(
    () => ERP_PROVIDERS.find((p) => p.id === selected),
    [selected],
  );
  const ready = !!provider && provider.oauth && configured.includes(provider.id);

  const reset = () => {
    setStep(0);
    setSelected(initialProvider ?? null);
    setBusy(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const authorise = async () => {
    if (!provider) return;
    setBusy(true);
    try {
      await onConnect(provider.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the connection");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect an ERP or accounting system</DialogTitle>
          <DialogDescription>
            A guided three-step setup: pick the source system, review what AutoAudit reads, then
            authorise the connection in the provider&apos;s own login screen.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex items-center gap-2 text-xs">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  i < step
                    ? "border-success/40 bg-success/15 text-success"
                    : i === step
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-muted-foreground",
                )}
              >
                {i < step ? <Check className="size-3" /> : i + 1}
              </span>
              <span
                className={cn("truncate", i === step ? "font-medium" : "text-muted-foreground")}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-border sm:block" />}
            </li>
          ))}
        </ol>

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="min-h-56"
        >
          {step === 0 && (
            <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {ERP_PROVIDERS.map((p) => {
                const isReady = p.oauth && configured.includes(p.id);
                const already = connectedProviders.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p.id)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition",
                      selected === p.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{p.name}</p>
                      <ToneBadge tone={already ? "success" : isReady ? "brand" : "muted"} size="sm">
                        {already
                          ? "Connected"
                          : isReady
                            ? "Ready"
                            : p.oauth
                              ? "Setup needed"
                              : "Enterprise"}
                      </ToneBadge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{p.blurb}</p>
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && provider && (
            <div className="space-y-3 text-sm">
              <div className="surface-card p-4">
                <p className="font-semibold">{provider.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{provider.blurb}</p>
              </div>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {[
                  "Read-only access to invoices, bills and credit notes",
                  "Read-only access to payments and vendor/contact records",
                  "Contracts and purchase agreements where the provider exposes them",
                  "Tokens are encrypted server-side and never exposed to the browser",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {!ready && (
                <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  {provider.oauth
                    ? `${provider.name} developer app credentials are not configured yet, so one-click connection is unavailable.`
                    : `${provider.name} requires a tenant-provisioned integration record from your administrator.`}{" "}
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline"
                  >
                    Provider docs <ExternalLink className="size-3" />
                  </a>
                </p>
              )}
            </div>
          )}

          {step === 2 && provider && (
            <div className="space-y-3 text-sm">
              <p>
                You&apos;ll be redirected to {provider.name} to sign in and approve access. After
                approval we bring you straight back and start the first import automatically.
              </p>
              <ol className="space-y-2 text-xs text-muted-foreground">
                <li>1. Sign in with the account that owns your financial data.</li>
                <li>2. Select the organisation or company file to share.</li>
                <li>3. Approve the read-only scopes and wait for the redirect back.</li>
              </ol>
            </div>
          )}
        </motion.div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={step === 0 || busy}
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          {step < 2 ? (
            <Button
              size="sm"
              disabled={!provider || (step === 1 && !ready)}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button size="sm" disabled={!ready || busy} onClick={authorise}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? "Redirecting…" : `Authorise ${provider?.name ?? ""}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
