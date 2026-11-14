import { useState } from "react";
import { Check, Code2, Copy, Play, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CustomApiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataIngested?: () => void;
}

export function CustomApiDialog({ open, onOpenChange, onDataIngested }: CustomApiDialogProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isSendingSample, setIsSendingSample] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8081";
  const endpointUrl = `${origin}/api/public/erp/ingest`;

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedCode(key);
    setTimeout(() => setCopiedCode(null), 2000);
    toast.success("Code snippet copied to clipboard!");
  };

  const pythonSnippet = `import requests

url = "${endpointUrl}"

payload = {
    "accountName": "Enterprise Accounting System",
    "vendors": [
        {"external_id": "VND-101", "name": "Global Cloud Services", "email": "billing@globalcloud.com"}
    ],
    "invoices": [
        {
            "external_id": "INV-9021",
            "invoice_number": "INV-9021",
            "vendor_name": "Global Cloud Services",
            "amount": 14500.00,
            "amount_paid": 0.00,
            "currency": "INR",
            "status": "OPEN",
            "issue_date": "2026-09-20",
            "due_date": "2026-10-05"
        }
    ],
    "payments": [
        {
            "external_id": "PAY-551",
            "invoice_external_id": "INV-9021",
            "reference": "UTR-9918237",
            "vendor_name": "Global Cloud Services",
            "amount": 14500.00,
            "currency": "INR",
            "paid_date": "2026-09-22"
        }
    ]
}

response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
print(response.status_code, response.json())
`;

  const nodeSnippet = `// Node.js (fetch) or Next.js / Express
const endpoint = "${endpointUrl}";

const payload = {
  accountName: "Custom ERP System",
  vendors: [
    { external_id: "VND-101", name: "Global Cloud Services", email: "billing@globalcloud.com" }
  ],
  invoices: [
    {
      external_id: "INV-9021",
      invoice_number: "INV-9021",
      vendor_name: "Global Cloud Services",
      amount: 14500.00,
      amount_paid: 0.00,
      currency: "INR",
      status: "OPEN",
      issue_date: "2026-09-20",
      due_date: "2026-10-05"
    }
  ],
  payments: [
    {
      external_id: "PAY-551",
      invoice_external_id: "INV-9021",
      reference: "UTR-9918237",
      vendor_name: "Global Cloud Services",
      amount: 14500.00,
      currency: "INR",
      paid_date: "2026-09-22"
    }
  ]
};

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const result = await response.json();
console.log("AutoAudit Response:", result);
`;

  const curlSnippet = `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "accountName": "Custom Accounting Server",
    "vendors": [
      { "external_id": "V-01", "name": "Apex Logistics", "email": "ap@apex.com" }
    ],
    "invoices": [
      {
        "external_id": "BILL-100",
        "invoice_number": "BILL-100",
        "vendor_name": "Apex Logistics",
        "amount": 12000,
        "amount_paid": 0,
        "currency": "INR",
        "issue_date": "2026-09-20"
      }
    ],
    "payments": []
  }'`;

  const handleSendSample = async () => {
    setIsSendingSample(true);
    try {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const res = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountName: "Custom ERP Live Demo",
          vendors: [
            {
              external_id: `V-DEMO-${randomSuffix}`,
              name: `Custom Vendor ${randomSuffix} Ltd`,
              email: `ap@vendor${randomSuffix}.com`,
            },
          ],
          invoices: [
            {
              external_id: `INV-${randomSuffix}-A`,
              invoice_number: `INV-${randomSuffix}-A`,
              vendor_name: `Custom Vendor ${randomSuffix} Ltd`,
              amount: 18000,
              amount_paid: 18000,
              currency: "INR",
              status: "PAID",
              issue_date: new Date().toISOString().slice(0, 10),
            },
            {
              external_id: `INV-${randomSuffix}-B`,
              invoice_number: `INV-${randomSuffix}-B`,
              vendor_name: `Custom Vendor ${randomSuffix} Ltd`,
              amount: 18000,
              amount_paid: 18000,
              currency: "INR",
              status: "PAID",
              issue_date: new Date().toISOString().slice(0, 10),
            },
          ],
          payments: [
            {
              external_id: `PAY-${randomSuffix}-1`,
              invoice_external_id: `INV-${randomSuffix}-A`,
              reference: `TXN-${randomSuffix}`,
              vendor_name: `Custom Vendor ${randomSuffix} Ltd`,
              amount: 18000,
              currency: "INR",
              paid_date: new Date().toISOString().slice(0, 10),
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to ingest sample data");
      }

      toast.success(
        `Test batch ingested! AutoAudit imported 2 invoices & 1 payment. Total audit leaks detected: ${data.auditSummary?.totalLeaksDetected ?? 0}`,
      );
      if (onDataIngested) onDataIngested();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Ingest test failed: ${msg}`);
    } finally {
      setIsSendingSample(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="size-5 text-primary" /> Custom ERP / Accounting Ingest API
          </DialogTitle>
          <DialogDescription>
            Push transaction records directly from your custom software into AutoAudit via standard
            REST HTTP POST.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto flex-1">
          {/* Endpoint Banner */}
          <div className="space-y-1.5 rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Direct HTTP Ingestion Endpoint
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                POST · JSON
              </span>
            </div>
            <div className="flex gap-2">
              <Input readOnly value={endpointUrl} className="font-mono text-xs bg-background" />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs shrink-0"
                onClick={() => {
                  void navigator.clipboard.writeText(endpointUrl);
                  setCopiedUrl(true);
                  setTimeout(() => setCopiedUrl(false), 2000);
                  toast.success("Endpoint URL copied!");
                }}
              >
                {copiedUrl ? (
                  <Check className="size-3.5 text-success" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                Copy URL
              </Button>
            </div>
          </div>

          {/* Test Action Bar */}
          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
            <div className="space-y-0.5">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" /> Try Ingestion Right Now
              </p>
              <p className="text-[11px] text-muted-foreground">
                Sends a synthetic sample batch (with a simulated duplicate bill) to verify real-time
                ingestion and audit.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 text-xs shrink-0"
              onClick={handleSendSample}
              disabled={isSendingSample}
            >
              <Send className={`size-3.5 ${isSendingSample ? "animate-spin" : ""}`} />
              {isSendingSample ? "Ingesting…" : "Send Test Batch"}
            </Button>
          </div>

          {/* Code Snippets Tabs */}
          <Tabs defaultValue="python" className="w-full">
            <div className="flex items-center justify-between pb-1">
              <TabsList className="h-8">
                <TabsTrigger value="python" className="text-xs h-7">
                  Python
                </TabsTrigger>
                <TabsTrigger value="node" className="text-xs h-7">
                  Node.js / TS
                </TabsTrigger>
                <TabsTrigger value="curl" className="text-xs h-7">
                  cURL
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="python" className="relative mt-2">
              <pre className="rounded-xl border border-border bg-muted/40 p-3.5 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-[300px]">
                {pythonSnippet}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-7 gap-1 text-[11px]"
                onClick={() => copyToClipboard(pythonSnippet, "python")}
              >
                {copiedCode === "python" ? (
                  <Check className="size-3 text-success" />
                ) : (
                  <Copy className="size-3" />
                )}
                Copy
              </Button>
            </TabsContent>

            <TabsContent value="node" className="relative mt-2">
              <pre className="rounded-xl border border-border bg-muted/40 p-3.5 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-[300px]">
                {nodeSnippet}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-7 gap-1 text-[11px]"
                onClick={() => copyToClipboard(nodeSnippet, "node")}
              >
                {copiedCode === "node" ? (
                  <Check className="size-3 text-success" />
                ) : (
                  <Copy className="size-3" />
                )}
                Copy
              </Button>
            </TabsContent>

            <TabsContent value="curl" className="relative mt-2">
              <pre className="rounded-xl border border-border bg-muted/40 p-3.5 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-[300px]">
                {curlSnippet}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-7 gap-1 text-[11px]"
                onClick={() => copyToClipboard(curlSnippet, "curl")}
              >
                {copiedCode === "curl" ? (
                  <Check className="size-3 text-success" />
                ) : (
                  <Copy className="size-3" />
                )}
                Copy
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
