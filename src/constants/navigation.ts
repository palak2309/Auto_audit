import {
  Activity,
  BarChart3,
  Bell,
  Brain,
  Building2,
  Calculator,
  ClipboardCheck,
  CreditCard,
  Crown,
  Eye,
  FileText,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Plug,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingDown,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { RoleId } from "@/types";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: string;
  /** Permission required to see this entry. Undefined = any signed-in member. */
  permission?: "view" | "manage_users" | "manage_roles" | "configure" | "export" | "recover";
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard },
      { label: "Reports & GST", to: "/reports", icon: ClipboardCheck },
      { label: "Analytics", to: "/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Sales & Billing",
    items: [
      { label: "Invoices & Quotes", to: "/invoices", icon: Receipt },
      { label: "Customers", to: "/customers", icon: Users },
      { label: "Payments", to: "/payments", icon: Wallet },
    ],
  },
  {
    label: "Purchases & Inventory",
    items: [
      { label: "Purchase Bills", to: "/purchases", icon: ShoppingCart },
      { label: "Products & Stock", to: "/products", icon: Package },
      { label: "Suppliers", to: "/suppliers", icon: Building2 },
      { label: "Expenses", to: "/expenses", icon: CreditCard },
    ],
  },
  {
    label: "Auto Audit & Recovery",
    items: [
      { label: "Financial Leaks", to: "/leaks", icon: TrendingDown },
      { label: "Recovery Center", to: "/recovery", icon: LifeBuoy, permission: "recover" },
      { label: "AI Insights", to: "/ai-insights", icon: Brain, badge: "AI" },
      { label: "ERP Transactions", to: "/transactions", icon: Activity },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Business Settings", to: "/settings", icon: Settings, permission: "configure" },
      { label: "Users", to: "/users", icon: Users, permission: "manage_users" },
      { label: "Roles & Permissions", to: "/roles", icon: ShieldCheck, permission: "manage_roles" },
      { label: "ERP Integrations", to: "/integrations", icon: Plug, permission: "configure" },
    ],
  },
];

export interface RoleDefinition {
  id: RoleId;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: "brand" | "violet" | "accent" | "success" | "warning" | "muted";
  permissions: string[];
}

export const roles: RoleDefinition[] = [
  {
    id: "admin",
    label: "Admin",
    description: "Full platform control including users, roles, integrations and billing.",
    icon: ShieldCheck,
    tone: "brand",
    permissions: [
      "View",
      "Create",
      "Edit",
      "Delete",
      "Approve",
      "Recover",
      "Manage Users",
      "Manage Roles",
      "Export",
      "Configure",
    ],
  },
  {
    id: "cfo",
    label: "CFO",
    description: "Executive oversight of savings, recovery performance and board reporting.",
    icon: Crown,
    tone: "violet",
    permissions: ["View", "Approve", "Recover", "Export"],
  },
  {
    id: "finance_manager",
    label: "Finance Manager",
    description: "Owns leak triage, recovery cases and finance team workflows.",
    icon: Gauge,
    tone: "accent",
    permissions: ["View", "Create", "Edit", "Approve", "Recover", "Export"],
  },
  {
    id: "accountant",
    label: "Accountant",
    description: "Reconciles transactions, invoices and payment exceptions day to day.",
    icon: Calculator,
    tone: "success",
    permissions: ["View", "Create", "Edit", "Export"],
  },
  {
    id: "procurement_manager",
    label: "Procurement Manager",
    description: "Manages vendors, contracts and rate-card compliance.",
    icon: ShoppingCart,
    tone: "warning",
    permissions: ["View", "Create", "Edit", "Approve", "Export"],
  },
  {
    id: "auditor",
    label: "Auditor",
    description: "Read-only forensic access with full evidence trail and export rights.",
    icon: ClipboardCheck,
    tone: "muted",
    permissions: ["View", "Export"],
  },
  {
    id: "viewer",
    label: "Viewer",
    description: "Dashboard-only visibility with no data modification rights.",
    icon: Eye,
    tone: "muted",
    permissions: ["View"],
  },
];

export const permissionColumns = [
  "View",
  "Create",
  "Edit",
  "Delete",
  "Approve",
  "Recover",
  "Manage Users",
  "Manage Roles",
  "Export",
  "Configure",
] as const;

export const roleMap = Object.fromEntries(roles.map((r) => [r.id, r])) as Record<
  RoleId,
  RoleDefinition
>;
