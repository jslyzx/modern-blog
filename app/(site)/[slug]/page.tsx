import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getPublishedPostBySlug, getAdjacentPosts, getPublishedPostSlugs } from "@/lib/posts";
import { renderMarkdownWithKatex } from "@/lib/markdown-render";
import { createAbsoluteUrl, ensureAbsoluteUrl } from "@/lib/site";

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export async function generateStaticParams() {
  const slugs = await getPublishedPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  const title = post.title;
  const description = post.metaDescription || post.excerpt || "";
  const images = post.coverImageUrl ? [ensureAbsoluteUrl(post.coverImageUrl) ?? ""] : [];
  const canonical = post.canonicalUrl ? ensureAbsoluteUrl(post.canonicalUrl) : createAbsoluteUrl(`/${slug}`);

  return {
    title,
    description,
    openGraph: {
      type: "article",
      title,
      description,
      images,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt?.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
    alternates: {
      canonical,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const htmlContent = await renderMarkdownWithKatex(post.content);
  const adjacentPosts = await getAdjacentPosts(post.id);

  return (
    <article className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-3xl">
        {post.coverImageUrl && (
          <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-lg">
            <Image
              src={post.coverImageUrl}
              alt={post.title}
              fill
              className="object-cover"
            />
          </div>
        )}

        <header className="mb-8">
          <h1 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {post.publishedAt && (
              <time dateTime={post.publishedAt.toISOString()}>
                {formatDate(post.publishedAt)}
              </time>
            )}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full bg-muted px-3 py-1 text-xs font-medium"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </header>

        <div
          className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-bold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-pre:bg-muted"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        <footer className="mt-12 border-t pt-8">
          <nav className="flex flex-col gap-4 sm:flex-row sm:justify-between">
            {adjacentPosts.previous ? (
              <Link
                href={`/${adjacentPosts.previous.slug}`}
                className="group flex flex-col gap-1 rounded-lg border p-4 transition-colors hover:border-primary"
              >
                <span className="text-sm text-muted-foreground">← Previous</span>
                <span className="font-semibold group-hover:text-primary">
                  {adjacentPosts.previous.title}
                </span>
              </Link>
            ) : (
              <div />
            )}
            {adjacentPosts.next ? (
              <Link
                href={`/${adjacentPosts.next.slug}`}
                className="group flex flex-col gap-1 rounded-lg border p-4 text-right transition-colors hover:border-primary sm:ml-auto"
              >
                <span className="text-sm text-muted-foreground">Next →</span>
                <span className="font-semibold group-hover:text-primary">
                  {adjacentPosts.next.title}
                </span>
              </Link>
            ) : (
              <div />
            )}
          </nav>
        </footer>
      </div>
    </article>
  );
}
