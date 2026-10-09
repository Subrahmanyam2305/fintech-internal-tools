import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Plus, ShieldAlert } from "lucide-react";

import { useAuth } from "@/auth/AuthContext";
import { ActionDialog } from "@/components/ActionDialog";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  approveRefund,
  completeRefund,
  createRefund,
  getRefunds,
  processRefund,
  rejectRefund,
} from "@/lib/api";
import { errorMessage, fmtDate, fmtMoney, humanize } from "@/lib/format";
import type { RefundReason, RefundRequest, RefundStatus } from "@/types";

const APPROVAL_THRESHOLD = 500;
const STATUSES: RefundStatus[] = [
  "requested",
  "pending_approval",
  "approved",
  "processing",
  "completed",
  "rejected",
];
const REASONS: RefundReason[] = [
  "damaged_item",
  "not_received",
  "wrong_item",
  "duplicate_charge",
  "service_issue",
  "other",
];

type RefundAction = "approve" | "reject" | "process" | "complete";
const DONE: Record<RefundAction, string> = {
  approve: "approved",
  reject: "rejected",
  process: "moved to processing",
  complete: "marked completed",
};

export default function Refunds() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rejecting, setRejecting] = useState<RefundRequest | null>(null);
  const [creating, setCreating] = useState(false);

  const dates = { date_from: from || undefined, date_to: to || undefined };
  const allParams = { ...dates, status: status === "all" ? undefined : status };
  const all = useQuery({
    queryKey: ["refunds", "all", allParams],
    queryFn: () => getRefunds(allParams),
  });
  const needsParams = { ...dates, needs_approval: true };
  const needs = useQuery({
    queryKey: ["refunds", "needs", needsParams],
    queryFn: () => getRefunds(needsParams),
  });

  const act = useMutation({
    mutationFn: ({
      kind,
      id,
      reason,
    }: {
      kind: RefundAction;
      id: number;
      reason?: string;
    }) =>
      kind === "approve"
        ? approveRefund(id)
        : kind === "reject"
          ? rejectRefund(id, reason)
          : kind === "process"
            ? processRefund(id)
            : completeRefund(id),
    onSuccess: (row, { kind }) => {
      qc.invalidateQueries({ queryKey: ["refunds"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      setRejecting(null);
      toast.success(`Refund #${row.id} ${DONE[kind]}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const badDates = !!from && !!to && from > to;
  const active = tab === "all" ? all : needs;
  const needsCount = needs.data?.length;

  return (
    <div>
      <PageHeader
        title="Refunds"
        description={`Track refund requests through approval and payout. Refunds over ${fmtMoney(APPROVAL_THRESHOLD)} require manager approval.`}
        actions={
          can("refund:create") && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New refund
            </Button>
          )
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All requests</TabsTrigger>
          <TabsTrigger value="needs">
            Needs approval
            {needsCount ? (
              <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800">
                {needsCount}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "needs" && !can("refund:approve") && (
        <Alert className="mb-4">
          <Lock />
          <AlertTitle>Manager approval required</AlertTitle>
          <AlertDescription>
            These refunds exceed {fmtMoney(APPROVAL_THRESHOLD)}. Only managers can
            approve or reject them. Sign in as Diana Patel (Manager) to act.
          </AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-end gap-3 border-b p-3">
          {tab === "all" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {humanize(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="from" className="text-xs text-muted-foreground">
              Requested from
            </Label>
            <Input
              id="from"
              type="date"
              className="w-40"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-xs text-muted-foreground">
              Requested to
            </Label>
            <Input
              id="to"
              type="date"
              className="w-40"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          {(status !== "all" || from || to) && (
            <Button
              variant="ghost"
              onClick={() => {
                setStatus("all");
                setFrom("");
                setTo("");
              }}
            >
              Clear filters
            </Button>
          )}
          {badDates && (
            <span className="text-sm text-destructive">
              Start date is after end date.
            </span>
          )}
          <span className="ml-auto self-center text-sm text-muted-foreground">
            {active.data ? `${active.data.length} refunds` : ""}
          </span>
        </div>
        <RefundTable
          rows={active.data}
          loading={active.isLoading}
          busyId={act.isPending ? act.variables?.id : undefined}
          onAction={(kind, r) =>
            kind === "reject" ? setRejecting(r) : act.mutate({ kind, id: r.id })
          }
          emptyText={
            tab === "needs"
              ? "Nothing waiting on manager approval."
              : "No refunds match these filters."
          }
        />
      </Card>

      <ActionDialog
        open={rejecting !== null}
        onOpenChange={(o) => !o && setRejecting(null)}
        title={`Reject refund #${rejecting?.id ?? ""}`}
        description={
          rejecting
            ? `${fmtMoney(rejecting.refund_amount)} for ${rejecting.customer_name} (${rejecting.order_id})`
            : undefined
        }
        fieldLabel="Reason"
        placeholder="e.g. Outside the 30-day refund window"
        confirmLabel="Reject refund"
        confirmClassName="bg-destructive text-white hover:bg-destructive/90"
        pending={act.isPending}
        onConfirm={(reason) =>
          rejecting &&
          act.mutate({ kind: "reject", id: rejecting.id, reason: reason || undefined })
        }
      />
      <NewRefundDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function RefundTable({
  rows,
  loading,
  busyId,
  onAction,
  emptyText,
}: {
  rows?: RefundRequest[];
  loading: boolean;
  busyId?: number;
  onAction: (kind: RefundAction, r: RefundRequest) => void;
  emptyText: string;
}) {
  const { can } = useAuth();

  function actions(r: RefundRequest) {
    const busy = busyId === r.id;
    if (r.status === "requested" || r.status === "pending_approval") {
      if (can("refund:approve")) {
        return (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onAction("reject", r)}
            >
              Reject
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={busy}
              onClick={() => onAction("approve", r)}
            >
              Approve
            </Button>
          </>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" />
          Awaiting manager
        </span>
      );
    }
    if (r.status === "approved" && can("refund:process")) {
      return (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("process", r)}>
          Start processing
        </Button>
      );
    }
    if (r.status === "processing" && can("refund:process")) {
      return (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("complete", r)}>
          Mark completed
        </Button>
      );
    }
    if (r.status === "rejected" && r.rejection_reason) {
      return (
        <span
          className="block max-w-48 truncate text-xs text-muted-foreground"
          title={r.rejection_reason}
        >
          “{r.rejection_reason}”
        </span>
      );
    }
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Refund</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Requested</TableHead>
          <TableHead>Approved by</TableHead>
          <TableHead className="pr-4 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading &&
          Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell colSpan={8} className="px-4">
                <Skeleton className="h-8 w-full" />
              </TableCell>
            </TableRow>
          ))}
        {rows?.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
              {emptyText}
            </TableCell>
          </TableRow>
        )}
        {rows?.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="pl-4">
              <div className="font-medium">#{r.id}</div>
              <div className="font-mono text-xs text-muted-foreground">{r.order_id}</div>
            </TableCell>
            <TableCell>{r.customer_name}</TableCell>
            <TableCell>{humanize(r.reason)}</TableCell>
            <TableCell className="text-right tabular-nums">
              <div className="inline-flex items-center gap-1 font-medium">
                {r.requires_manager_approval && (
                  <span title="Over $500 — requires manager approval">
                    <ShieldAlert className="size-3.5 text-amber-600" />
                  </span>
                )}
                {fmtMoney(r.refund_amount)}
              </div>
              <div className="text-xs text-muted-foreground">
                of {fmtMoney(r.original_amount)}
              </div>
            </TableCell>
            <TableCell>
              <StatusBadge value={r.status} />
            </TableCell>
            <TableCell>
              <div>{fmtDate(r.requested_at)}</div>
              <div className="text-xs text-muted-foreground">by {r.requested_by}</div>
            </TableCell>
            <TableCell>
              {r.approved_by ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell className="pr-4">
              <div className="flex justify-end gap-2">{actions(r)}</div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const EMPTY_FORM = {
  customer_name: "",
  order_id: "",
  original_amount: "",
  refund_amount: "",
  reason: "damaged_item" as RefundReason,
};

function NewRefundDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  useEffect(() => {
    if (open) setForm(EMPTY_FORM);
  }, [open]);

  const orig = parseFloat(form.original_amount);
  const amt = parseFloat(form.refund_amount);
  const amountError =
    amt > 0 && orig > 0 && amt > orig
      ? "Refund can't exceed the original amount."
      : null;
  const valid =
    form.customer_name.trim() &&
    form.order_id.trim() &&
    orig > 0 &&
    amt > 0 &&
    !amountError;

  const create = useMutation({
    mutationFn: createRefund,
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["refunds"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      toast.success(
        row.status === "pending_approval"
          ? `Refund #${row.id} sent for manager approval`
          : `Refund #${row.id} requested`,
      );
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New refund request</DialogTitle>
          <DialogDescription>
            Requests over {fmtMoney(APPROVAL_THRESHOLD)} are routed to a manager.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="rf-name">Customer name</Label>
            <Input id="rf-name" value={form.customer_name} onChange={set("customer_name")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rf-order">Order ID</Label>
            <Input
              id="rf-order"
              placeholder="ORD-10234"
              value={form.order_id}
              onChange={set("order_id")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select
              value={form.reason}
              onValueChange={(v) => setForm({ ...form, reason: v as RefundReason })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {humanize(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rf-orig">Original amount ($)</Label>
            <Input
              id="rf-orig"
              type="number"
              min="0"
              step="0.01"
              value={form.original_amount}
              onChange={set("original_amount")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rf-amt">Refund amount ($)</Label>
            <Input
              id="rf-amt"
              type="number"
              min="0"
              step="0.01"
              value={form.refund_amount}
              onChange={set("refund_amount")}
              aria-invalid={!!amountError}
            />
          </div>
          {amountError && (
            <p className="col-span-2 text-sm text-destructive">{amountError}</p>
          )}
          {!amountError && amt > APPROVAL_THRESHOLD && (
            <p className="col-span-2 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <ShieldAlert className="size-4" />
              This refund will require manager approval.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid || create.isPending}
            onClick={() =>
              create.mutate({
                customer_name: form.customer_name.trim(),
                order_id: form.order_id.trim(),
                original_amount: orig,
                refund_amount: amt,
                reason: form.reason,
              })
            }
          >
            {create.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
