import { FlaskConical } from "lucide-react";

export function DemoBanner() {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-900"
    >
      <FlaskConical className="size-4" />
      Demo environment — synthetic data, simulated identity, no real payments.
    </div>
  );
}
