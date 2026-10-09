import { format, formatDistanceStrict, formatDistanceToNow } from "date-fns";

import { ApiError } from "@/lib/api";

export const fmtDateTime = (iso?: string | null) =>
  iso ? format(new Date(iso), "MMM d, yyyy · HH:mm") : "—";

export const fmtDate = (iso?: string | null) =>
  iso ? format(new Date(iso), "MMM d, yyyy") : "—";

export const fmtRelative = (iso?: string | null) =>
  iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : "—";

export const fmtDuration = (fromIso: string, toIso?: string | null) =>
  formatDistanceStrict(new Date(fromIso), toIso ? new Date(toIso) : new Date());

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
export const fmtMoney = (n: number) => money.format(n);

export const humanize = (s: string) =>
  s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function fmtHours(h: number | null | undefined) {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export function errorMessage(e: unknown) {
  if (e instanceof ApiError) return e.detail;
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}
