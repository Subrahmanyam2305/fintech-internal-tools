import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  FileText,
  Info,
  MessageSquareMore,
  X,
} from "lucide-react";

import { useAuth } from "@/auth/AuthContext";
import { ROLE_LABELS } from "@/auth/permissions";
import { ActionDialog } from "@/components/ActionDialog";
import { AuditTrail } from "@/components/AuditTrail";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  approveKyc,
  claimKyc,
  getKycSubmission,
  rejectKyc,
  requestKycInfo,
} from "@/lib/api";
import {
  errorMessage,
  fmtDateTime,
  fmtDuration,
  fmtRelative,
  humanize,
} from "@/lib/format";

type ActionKind = "approve" | "reject" | "info";

const SUCCESS: Record<ActionKind, string> = {
  approve: "Submission approved",
  reject: "Submission rejected",
  info: "More information requested from customer",
};

function docLabel(url: string) {
  const name = url.split("/").pop()?.replace(/\.svg$/, "") ?? url;
  return humanize(name.replace(/_\d+$/, ""));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 break-words">{children}</dd>
    </div>
  );
}

export default function KycDetail() {
  const id = Number(useParams().id);
  const { currentUser, can } = useAuth();
  const qc = useQueryClient();
  const detailKey = ["kyc-detail", id];
  const [dialog, setDialog] = useState<ActionKind | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const claimAttempted = useRef<number | null>(null);

  const q = useQuery({
    queryKey: detailKey,
    queryFn: () => getKycSubmission(id),
    enabled: Number.isFinite(id),
  });
  const row = q.data;

  const refreshRelated = () => {
    qc.invalidateQueries({ queryKey: ["kyc-list"] });
    qc.invalidateQueries({ queryKey: ["kyc-stats"] });
    qc.invalidateQueries({ queryKey: ["audit"] });
  };

  // Auto-assign: an analyst opening a pending item claims it (→ in_review).
  useEffect(() => {
    if (!row || claimAttempted.current === id) return;
    claimAttempted.current = id;
    if (row.status !== "pending" || currentUser?.role !== "analyst") return;
    claimKyc(id)
      .then((updated) => {
        qc.setQueryData(detailKey, updated);
        refreshRelated();
        if (updated.status === "in_review") {
          toast.success("Assigned to you", {
            description: `${updated.customer_name} moved to In review.`,
          });
        }
      })
      .catch((e) => toast.error(errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, id, currentUser]);

  const action = useMutation({
    mutationFn: ({ kind, text }: { kind: ActionKind; text: string }) =>
      kind === "approve"
        ? approveKyc(id, text || undefined)
        : kind === "reject"
          ? rejectKyc(id, text)
          : requestKycInfo(id, text || undefined),
    onSuccess: (updated, { kind }) => {
      qc.setQueryData(detailKey, updated);
      refreshRelated();
      setDialog(null);
      toast.success(SUCCESS[kind]);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const back = (
    <Button variant="ghost" size="sm" className="-ml-2 mb-4" asChild>
      <Link to="/kyc">
        <ArrowLeft />
        Back to queue
      </Link>
    </Button>
  );

  if (q.isLoading) {
    return (
      <div>
        {back}
        <Skeleton className="mb-4 h-10 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (q.isError || !row) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return (
      <div>
        {back}
        <Alert>
          <CircleAlert />
          <AlertTitle>
            {notFound ? "Submission not found" : "Could not load submission"}
          </AlertTitle>
          <AlertDescription>{errorMessage(q.error)}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const terminal = row.status === "approved" || row.status === "rejected";
  const canReview = can("kyc:review");
  const pending = action.isPending;

  return (
    <div>
      {back}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {row.customer_name}
            </h1>
            <StatusBadge value={row.status} />
            <StatusBadge
              value={row.risk_level}
              label={`${humanize(row.risk_level)} risk`}
              dot
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            KYC-{String(row.id).padStart(4, "0")} · Submitted{" "}
            {fmtDateTime(row.submitted_at)} ({fmtRelative(row.submitted_at)})
          </p>
        </div>
        {canReview && !terminal && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setDialog("info")}
            >
              <MessageSquareMore />
              Request more info
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => setDialog("reject")}
            >
              <X />
              Reject
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={pending}
              onClick={() => setDialog("approve")}
            >
              <Check />
              Approve
            </Button>
          </div>
        )}
      </div>

      {terminal && (
        <Alert className="mb-6">
          {row.status === "approved" ? <Check /> : <X />}
          <AlertTitle>
            {humanize(row.status)} by {row.reviewed_by ?? "unknown"}
          </AlertTitle>
          <AlertDescription>
            Decision recorded {fmtDateTime(row.reviewed_at)}. This submission is
            closed and can no longer be changed.
          </AlertDescription>
        </Alert>
      )}
      {!canReview && !terminal && currentUser && (
        <Alert className="mb-6">
          <Info />
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>
            {ROLE_LABELS[currentUser.role]}s can view KYC submissions, but only
            Analysts and Managers can review them.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {row.document_urls.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No documents uploaded.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {row.document_urls.map((url) => (
                    <button
                      key={url}
                      onClick={() => setPreview(url)}
                      className="group overflow-hidden rounded-lg border text-left transition hover:shadow-md"
                    >
                      <img
                        src={url}
                        alt={docLabel(url)}
                        className="aspect-[16/11] w-full bg-muted object-cover"
                      />
                      <div className="flex items-center gap-2 border-t px-3 py-2 text-sm">
                        <FileText className="size-4 text-muted-foreground" />
                        {docLabel(url)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Review notes</CardTitle>
            </CardHeader>
            <CardContent>
              {row.notes ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {row.notes}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <Field label="Name">{row.customer_name}</Field>
                <Field label="Email">{row.customer_email}</Field>
                <Field label="Country">{row.country}</Field>
                <Field label="Risk level">
                  <StatusBadge value={row.risk_level} dot />
                </Field>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <Field label="Reviewer">
                  {row.reviewed_by ?? (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </Field>
                <Field label="Decided">{fmtDateTime(row.reviewed_at)}</Field>
                <Field label={terminal ? "Review time" : "In queue"}>
                  {fmtDuration(row.submitted_at, terminal ? row.reviewed_at : null)}
                </Field>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTrail entityType="kyc_submission" entityId={row.id} />
            </CardContent>
          </Card>
        </div>
      </div>

      <ActionDialog
        open={dialog === "approve"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Approve submission"
        description={`Approve ${row.customer_name}'s identity verification.`}
        fieldLabel="Approval notes"
        placeholder="e.g. Documents verified against passport registry"
        confirmLabel="Approve"
        confirmClassName="bg-emerald-600 text-white hover:bg-emerald-700"
        pending={pending}
        onConfirm={(text) => action.mutate({ kind: "approve", text })}
      />
      <ActionDialog
        open={dialog === "reject"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Reject submission"
        description="Rejection is final. A reason is required for compliance."
        fieldLabel="Rejection reason"
        placeholder="e.g. Document appears altered; name mismatch with proof of address"
        required
        confirmLabel="Reject submission"
        confirmClassName="bg-destructive text-white hover:bg-destructive/90"
        pending={pending}
        onConfirm={(text) => action.mutate({ kind: "reject", text })}
      />
      <ActionDialog
        open={dialog === "info"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Request more information"
        description="The submission moves to Needs more info until the customer responds."
        fieldLabel="Message to customer"
        placeholder="e.g. Please upload a proof of address dated within the last 3 months"
        confirmLabel="Send request"
        pending={pending}
        onConfirm={(text) => action.mutate({ kind: "info", text })}
      />

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview ? docLabel(preview) : ""}</DialogTitle>
          </DialogHeader>
          {preview && (
            <img src={preview} alt="" className="w-full rounded-md border" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
