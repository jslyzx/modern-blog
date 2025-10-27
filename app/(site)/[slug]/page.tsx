import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { TableOfContents } from "@/components/site/TableOfContents";
import { htmlToPlainText, renderPostContent, truncateWords } from "@/lib/markdown";
import { countTocItems, generateToc } from "@/lib/toc";
import { buildPostPath } from "@/lib/paths";
import {
  buildPostUrl,
  createAbsoluteUrl,
  ensureAbsoluteUrl,
  getOgImageFallback,
  getSiteDescription,
  getSiteName,
} from "@/lib/site";
import {
  getPublishedPostBySlug,
  getPublishedPostSlugs,
  type PublishedPost,
} from "@/lib/posts";
import { isNormalizedSlug, toPinyinSlug } from "@/lib/slug";

type PostPageProps = {
  params: {
    slug: string;
  };
};

const decodeSlugValue = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

type ResolvedPostResult = {
  post: PublishedPost | null;
  redirectSlug: string | null;
};

const resolvePost = cache(async (rawSlug: string): Promise<ResolvedPostResult> => {
  const directPost = await getPublishedPostBySlug(rawSlug);

  if (directPost) {
    const needsRedirect = directPost.slug !== rawSlug && directPost.slug.trim().length > 0;

    return {
      post: directPost,
      redirectSlug: needsRedirect ? directPost.slug : null,
    };
  }

  const decodedSlug = decodeSlugValue(rawSlug);

  if (!decodedSlug) {
    return { post: null, redirectSlug: null };
  }

  const normalizedDecoded = decodedSlug.trim();

  if (!normalizedDecoded) {
    return { post: null, redirectSlug: null };
  }

  if (decodedSlug === rawSlug && isNormalizedSlug(rawSlug)) {
    return { post: null, redirectSlug: null };
  }

  const candidateSlug = toPinyinSlug(decodedSlug);

  if (!candidateSlug || candidateSlug === rawSlug) {
    return { post: null, redirectSlug: null };
  }

  const fallbackPost = await getPublishedPostBySlug(candidateSlug);

  if (!fallbackPost) {
    return { post: null, redirectSlug: null };
  }

  const needsRedirect = fallbackPost.slug !== rawSlug;

  return {
    post: fallbackPost,
    redirectSlug: needsRedirect ? fallbackPost.slug : null,
  };
});

const loadPostOrRedirect = async (slug: string): Promise<PublishedPost> => {
  const { post, redirectSlug } = await resolvePost(slug);

  if (redirectSlug) {
    const target = buildPostPath(redirectSlug);
    permanentRedirect(target);
  }

  if (!post) {
    notFound();
  }

  return post;
};

const getPostContentSource = (post: PublishedPost): string => {
  if (post.contentHtml.trim().length > 0) {
    return post.contentHtml;
  }

  if (post.contentMd && post.contentMd.trim().length > 0) {
    return post.contentMd;
  }

  return "";
};

export async function generateStaticParams() {
  const slugs = await getPublishedPostSlugs();

  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const post = await loadPostOrRedirect(params.slug);

  const siteName = getSiteName();
  const fallbackDescription = getSiteDescription();
  const postContent = getPostContentSource(post);
  const renderedHtml = await renderPostContent(postContent);
  const plainTextContent = htmlToPlainText(renderedHtml);
  const summary = post.summary?.trim();
  const description = summary || truncateWords(plainTextContent, 40) || fallbackDescription;

  const canonicalUrl =
    ensureAbsoluteUrl(buildPostUrl(post.slug)) ?? createAbsoluteUrl(buildPostPath(post.slug));
  const coverImage = ensureAbsoluteUrl(post.coverImageUrl) ?? getOgImageFallback();

  return {
    title: post.title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url: canonicalUrl,
      siteName,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: (post.updatedAt ?? post.publishedAt)?.toISOString(),
      tags: post.tags.map((tag) => tag.name),
      images: [
        {
          url: coverImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [coverImage],
    },
  };
}

const formatDate = (date: Date | null): string | null => {
  if (!date) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date);
  } catch (error) {
    console.warn("Failed to format date", { error });
    return date.toISOString();
  }
};

export default async function PostPage({ params }: PostPageProps) {
  const post = await loadPostOrRedirect(params.slug);

  const canonicalHref = buildPostUrl(post.slug);
  const canonicalUrl = ensureAbsoluteUrl(canonicalHref) ?? createAbsoluteUrl(buildPostPath(post.slug));
  const coverImage = ensureAbsoluteUrl(post.coverImageUrl);
  const ogImage = coverImage ?? getOgImageFallback();
  const publishedLabel = formatDate(post.publishedAt);
  const updatedLabel =
    post.updatedAt && post.publishedAt && post.updatedAt.getTime() !== post.publishedAt.getTime()
      ? formatDate(post.updatedAt)
      : null;

  const postContent = getPostContentSource(post);
  const html = await renderPostContent(postContent);
  const tocItems = generateToc(html);
  const hasTableOfContents = countTocItems(tocItems) >= 3;
  const plainTextContent = htmlToPlainText(html);
  const summary = post.summary?.trim();
  const siteName = getSiteName();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: summary || truncateWords(plainTextContent, 40) || getSiteDescription(),
    datePublished: post.publishedAt?.toISOString(),
    dateModified: (post.updatedAt ?? post.publishedAt)?.toISOString(),
    image: coverImage ? [coverImage] : [ogImage],
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
    author: {
      "@type": "Organization",
      name: siteName,
    },
    publisher: {
      "@type": "Organization",
      name: siteName,
      logo: {
        "@type": "ImageObject",
        url: ogImage,
      },
    },
    keywords: post.tags.length ? post.tags.map((tag) => tag.name).join(", ") : undefined,
  };

  return (
    <main className="container mx-auto max-w-5xl px-4 py-12">
      <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
        {hasTableOfContents ? <TableOfContents className="order-1 lg:order-2" items={tocItems} /> : null}
        <article className="prose prose-neutral max-w-none flex-1 order-2 dark:prose-invert prose-pre:overflow-x-auto lg:order-1 lg:max-w-3xl">
          <header className="not-prose mb-8 border-b border-border pb-6">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">{post.title}</h1>
            {publishedLabel ? (
              <div className="mt-2 text-sm text-muted-foreground">
                <time dateTime={post.publishedAt?.toISOString()}>{publishedLabel}</time>
                {updatedLabel ? (
                  <span className="ml-1">
                    (Updated <time dateTime={post.updatedAt?.toISOString()}>{updatedLabel}</time>)
                  </span>
                ) : null}
              </div>
            ) : null}
            {post.tags.length ? (
              <ul className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-wide text-primary">
                {post.tags.map((tag) => (
                  <li key={tag.id} className="rounded-full bg-primary/10 px-3 py-1">
                    <Link href={`/tags/${tag.slug}`}>#{tag.name}</Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </header>
          {coverImage ? (
            <figure className="not-prose mb-8 overflow-hidden rounded-lg border border-border">
              <Image
                src={coverImage}
                alt={post.title}
                width={1200}
                height={630}
                className="h-auto w-full object-cover"
                sizes="(min-width: 768px) 768px, 100vw"
              />
            </figure>
          ) : null}
          <section dangerouslySetInnerHTML={{ __html: html }} />
        </article>
        {hasTableOfContents ? <TableOfContents items={tocItems} /> : null}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, (_key, value) => value ?? undefined) }}
      />
    </main>
  );
}
