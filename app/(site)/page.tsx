import Link from "next/link";

import { PostCard } from "@/components/site/PostCard";
import { buttonVariants } from "@/components/ui/button";
import {
  getFeaturedPublishedPosts,
  getPublishedPosts,
  getPublishedPostsCount,
  getTagsForPublishedPosts,
  type PublishedPostSummary,
  type PublishedTag,
} from "@/lib/posts";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
const FEATURED_POST_LIMIT = 3;

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

const PAGE_HEADING = "Latest posts";
const PAGE_SUBTITLE = "Stay up to date with the newest stories and announcements.";

const getPageHref = (page: number): string => {
  if (page <= 1) {
    return "/";
  }

  return `/?page=${page}`;
};

type PostWithTags = PublishedPostSummary & {
  tags: PublishedTag[];
};

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams = {} }: HomePageProps) {
  const page = parsePageParam(searchParams.page);
  const offset = (page - 1) * PAGE_SIZE;

  const [featuredPosts, totalCount] = await Promise.all([
    getFeaturedPublishedPosts(FEATURED_POST_LIMIT),
    getPublishedPostsCount(),
  ]);

  const excludedPostIds = new Set(featuredPosts.map((post) => post.id));
  const posts = await getPublishedPosts({
    limit: PAGE_SIZE,
    offset,
    excludeIds: Array.from(excludedPostIds),
  });

  const combinedPosts = [...featuredPosts, ...posts];
  const uniquePostIds = Array.from(
    new Set(
      combinedPosts
        .map((post) => post.id)
        .filter((id) => typeof id === "number" && Number.isFinite(id) && id > 0),
    ),
  );

  const tagsByPost =
    uniquePostIds.length > 0 ? await getTagsForPublishedPosts(uniquePostIds) : new Map<number, PublishedTag[]>();

  const featuredCards: PostWithTags[] = featuredPosts.map((post) => ({
    ...post,
    tags: tagsByPost.get(post.id) ?? [],
  }));
  const listPosts: PostWithTags[] = posts.map((post) => ({
    ...post,
    tags: tagsByPost.get(post.id) ?? [],
  }));

  const feedTotalCount = Math.max(totalCount - excludedPostIds.size, 0);
  const totalPages = feedTotalCount > 0 ? Math.ceil(feedTotalCount / PAGE_SIZE) : 0;

  const hasPreviousPage = page > 1;
  const hasNextPage = totalPages > 0 ? page < totalPages : false;
  const showPagination = hasPreviousPage || hasNextPage;
  const hasFeedPosts = listPosts.length > 0;

  const emptyMessage = hasPreviousPage
    ? "No posts found for this page yet. Try going back to see more recent articles."
    : featuredCards.length
        ? "Explore our featured stories above while we publish more articles soon."
        : "No posts have been published yet. Please check back soon.";

  const disabledPaginationClassName = cn(buttonVariants({ variant: "outline" }), "pointer-events-none opacity-50");

  return (
    <main className="container mx-auto max-w-5xl space-y-10 px-4 py-12">
      <header className="space-y-2 text-center md:text-left">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{PAGE_HEADING}</h1>
        <p className="text-lg text-muted-foreground">{PAGE_SUBTITLE}</p>
      </header>

      {featuredCards.length ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Featured stories</h2>
            <p className="text-sm text-muted-foreground">Highlights curated by our editors.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {featuredCards.map((post, index) => (
              <div key={post.id} className={cn(index === 0 ? "md:col-span-3 lg:col-span-2" : undefined)}>
                <PostCard post={post} variant={index === 0 ? "featured" : "default"} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {hasFeedPosts ? (
        <section aria-label="Latest posts">
          <div className="grid gap-6 md:grid-cols-2">
            {listPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      ) : null}

      {!hasFeedPosts ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-12 text-center">
          <p className="text-base text-muted-foreground">{emptyMessage}</p>
          {hasPreviousPage ? (
            <div className="mt-6 flex justify-center">
              <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}>
                Back to first page
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {showPagination ? (
        <nav className="flex items-center justify-between pt-4" aria-label="Pagination">
          {hasPreviousPage ? (
            <Link href={getPageHref(page - 1)} className={buttonVariants({ variant: "outline" })}>
              Previous
            </Link>
          ) : (
            <span className={disabledPaginationClassName} aria-disabled="true">
              Previous
            </span>
          )}
          {hasNextPage ? (
            <Link href={getPageHref(page + 1)} className={buttonVariants({ variant: "outline" })}>
              Next
            </Link>
          ) : (
            <span className={disabledPaginationClassName} aria-disabled="true">
              Next
            </span>
          )}
        </nav>
      ) : null}
    </main>
  );
}
