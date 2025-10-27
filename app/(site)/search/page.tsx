import type { Metadata } from "next";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildPostPath } from "@/lib/paths";
import { createAbsoluteUrlFromConfig, getSiteConfig } from "@/lib/site";
import {
  sanitizeSearchQuery,
  searchPublishedPosts,
  type SearchResultPost,
} from "@/lib/site/search";
import { cn } from "@/lib/utils";

const RESULTS_PER_PAGE = 10;

type SearchPageProps = {
  searchParams?: {
    q?: string | string[];
    page?: string | string[];
  };
};

const parseSingleValue = (value?: string | string[]): string => {
  if (Array.isArray(value)) {
    return parseSingleValue(value[0]);
  }

  return value ?? "";
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

const getDisplayDate = (post: SearchResultPost): Date | null => post.publishedAt ?? post.createdAt ?? null;

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

const buildSearchHref = (query: string, page: number): string => {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const search = params.toString();

  return search ? `/search?${search}` : "/search";
};

function SearchResultCard({ post }: { post: SearchResultPost }) {
  const date = getDisplayDate(post);
  const dateLabel = formatDateLabel(date);
  const summary = post.summary ?? "";
  const tags = post.tags;
  const slug = post.slug.trim();
  const containerClassName =
    "group block overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";

  const content = (
    <div className="flex h-full flex-col space-y-4 p-6">
      <h3 className="text-xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
        {post.title}
      </h3>
      {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null}
      <div className="mt-auto space-y-2 text-sm text-muted-foreground">
        {dateLabel && date ? (
          <div>
            <time dateTime={date.toISOString()}>{dateLabel}</time>
          </div>
        ) : null}
        {tags.length ? (
          <ul className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-primary">
            {tags.map((tag) => (
              <li key={tag.id} className="rounded-full bg-primary/10 px-3 py-1">
                #{tag.name}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
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

function SearchResultsList({ posts }: { posts: SearchResultPost[] }) {
  return (
    <ul className="space-y-6">
      {posts.map((post) => (
        <li key={post.id}>
          <SearchResultCard post={post} />
        </li>
      ))}
    </ul>
  );
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams = {} }: SearchPageProps): Promise<Metadata> {
  const rawQuery = parseSingleValue(searchParams.q);
  const query = sanitizeSearchQuery(rawQuery);
  const rawPage = parsePageParam(searchParams.page);
  const page = query ? rawPage : 1;

  const baseTitle = query ? `Search results for “${query}”` : "Search";
  const title = page > 1 ? `${baseTitle} – Page ${page}` : baseTitle;
  const description = query ? `Browse published posts matching “${query}”.` : "Search published posts by title or summary.";
  const canonicalPath = buildSearchHref(query, page);
  const site = await getSiteConfig();
  const canonicalUrl = createAbsoluteUrlFromConfig(site, canonicalPath);

  return {
    title,
    description,
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function SearchPage({ searchParams = {} }: SearchPageProps) {
  const query = sanitizeSearchQuery(parseSingleValue(searchParams.q));
  const rawPage = parsePageParam(searchParams.page);
  const page = query ? rawPage : 1;
  const offset = (page - 1) * RESULTS_PER_PAGE;

  const { posts, hasMore } = query
    ? await searchPublishedPosts({ query, limit: RESULTS_PER_PAGE, offset })
    : { posts: [], hasMore: false };

  const hasResults = posts.length > 0;
  const showPagination = Boolean(query) && (page > 1 || hasMore);
  const emptyMessage = query
    ? page > 1
      ? "No results found on this page. Try going back to see earlier matches."
      : `No posts matched “${query}”. Try a different keyword.`
    : "Enter a keyword to search published posts.";

  return (
    <main className="container mx-auto max-w-4xl space-y-10 px-4 py-12">
      <header className="space-y-2 text-center md:text-left">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Search</h1>
        <p className="text-lg text-muted-foreground">Find published posts by title or summary.</p>
      </header>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <form action="/search" method="get" className="flex flex-col gap-3 md:flex-row">
          <label htmlFor="site-search" className="sr-only">
            Search posts
          </label>
          <Input
            id="site-search"
            type="search"
            name="q"
            placeholder="Search posts..."
            defaultValue={query}
            aria-label="Search posts"
          />
          <Button type="submit" className="w-full md:w-auto md:self-start">
            Search
          </Button>
        </form>
      </section>

      {hasResults ? <SearchResultsList posts={posts} /> : null}

      {!hasResults ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-12 text-center">
          <p className="text-base text-muted-foreground">{emptyMessage}</p>
          {query && page > 1 ? (
            <div className="mt-6 flex justify-center">
              <Link
                href={buildSearchHref(query, 1)}
                className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
              >
                Back to first page
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {showPagination ? (
        <nav className="flex items-center justify-between pt-4">
          {page > 1 ? (
            <Link href={buildSearchHref(query, page - 1)} className={buttonVariants({ variant: "outline" })}>
              Previous
            </Link>
          ) : (
            <span />
          )}
          {hasMore ? (
            <Link href={buildSearchHref(query, page + 1)} className={buttonVariants({ variant: "outline" })}>
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
