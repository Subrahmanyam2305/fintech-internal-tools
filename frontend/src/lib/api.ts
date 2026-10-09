import type {
  AuditEntry,
  Environment,
  EntityType,
  FeatureFlag,
  FlagPatch,
  KycStats,
  KycSubmission,
  RefundCreateInput,
  RefundRequest,
  RuntimeFlag,
  User,
} from "@/types";

const STORAGE_KEY = "opsdash.userId";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

function currentUserId(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

function parseDetail(data: unknown): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d) =>
          typeof d === "object" && d !== null && "msg" in d
            ? String((d as { msg: unknown }).msg)
            : String(d),
        )
        .join("; ");
    }
    return String(detail);
  }
  return "Request failed";
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const userId = currentUserId();
  if (userId) headers["X-User-Id"] = userId;

  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = parseDetail(await res.json());
    } catch {
      // keep statusText
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

// ---- Users / auth ----
export const getUsers = () => api<User[]>("/api/users");
export const getMe = () => api<User>("/api/me");
export const getHealth = () => api<{ status: string }>("/api/health");

// ---- KYC ----
export interface KycListParams {
  status?: string;
  risk_level?: string;
  sort?: "asc" | "desc";
}
export const getKycSubmissions = (params: KycListParams = {}) => {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.risk_level) q.set("risk_level", params.risk_level);
  if (params.sort) q.set("sort", params.sort);
  const qs = q.toString();
  return api<KycSubmission[]>(`/api/kyc${qs ? `?${qs}` : ""}`);
};
export const getKycStats = () => api<KycStats>("/api/kyc/stats");
export const getKycSubmission = (id: number) =>
  api<KycSubmission>(`/api/kyc/${id}`);
export const claimKyc = (id: number) =>
  api<KycSubmission>(`/api/kyc/${id}/claim`, { method: "POST" });
export const approveKyc = (id: number, notes?: string) =>
  api<KycSubmission>(`/api/kyc/${id}/approve`, {
    method: "POST",
    body: { notes },
  });
export const rejectKyc = (id: number, reason: string) =>
  api<KycSubmission>(`/api/kyc/${id}/reject`, {
    method: "POST",
    body: { reason },
  });
export const requestKycInfo = (id: number, message?: string) =>
  api<KycSubmission>(`/api/kyc/${id}/request-info`, {
    method: "POST",
    body: { message },
  });

// ---- Refunds ----
export interface RefundListParams {
  status?: string;
  date_from?: string;
  date_to?: string;
  needs_approval?: boolean;
}
export const getRefunds = (params: RefundListParams = {}) => {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.date_from) q.set("date_from", params.date_from);
  if (params.date_to) q.set("date_to", params.date_to);
  if (params.needs_approval) q.set("needs_approval", "true");
  const qs = q.toString();
  return api<RefundRequest[]>(`/api/refunds${qs ? `?${qs}` : ""}`);
};
export const createRefund = (body: RefundCreateInput) =>
  api<RefundRequest>("/api/refunds", { method: "POST", body });
export const approveRefund = (id: number) =>
  api<RefundRequest>(`/api/refunds/${id}/approve`, { method: "POST" });
export const rejectRefund = (id: number, reason?: string) =>
  api<RefundRequest>(`/api/refunds/${id}/reject`, {
    method: "POST",
    body: { reason },
  });
export const processRefund = (id: number) =>
  api<RefundRequest>(`/api/refunds/${id}/process`, { method: "POST" });
export const completeRefund = (id: number) =>
  api<RefundRequest>(`/api/refunds/${id}/complete`, { method: "POST" });

// ---- Feature flags ----
export const getRuntimeFlags = (env: Environment) =>
  api<RuntimeFlag[]>(`/api/flags?env=${env}`);
export const getFeatureFlags = (environment?: Environment) =>
  api<FeatureFlag[]>(
    `/api/feature-flags${environment ? `?environment=${environment}` : ""}`,
  );
export const patchFeatureFlag = (id: number, patch: FlagPatch) =>
  api<FeatureFlag>(`/api/feature-flags/${id}`, {
    method: "PATCH",
    body: patch,
  });

// ---- Audit ----
export interface AuditListParams {
  entity_type?: EntityType;
  entity_id?: number;
  user_id?: number;
  limit?: number;
}
export const getAuditLog = (params: AuditListParams = {}) => {
  const q = new URLSearchParams();
  if (params.entity_type) q.set("entity_type", params.entity_type);
  if (params.entity_id !== undefined) q.set("entity_id", String(params.entity_id));
  if (params.user_id !== undefined) q.set("user_id", String(params.user_id));
  if (params.limit !== undefined) q.set("limit", String(params.limit));
  const qs = q.toString();
  return api<AuditEntry[]>(`/api/audit${qs ? `?${qs}` : ""}`);
};
