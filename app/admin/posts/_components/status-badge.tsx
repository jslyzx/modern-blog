import { cn } from "@/lib/utils";
import type { PostStatus } from "@/types/post";

const STATUS_STYLES: Record<PostStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300",
  archived: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
};

const formatStatusLabel = (status: PostStatus): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export function StatusBadge({ status, className }: { status: PostStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        STATUS_STYLES[status],
        className,
      )}
    >
      {formatStatusLabel(status)}
    </span>
  );
}
