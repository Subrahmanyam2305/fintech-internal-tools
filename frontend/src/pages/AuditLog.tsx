import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/AuthContext";
import { ROLE_LABELS } from "@/auth/permissions";
import { AuditValue } from "@/components/AuditTrail";
import { PageHeader } from "@/components/PageHeader";
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
import { getAuditLog } from "@/lib/api";
import { fmtDateTime, fmtRelative, humanize } from "@/lib/format";
import type { AuditEntry, EntityType } from "@/types";

const ENTITIES: { value: EntityType; label: string; path: string }[] = [
  { value: "kyc_submission", label: "KYC", path: "/kyc" },
  { value: "refund_request", label: "Refund", path: "/refunds" },
  { value: "feature_flag", label: "Flag", path: "/flags" },
];

function EntityLink({ e }: { e: AuditEntry }) {
  const meta = ENTITIES.find((x) => x.value === e.entity_type);
  const label = `${meta?.label ?? e.entity_type} #${e.entity_id}`;
  const to =
    e.entity_type === "kyc_submission" ? `/kyc/${e.entity_id}` : meta?.path;
  return to ? (
    <Link to={to} className="font-medium hover:underline">
      {label}
    </Link>
  ) : (
    <span>{label}</span>
  );
}

export default function AuditLog() {
  const { users } = useAuth();
  const [entity, setEntity] = useState("all");
  const [userId, setUserId] = useState("all");
  const params = {
    entity_type: entity === "all" ? undefined : (entity as EntityType),
    user_id: userId === "all" ? undefined : Number(userId),
    limit: 200,
  };
  const q = useQuery({
    queryKey: ["audit", "global", params],
    queryFn: () => getAuditLog(params),
  });

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Every status change, toggle, and approval across OpsDash: who, what, when, and the before/after values."
      />
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tools</SelectItem>
              {ENTITIES.map((x) => (
                <SelectItem key={x.value} value={x.value}>
                  {humanize(x.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-sm text-muted-foreground">
            {q.data ? `${q.data.length} entries` : ""}
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Field</TableHead>
              <TableHead className="pr-4">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="px-4">
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {q.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No audit entries yet. Changes made in any tool show up here.
                </TableCell>
              </TableRow>
            )}
            {q.data?.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="pl-4">
                  <div>{fmtRelative(e.created_at)}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDateTime(e.created_at)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{e.user_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {ROLE_LABELS[e.user_role]}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{e.action}</TableCell>
                <TableCell>
                  <EntityLink e={e} />
                </TableCell>
                <TableCell>{humanize(e.field)}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    <AuditValue value={e.previous_value} />
                    <span className="text-muted-foreground">→</span>
                    <AuditValue value={e.new_value} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
