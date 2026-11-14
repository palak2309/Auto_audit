import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ERP_PROVIDERS, type ErpProviderMeta } from "@/lib/erp/providers";
import { saveProviderConfig } from "@/lib/erp.functions";

const ZOHO_DCS = [
  { value: "com", label: ".com (Global / US)" },
  { value: "eu", label: ".eu (Europe)" },
  { value: "in", label: ".in (India)" },
  { value: "com.au", label: ".com.au (Australia)" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProvider?: string | undefined;
  onSaved?: () => void;
}

export function ProviderConfigDialog({ open, onOpenChange, initialProvider, onSaved }: Props) {
  const saveFn = useServerFn(saveProviderConfig);
  const [provider, setProvider] = useState<string | null>(initialProvider ?? null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [dataCenter, setDataCenter] = useState("in");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setProvider(initialProvider ?? null);
      setClientId("");
      setClientSecret("");
      setDataCenter("in");
      setBusy(false);
    }
  }, [open, initialProvider]);

  const meta = ERP_PROVIDERS.find((p) => p.id === provider) as ErpProviderMeta | undefined;
  const isZoho = provider === "zoho_books";

  const save = async () => {
    if (!provider || !clientId.trim() || !clientSecret.trim()) return;
    setBusy(true);
    try {
      const payload: {
        provider: string;
        clientId: string;
        clientSecret: string;
        dataCenter?: string;
      } = {
        provider,
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
      };
      if (isZoho) payload.dataCenter = dataCenter;
      await saveFn({ data: payload });
      toast.success(`${meta?.name ?? "Provider"} credentials saved — users can now connect.`);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save credentials");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure provider credentials</DialogTitle>
          <DialogDescription>
            Enter the OAuth app credentials you created at the provider's developer portal. They are
            encrypted server-side and never exposed to the browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pc-provider">Provider</Label>
            <Select
              value={provider ?? ""}
              onValueChange={(v) => setProvider(v || null)}
              disabled={!!initialProvider}
            >
              <SelectTrigger id="pc-provider">
                <SelectValue placeholder="Choose a provider" />
              </SelectTrigger>
              <SelectContent>
                {ERP_PROVIDERS.filter((p) => p.oauth).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {meta && (
              <p className="text-xs text-muted-foreground">
                Create your OAuth app at{" "}
                <a href={meta.docsUrl} target="_blank" rel="noreferrer" className="underline">
                  {meta.docsUrl}
                </a>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pc-client-id">Client ID</Label>
            <Input
              id="pc-client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g. 1000.ABCDEFGHIJK"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pc-client-secret">Client Secret</Label>
            <Input
              id="pc-client-secret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Your OAuth client secret"
              autoComplete="off"
            />
          </div>

          {isZoho && (
            <div className="space-y-2">
              <Label htmlFor="pc-dc">Data center</Label>
              <Select value={dataCenter} onValueChange={setDataCenter}>
                <SelectTrigger id="pc-dc">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZOHO_DCS.map((dc) => (
                    <SelectItem key={dc.value} value={dc.value}>
                      {dc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            <span>
              Credentials are encrypted with AES-256-GCM before storage. Only server-side code reads
              them — no browser or database user can see the secret.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={busy || !provider || !clientId.trim() || !clientSecret.trim()}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "Saving…" : "Save credentials"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
