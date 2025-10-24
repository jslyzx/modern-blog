import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublishedPostsByTagId } from "@/lib/posts";
import { getTagBySlug } from "@/lib/tags";

export const revalidate = 0;

const PAGE_SIZE = 10;

type PageProps = {
  params: {
    slug: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
};

const parsePageParam = (value: string | string[] | undefined): number => {
  const normalized = Array.isArray(value) ? value[0] : value;
  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 1;
  }

  return parsed;
};

const formatDate = (value: string | null): string => {
  if (!value) {
    return "Unpublished";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Unpublished";
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export default async function TagPostsPage({ params, searchParams }: PageProps) {
  const slug = params.slug;
  const page = parsePageParam(searchParams?.page);

  const tag = await getTagBySlug(slug);

  if (!tag) {
    notFound();
  }

  const { posts, total, pageSize } = await getPublishedPostsByTagId(tag.id, {
    page,
    pageSize: PAGE_SIZE,
  });

  if (posts.length === 0 && page > 1) {
    notFound();
  }

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

  const buildPageHref = (pageNumber: number) => {
    if (pageNumber <= 1) {
      return `/tag/${tag.slug}`;
    }

    return `/tag/${tag.slug}?page=${pageNumber}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tag
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{tag.name}</h1>
        <p className="text-sm text-muted-foreground">
          Showing published posts tagged with <span className="font-medium">#{tag.slug}</span>.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-md border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          No published posts are associated with this tag yet.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {posts.map((post) => (
            <article key={post.id} className="flex flex-col gap-3 rounded-md border bg-card/50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {formatDate(post.publishedAt)}
                </p>
                {post.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tagItem) => (
                      <span
                        key={tagItem.id}
                        className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                      >
                        #{tagItem.slug}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Link href={`/posts/${post.slug}`} className="text-lg font-semibold underline-offset-4 hover:underline">
                  {post.title}
                </Link>
                {post.excerpt ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-3">
            <Link
              href={buildPageHref(Math.max(1, page - 1))}
              className={`inline-flex items-center rounded-md border px-3 py-2 transition ${
                page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-accent"
              }`}
              aria-disabled={page <= 1}
            >
              Previous
            </Link>
            <Link
              href={buildPageHref(Math.min(totalPages, page + 1))}
              className={`inline-flex items-center rounded-md border px-3 py-2 transition ${
                page >= totalPages ? "pointer-events-none opacity-50" : "hover:bg-accent"
              }`}
              aria-disabled={page >= totalPages}
            >
              Next
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
