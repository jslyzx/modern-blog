import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublishedPostSummary } from "@/lib/posts";
import { markdownToPlainText, truncateWords } from "@/lib/markdown-render";

interface PostCardProps {
  post: PublishedPostSummary;
  featured?: boolean;
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function PostCard({ post, featured = false }: PostCardProps) {
  const excerpt = post.excerpt || truncateWords(markdownToPlainText(post.content), 30);

  return (
    <Card className={featured ? "border-primary" : ""}>
      {post.coverImageUrl && (
        <div className="relative aspect-video w-full overflow-hidden rounded-t-lg">
          <Image
            src={post.coverImageUrl}
            alt={post.title}
            fill
            className="object-cover transition-transform hover:scale-105"
          />
        </div>
      )}
      <CardHeader>
        <div className="flex items-center gap-2">
          {featured && (
            <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              Featured
            </span>
          )}
          {post.publishedAt && (
            <span className="text-sm text-muted-foreground">{formatDate(post.publishedAt)}</span>
          )}
        </div>
        <CardTitle className="line-clamp-2">
          <Link href={`/${post.slug}`} className="hover:underline">
            {post.title}
          </Link>
        </CardTitle>
      </CardHeader>
      {excerpt && (
        <CardContent>
          <p className="line-clamp-3 text-sm text-muted-foreground">{excerpt}</p>
        </CardContent>
      )}
      <CardFooter>
        <Link
          href={`/${post.slug}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Read more →
        </Link>
      </CardFooter>
    </Card>
  );
}
