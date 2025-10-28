import Link from "next/link";

import { getMostViewedPublishedPosts } from "@/lib/posts";
import { buildPostPath } from "@/lib/paths";
import { cn } from "@/lib/utils";

export interface PopularPostsWidgetProps {
  limit?: number;
  excludeIds?: ReadonlyArray<number>;
  className?: string;
  heading?: string;
}

const DEFAULT_HEADING = "热门文章";
const viewCountFormatter = new Intl.NumberFormat("zh-CN");

const formatViewCount = (value: number): string => {
  try {
    return viewCountFormatter.format(value);
  } catch {
    return `${value}`;
  }
};

export async function PopularPostsWidget({
  limit,
  excludeIds,
  className,
  heading = DEFAULT_HEADING,
}: PopularPostsWidgetProps) {
  const posts = await getMostViewedPublishedPosts({
    limit,
    excludeIds,
    includeCoverImageMetadata: false,
  });

  if (!Array.isArray(posts) || posts.length === 0) {
    return null;
  }

  return (
    <section className={cn("space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm", className)} aria-label={heading}>
      <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
      <ol className="space-y-3">
        {posts.map((post, index) => (
          <li key={post.id} className="flex items-start gap-3">
            <span className="mt-0.5 text-sm font-semibold text-muted-foreground">{index + 1}</span>
            <div className="flex-1 space-y-1">
              <Link
                href={buildPostPath(post.slug)}
                className="block text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {post.title}
              </Link>
              <span className="block text-xs text-muted-foreground">
                {formatViewCount(post.viewCount)} 次阅读
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
