import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { getAuditLog } from "@/lib/api";
import { fmtDateTime, fmtRelative, humanize } from "@/lib/format";
import type { EntityType } from "@/types";

export function AuditValue({ value }: { value: string | null }) {
  if (value === null) return <span className="text-muted-foreground italic">empty</span>;
  let display = value;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(value)) {
    const iso = value.replace(" ", "T");
    display = fmtDateTime(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`);
  } else if (value === "True" || value === "False") {
    display = value.toLowerCase();
  }
  const short = display.length > 60 ? `${display.slice(0, 60)}…` : display;
  return (
    <code
      title={value}
      className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground"
    >
      {short}
    </code>
  );
}

export function AuditTrail({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: number;
}) {
  const q = useQuery({
    queryKey: ["audit", entityType, entityId],
    queryFn: () =>
      getAuditLog({ entity_type: entityType, entity_id: entityId, limit: 50 }),
  });

  if (q.isLoading) return <Skeleton className="h-16 w-full" />;
  if (!q.data?.length)
    return <p className="text-sm text-muted-foreground">No changes recorded yet.</p>;

  return (
    <ol className="relative space-y-4 border-l pl-4">
      {q.data.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-muted-foreground/40 ring-4 ring-card" />
          <p className="text-sm">
            <span className="font-medium">{e.user_name}</span>{" "}
            <span className="text-muted-foreground">set</span>{" "}
            <span className="font-medium">{humanize(e.field)}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
            <AuditValue value={e.previous_value} />
            <span className="text-muted-foreground">→</span>
            <AuditValue value={e.new_value} />
          </p>
          <p
            className="mt-1 text-xs text-muted-foreground"
            title={fmtDateTime(e.created_at)}
          >
            {fmtRelative(e.created_at)} · {e.action}
          </p>
        </li>
      ))}
    </ol>
  );
}
