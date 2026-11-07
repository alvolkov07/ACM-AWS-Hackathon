import { cn } from "@/lib/utils";
import type { ServiceRequestStatus } from "@/lib/db/schemas/service-request";

const styles: Record<ServiceRequestStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  matching: "bg-amber-100 text-amber-900",
  matched: "bg-sky-100 text-sky-900",
  contacting: "bg-violet-100 text-violet-900",
  done: "bg-emerald-100 text-emerald-900",
};

export function StatusBadge({ status }: { status: ServiceRequestStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}
