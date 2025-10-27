import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { htmlToPlainText, truncateWords } from "@/lib/markdown";
import { getPublishedPosts, type PublishedPostSummary } from "@/lib/posts";
import { buildPostPath } from "@/lib/paths";
import { ensureAbsoluteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type HomePageProps = {
  searchParams?: {
    page?: string | string[];
  };
};

const parsePageParam = (value?: string | string[]): number => {
  if (Array.isArray(value)) {
    return parsePageParam(value[0]);
  }

  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

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

function FeaturedPost({ post }: { post: PublishedPostSummary }) {
  const summary = getSummary(post);
  const coverImage = getCoverImage(post);
  const date = getDateForPost(post);
  const dateLabel = formatDateLabel(date);
  const slug = post.slug.trim();
  const hasSlug = slug.length > 0;
  const containerClassName =
    "group block overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-primary/40 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";

  const content = (
    <>
      {coverImage ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          <img
            src={coverImage}
            alt={post.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      ) : null}
      <div className="space-y-4 p-8">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          Featured
        </span>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
          {post.title}
        </h2>
        {summary ? <p className="text-base text-muted-foreground">{summary}</p> : null}
        {dateLabel && date ? (
          <div className="text-sm text-muted-foreground">
            <time dateTime={date.toISOString()}>{dateLabel}</time>
          </div>
        ) : null}
      </div>
    </>
  );

  if (!hasSlug) {
    return <article className={containerClassName}>{content}</article>;
  }

  return (
    <Link href={buildPostPath(slug)} className={containerClassName}>
      {content}
    </Link>
  );
}

function PostCard({ post }: { post: PublishedPostSummary }) {
  const summary = getSummary(post);
  const coverImage = getCoverImage(post);
  const date = getDateForPost(post);
  const dateLabel = formatDateLabel(date);
  const slug = post.slug.trim();
  const hasSlug = slug.length > 0;
  const containerClassName =
    "group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";

  const content = (
    <>
      {coverImage ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          <img
            src={coverImage}
            alt={post.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col space-y-3 p-6">
        <h3 className="text-xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
          {post.title}
        </h3>
        {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null}
        {dateLabel && date ? (
          <div className="mt-auto text-sm text-muted-foreground">
            <time dateTime={date.toISOString()}>{dateLabel}</time>
          </div>
        ) : null}
      </div>
    </>
  );

  if (!hasSlug) {
    return <article className={containerClassName}>{content}</article>;
  }

  return (
    <Link href={buildPostPath(slug)} className={containerClassName}>
      {content}
    </Link>
  );
}

const PAGE_HEADING = "Latest posts";
const PAGE_SUBTITLE = "Stay up to date with the newest stories and announcements.";

const getPageHref = (page: number): string => {
  if (page <= 1) {
    return "/";
  }

  return `/?page=${page}`;
};

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams = {} }: HomePageProps) {
  const page = parsePageParam(searchParams.page);
  const offset = (page - 1) * PAGE_SIZE;

  const posts = await getPublishedPosts({ limit: PAGE_SIZE, offset });

  const featuredPost = posts.find((post) => post.isFeatured);
  const listPosts = featuredPost ? posts.filter((post) => post.id !== featuredPost.id) : posts;

  const hasPosts = posts.length > 0;
  const hasNextPage = posts.length === PAGE_SIZE;
  const showPagination = page > 1 || hasNextPage;

  const emptyMessage =
    page > 1
      ? "No posts found for this page yet. Try going back to see more recent articles."
      : "No posts have been published yet. Please check back soon.";

  return (
    <main className="container mx-auto max-w-5xl space-y-10 px-4 py-12">
      <header className="space-y-2 text-center md:text-left">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{PAGE_HEADING}</h1>
        <p className="text-lg text-muted-foreground">{PAGE_SUBTITLE}</p>
      </header>

      {featuredPost ? <FeaturedPost post={featuredPost} /> : null}

      {listPosts.length ? (
        <div className="grid gap-6 md:grid-cols-2">
          {listPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : null}

      {!hasPosts ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-12 text-center">
          <p className="text-base text-muted-foreground">{emptyMessage}</p>
          {page > 1 ? (
            <div className="mt-6 flex justify-center">
              <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}>
                Back to first page
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {showPagination ? (
        <nav className="flex items-center justify-between pt-4">
          {page > 1 ? (
            <Link href={getPageHref(page - 1)} className={buttonVariants({ variant: "outline" })}>
              Previous
            </Link>
          ) : (
            <span />
          )}
          {hasNextPage ? (
            <Link href={getPageHref(page + 1)} className={buttonVariants({ variant: "outline" })}>
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
