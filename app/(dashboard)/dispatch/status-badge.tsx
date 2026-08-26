import { Badge } from "@/components/ui/badge";

const MAP: Record<string, { variant: "warning" | "default" | "success" | "destructive" | "secondary"; label: string }> = {
  PENDING: { variant: "secondary", label: "Pending" },
  PROCESSING: { variant: "default", label: "Processing" },
  READY: { variant: "warning", label: "Ready" },
  DISPATCHED: { variant: "success", label: "Dispatched" },
  CANCELLED: { variant: "destructive", label: "Cancelled" },
};

export function DispatchStatusBadge({ status }: { status: string }) {
  const cfg = MAP[status] ?? { variant: "secondary" as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
