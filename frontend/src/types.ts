export type Role = "analyst" | "support_agent" | "engineer" | "manager";

export type KycStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "needs_more_info";

export type RiskLevel = "low" | "medium" | "high";

export type RefundReason =
  | "damaged_item"
  | "not_received"
  | "wrong_item"
  | "duplicate_charge"
  | "service_issue"
  | "other";

export type RefundStatus =
  | "requested"
  | "pending_approval"
  | "approved"
  | "processing"
  | "completed"
  | "rejected";

export type Environment = "production" | "staging" | "dev";

export type EntityType = "kyc_submission" | "refund_request" | "feature_flag";

export interface User {
  id: number;
  name: string;
  role: Role;
}

export interface KycSubmission {
  id: number;
  customer_name: string;
  customer_email: string;
  country: string;
  status: KycStatus;
  risk_level: RiskLevel;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  document_urls: string[];
}

export interface KycStats {
  total_pending: number;
  in_review: number;
  needs_more_info: number;
  avg_review_time_hours: number | null;
  approval_rate_today: number | null;
  decided_today: number;
  approved_today: number;
}

export interface RefundRequest {
  id: number;
  customer_name: string;
  order_id: string;
  original_amount: number;
  refund_amount: number;
  reason: RefundReason;
  status: RefundStatus;
  requested_by: string;
  approved_by: string | null;
  rejection_reason: string | null;
  requested_at: string;
  completed_at: string | null;
  requires_manager_approval: boolean;
}

export interface RefundCreateInput {
  customer_name: string;
  order_id: string;
  original_amount: number;
  refund_amount: number;
  reason: RefundReason;
}

export interface FeatureFlag {
  id: number;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout_percent: number;
  environment: Environment;
  created_by: string;
  updated_at: string;
}

export interface RuntimeFlag {
  key: string;
  name: string;
  rollout_percent: number;
  environment: Environment;
  updated_at: string;
}

export interface FlagPatch {
  enabled?: boolean;
  rollout_percent?: number;
}

export interface AuditEntry {
  id: number;
  user_id: number;
  user_name: string;
  user_role: Role;
  action: string;
  entity_type: EntityType;
  entity_id: number;
  field: string;
  previous_value: string | null;
  new_value: string | null;
  created_at: string;
}
