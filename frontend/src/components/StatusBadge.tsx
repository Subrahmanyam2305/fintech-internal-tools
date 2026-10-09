import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tone = "gray" | "blue" | "amber" | "green" | "red" | "violet";

const TONES: Record<Tone, string> = {
  gray: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

const VALUE_TONES: Record<string, Tone> = {
  pending: "amber",
  in_review: "blue",
  approved: "green",
  rejected: "red",
  needs_more_info: "violet",
  requested: "gray",
  pending_approval: "amber",
  processing: "blue",
  completed: "green",
  low: "green",
  medium: "amber",
  high: "red",
  production: "red",
  staging: "amber",
  dev: "gray",
};

export function StatusBadge({
  value,
  label,
  dot = false,
  className,
}: {
  value: string;
  label?: string;
  dot?: boolean;
  className?: string;
}) {
  const tone = VALUE_TONES[value] ?? "gray";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {label ?? humanize(value)}
    </span>
  );
}
