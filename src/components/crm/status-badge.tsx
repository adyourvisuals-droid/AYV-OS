import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  brand: "bg-primary/10 text-primary",
};

const STATUS_TONE: Record<string, keyof typeof TONE_CLASSES> = {
  NEW: "info",
  CONTACTED: "brand",
  QUALIFIED: "success",
  UNQUALIFIED: "neutral",
  CONVERTED: "success",
  OPEN: "info",
  IN_PROGRESS: "brand",
  DONE: "success",
  CANCELLED: "neutral",
  WON: "success",
  LOST: "danger",
  DRAFT: "neutral",
  SENT: "brand",
  VIEWED: "info",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "warning",
  SIGNED: "success",
  TERMINATED: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <Badge className={cn("font-medium capitalize", TONE_CLASSES[tone])} variant="outline">
      {status.replaceAll("_", " ").toLowerCase()}
    </Badge>
  );
}
