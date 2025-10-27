import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { htmlToPlainText, truncateWords } from "@/lib/markdown";
import type { PublishedPostSummary, PublishedTag } from "@/lib/posts";
import { buildPostPath } from "@/lib/paths";
import { ensureAbsoluteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

type PostCardVariant = "default" | "featured";

type PostCardPost = PublishedPostSummary & {
  tags?: PublishedTag[];
};

export interface PostCardProps {
  post: PostCardPost;
  variant?: PostCardVariant;
}

const getSummary = (post: PublishedPostSummary): string => {
  const summary = post.summary?.trim();

  if (summary) {
    return summary;
  }

  const plainText = htmlToPlainText(post.contentHtml);

  return truncateWords(plainText, 40);
};

const getDateForPost = (post: PublishedPostSummary): Date | null => post.publishedAt ?? post.createdAt ?? null;

const formatDateLabel = (date: Date | null): string | null => {
  if (!date) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
  } catch (error) {
    console.warn("Failed to format date", { error });
    return date.toISOString();
  }
};

const getCoverImage = (post: PublishedPostSummary): string | null => ensureAbsoluteUrl(post.coverImageUrl);

const getSlugForPost = (post: PublishedPostSummary): string | null => {
  const slug = post.slug.trim();

  return slug.length > 0 ? slug : null;
};

export function PostCard({ post, variant = "default" }: PostCardProps) {
  const summary = getSummary(post);
  const hasSummary = summary.trim().length > 0;
  const coverImage = getCoverImage(post);
  const date = getDateForPost(post);
  const dateLabel = formatDateLabel(date);
  const slug = getSlugForPost(post);
  const tags = (post.tags ?? []).filter((tag) => Boolean(tag?.name?.trim()));
  const hasTags = tags.length > 0;
  const hasMeta = hasTags || (date && dateLabel);

  const containerClassName = cn(
    "group overflow-hidden border border-border bg-card transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    variant === "featured"
      ? "block rounded-2xl shadow-sm hover:shadow-lg"
      : "flex h-full flex-col rounded-xl hover:shadow-md",
  );

  const contentClassName = cn(
    "flex flex-col",
    variant === "featured" ? "space-y-5 p-8" : "flex-1 space-y-3 p-6",
  );

  const titleClassName =
    variant === "featured"
      ? "text-3xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary"
      : "text-xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary";

  const summaryClassName =
    variant === "featured" ? "text-base text-muted-foreground" : "text-sm text-muted-foreground";

  const metaWrapperClassName = cn(
    "space-y-3",
    variant === "featured" ? "mt-4" : "mt-auto",
  );

  const coverWrapperClassName = "relative aspect-[16/9] w-full overflow-hidden bg-muted";

  const imageSizes =
    variant === "featured"
      ? "(max-width: 768px) 100vw, (min-width: 1280px) 66vw, (min-width: 1024px) 75vw, 100vw"
      : "(max-width: 768px) 100vw, (min-width: 1024px) 45vw, 100vw";

  const content = (
    <>
      {coverImage ? (
        <div className={coverWrapperClassName}>
          <Image
            src={coverImage}
            alt={post.title}
            fill
            sizes={imageSizes}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105"
            priority={variant === "featured"}
          />
        </div>
      ) : null}
      <div className={contentClassName}>
        {variant === "featured" ? (
          <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            Featured
          </span>
        ) : null}
        <h3 className={titleClassName}>{post.title}</h3>
        {hasSummary ? <p className={summaryClassName}>{summary}</p> : null}
        {hasMeta ? (
          <div className={metaWrapperClassName}>
            {hasTags ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag.id} variant="outline">
                    {tag.name.trim()}
                  </Badge>
                ))}
              </div>
            ) : null}
            {date && dateLabel ? (
              <div className="text-sm text-muted-foreground">
                <time dateTime={date.toISOString()}>{dateLabel}</time>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );

  if (!slug) {
    return <article className={containerClassName}>{content}</article>;
  }

  return (
    <Link href={buildPostPath(slug)} className={containerClassName}>
      {content}
    </Link>
  );
}
