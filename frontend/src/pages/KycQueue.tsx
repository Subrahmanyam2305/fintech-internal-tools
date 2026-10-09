import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Inbox,
  UserCheck,
} from "lucide-react";

import { useAuth } from "@/auth/AuthContext";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getKycStats, getKycSubmissions } from "@/lib/api";
import { fmtDate, fmtHours, fmtRelative, humanize } from "@/lib/format";
import type { KycStatus, RiskLevel } from "@/types";

const STATUSES: KycStatus[] = [
  "pending",
  "in_review",
  "needs_more_info",
  "approved",
  "rejected",
];
const RISKS: RiskLevel[] = ["low", "medium", "high"];

export default function KycQueue() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");
  const [sort, setSort] = useState<"asc" | "desc">("desc");

  const params = {
    status: status === "all" ? undefined : status,
    risk_level: risk === "all" ? undefined : risk,
    sort,
  };
  const list = useQuery({
    queryKey: ["kyc-list", params],
    queryFn: () => getKycSubmissions(params),
  });
  const stats = useQuery({ queryKey: ["kyc-stats"], queryFn: getKycStats });
  const s = stats.data;
  const filtered = status !== "all" || risk !== "all";

  return (
    <div>
      <PageHeader
        title="KYC Review Queue"
        description="Review customer identity submissions. Opening a pending item assigns it to you."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total pending"
          value={s?.total_pending ?? "—"}
          hint={s ? `${s.needs_more_info} awaiting customer info` : undefined}
          icon={<Inbox className="size-4" />}
        />
        <StatCard
          label="In review"
          value={s?.in_review ?? "—"}
          hint="Assigned to an analyst"
          icon={<UserCheck className="size-4" />}
        />
        <StatCard
          label="Avg review time"
          value={fmtHours(s?.avg_review_time_hours)}
          hint="Submission → decision"
          icon={<Clock className="size-4" />}
        />
        <StatCard
          label="Approval rate today"
          value={
            s?.approval_rate_today == null
              ? "—"
              : `${Math.round(s.approval_rate_today * 100)}%`
          }
          hint={
            s
              ? `${s.approved_today} of ${s.decided_today} decisions approved`
              : undefined
          }
          icon={<CheckCircle2 className="size-4" />}
        />
      </div>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((v) => (
                <SelectItem key={v} value={v}>
                  {humanize(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={risk} onValueChange={setRisk}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risk levels</SelectItem>
              {RISKS.map((v) => (
                <SelectItem key={v} value={v}>
                  {humanize(v)} risk
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setSort(sort === "desc" ? "asc" : "desc")}
          >
            {sort === "desc" ? <ArrowDown /> : <ArrowUp />}
            {sort === "desc" ? "Newest first" : "Oldest first"}
          </Button>
          {filtered && (
            <Button
              variant="ghost"
              onClick={() => {
                setStatus("all");
                setRisk("all");
              }}
            >
              Clear filters
            </Button>
          )}
          <span className="ml-auto text-sm text-muted-foreground">
            {list.data ? `${list.data.length} submissions` : ""}
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Customer</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <button
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  onClick={() => setSort(sort === "desc" ? "asc" : "desc")}
                >
                  Submitted
                  {sort === "desc" ? (
                    <ArrowDown className="size-3" />
                  ) : (
                    <ArrowUp className="size-3" />
                  )}
                </button>
              </TableHead>
              <TableHead className="pr-4">Reviewer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="px-4">
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {list.data?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-muted-foreground"
                >
                  No submissions match these filters.
                </TableCell>
              </TableRow>
            )}
            {list.data?.map((k) => (
              <TableRow
                key={k.id}
                className="cursor-pointer"
                onClick={() => navigate(`/kyc/${k.id}`)}
              >
                <TableCell className="pl-4">
                  <div className="font-medium">{k.customer_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {k.customer_email}
                  </div>
                </TableCell>
                <TableCell>{k.country}</TableCell>
                <TableCell>
                  <StatusBadge value={k.risk_level} dot />
                </TableCell>
                <TableCell>
                  <StatusBadge value={k.status} />
                </TableCell>
                <TableCell>
                  <div>{fmtDate(k.submitted_at)}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtRelative(k.submitted_at)}
                  </div>
                </TableCell>
                <TableCell className="pr-4">
                  {k.reviewed_by ? (
                    <span>
                      {k.reviewed_by}
                      {k.reviewed_by === currentUser?.name && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
