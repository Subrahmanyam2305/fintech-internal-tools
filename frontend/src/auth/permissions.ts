import type { Role } from "@/types";

export type Permission =
  | "kyc:review"
  | "refund:create"
  | "refund:approve"
  | "refund:process"
  | "flag:edit";

const PERMISSION_ROLES: Record<Permission, Role[]> = {
  "kyc:review": ["analyst", "manager"],
  "refund:create": ["support_agent", "manager"],
  "refund:approve": ["manager"],
  "refund:process": ["support_agent", "manager"],
  "flag:edit": ["engineer", "manager"],
};

export const ROLE_LABELS: Record<Role, string> = {
  analyst: "Analyst",
  support_agent: "Support Agent",
  engineer: "Engineer",
  manager: "Manager",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  analyst: "Reviews KYC submissions, claims and decides queue items.",
  support_agent: "Creates refunds and moves approved refunds through processing.",
  engineer: "Manages feature flags and rollout percentages.",
  manager: "Approves refunds and has full access across tools.",
};

export function roleCan(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSION_ROLES[permission].includes(role);
}
