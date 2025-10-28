import { PostCard } from "@/components/site/PostCard";
import type { RelatedPost } from "@/lib/site/related-posts";
import { cn } from "@/lib/utils";

export interface RelatedPostsProps {
  posts: RelatedPost[];
  title?: string;
  className?: string;
}

const DEFAULT_TITLE = "Related posts";

export function RelatedPosts({
  posts,
  title = DEFAULT_TITLE,
  className,
}: RelatedPostsProps) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return null;
  }

  return (
    <section className={cn("not-prose space-y-6", className)} aria-label={title}>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
