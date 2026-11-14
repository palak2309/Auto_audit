export type RoleId =
  "admin" | "cfo" | "finance_manager" | "accountant" | "procurement_manager" | "auditor" | "viewer";

export type Severity = "critical" | "high" | "medium" | "low";
export type LeakStatus =
  "detected" | "new" | "investigating" | "recovering" | "recovered" | "dismissed";

export type RecoveryStage =
  "identified" | "vendor_contacted" | "claim_filed" | "credit_issued" | "recovered";

export type LeakCategory =
  | "Duplicate Payment"
  | "Duplicate Invoice"
  | "Vendor Overcharge"
  | "Invoice Error"
  | "Tax Error"
  | "Contract Violation"
  | "Subscription Waste"
  | "Fraud Indicator"
  | "Spend Anomaly";

export interface FinancialLeak {
  id: string;
  title: string;
  category: LeakCategory;
  vendor: string;
  amount: number;
  currency: string;
  severity: Severity;
  status: LeakStatus;
  confidence: number;
  detectedAt: string;
  source: string;
  aiExplanation: string;
  recommendation: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  vendor: string;
  account: string;
  amount: number;
  status: "posted" | "pending" | "flagged" | "reversed";
  riskScore: number;
}

export interface Invoice {
  id: string;
  vendor: string;
  issued: string;
  due: string;
  amount: number;
  tax: number;
  status: "paid" | "approved" | "pending" | "disputed" | "overdue";
  duplicateOf?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  vendor: string;
  method: "ACH" | "Wire" | "Card" | "Check";
  date: string;
  amount: number;
  status: "settled" | "in_flight" | "failed" | "reversed";
  flagged: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  spendYtd: number;
  leaks: number;
  riskScore: number;
  contractStatus: "active" | "expiring" | "expired";
  country: string;
}

export interface Contract {
  id: string;
  vendor: string;
  title: string;
  value: number;
  startDate: string;
  endDate: string;
  status: "active" | "expiring" | "expired" | "breached";
  violations: number;
}

export interface AlertItem {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  time: string;
  category: LeakCategory | "System";
  read: boolean;
}

export interface AiInsight {
  id: string;
  title: string;
  summary: string;
  impact: number;
  confidence: number;
  category: LeakCategory;
  actions: string[];
}

export interface RecoveryCase {
  id: string;
  vendor: string;
  amount: number;
  stage: "identified" | "claim_filed" | "vendor_contacted" | "credit_issued" | "recovered";
  owner: string;
  opened: string;
  progress: number;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: RoleId;
  department: string;
  status: "active" | "invited" | "suspended";
  lastActive: string;
  initials: string;
}

export interface SessionRecord {
  id: string;
  device: string;
  location: string;
  ip: string;
  lastActive: string;
  current: boolean;
}

export interface DurableLeakCase {
  id: string;
  userId: string;
  connectionId: string | null;
  fingerprint: string;
  type: string;
  title: string;
  vendorName: string;
  amount: number;
  currency: string;
  severity: Severity;
  status: LeakStatus;
  assignedTo: string | null;
  source: string;
  evidence: Record<string, unknown>;
  resolutionNotes: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeakActivityRecord {
  id: string;
  leakId: string;
  userId: string;
  actorId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RecoveryCaseRecord {
  id: string;
  leakId: string;
  userId: string;
  stage: RecoveryStage;
  targetAmount: number;
  recoveredAmount: number;
  currency: string;
  ownerId: string | null;
  claimReference: string | null;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
