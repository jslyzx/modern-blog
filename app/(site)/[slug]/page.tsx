import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { PostContent } from "@/components/site/PostContent";
import { ShareButtons } from "@/components/site/ShareButtons";
import { RelatedPosts } from "@/components/site/RelatedPosts";
import { TableOfContents } from "@/components/site/TableOfContents";
import { PopularPostsWidget } from "@/components/site/PopularPostsWidget";
import { PostViewTracker } from "@/components/site/PostViewTracker";
import { htmlToPlainText, renderPostContent, truncateWords } from "@/lib/markdown";
import { countTocItems, generateToc } from "@/lib/toc";
import { buildPostPath } from "@/lib/paths";
import {
  buildPostUrlFromConfig,
  createAbsoluteUrlFromConfig,
  ensureAbsoluteUrlFromConfig,
  getSiteConfig,
} from "@/lib/site";
import { getRelatedPostsForPost } from "@/lib/site/related-posts";
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
  const site = await getSiteConfig();

  const fallbackDescription = site.siteDescription;
  const postContent = getPostContentSource(post);
  const renderedHtml = await renderPostContent(postContent);
  const plainTextContent = htmlToPlainText(renderedHtml);
  const summary = post.summary?.trim();
  const description = summary || truncateWords(plainTextContent, 40) || fallbackDescription;

  const canonicalUrl = createAbsoluteUrlFromConfig(site, buildPostPath(post.slug));
  const coverImage = ensureAbsoluteUrlFromConfig(site, post.coverImageUrl) ?? site.defaultOgImage;

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
      siteName: site.siteName,
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
  const [site, relatedPosts] = await Promise.all([
    getSiteConfig(),
    getRelatedPostsForPost(post.id, { limit: 5 }),
  ]);

  const canonicalHref = buildPostUrlFromConfig(site, post.slug);
  const canonicalUrl =
    ensureAbsoluteUrlFromConfig(site, canonicalHref) ??
    createAbsoluteUrlFromConfig(site, buildPostPath(post.slug));
  const coverMetadata = post.coverImageMetadata;
  const coverImageSource = coverMetadata?.original.url ?? post.coverImageUrl ?? null;
  const coverImage = coverImageSource ? ensureAbsoluteUrlFromConfig(site, coverImageSource) : null;
  const coverImageBlur = coverMetadata?.blurDataUrl ?? null;
  const coverImageWebp = coverMetadata?.webp?.url
    ? ensureAbsoluteUrlFromConfig(site, coverMetadata.webp.url)
    : null;
  const coverImageWidth = coverMetadata?.original.width ?? 1200;
  const coverImageHeight = coverMetadata?.original.height ?? 630;
  const ogImage = coverImage ?? site.defaultOgImage;
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
  const siteName = site.siteName;
  const shareSummary = summary || truncateWords(plainTextContent, 40) || site.siteDescription;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: shareSummary,
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
      <PostViewTracker postId={post.id} />
      <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
        <article className="order-1 flex-1 prose prose-neutral max-w-none dark:prose-invert prose-pre:overflow-x-auto lg:order-2 lg:max-w-3xl">
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
                width={coverImageWidth || 1200}
                height={coverImageHeight || 630}
                className="h-auto w-full object-cover"
                sizes="(min-width: 768px) 768px, 100vw"
                placeholder={coverImageBlur ? "blur" : "empty"}
                blurDataURL={coverImageBlur ?? undefined}
                loading="eager"
                priority
                data-webp={coverImageWebp ?? undefined}
              />
            </figure>
          ) : null}
          <PostContent html={html} className="contents" />
          <RelatedPosts className="mt-12" posts={relatedPosts} />
        </article>
        <ShareButtons
          className="order-2 w-full lg:order-1 lg:w-auto lg:flex-none"
          title={post.title}
          url={canonicalUrl}
          summary={shareSummary}
        />
        {hasTableOfContents ? (
          <TableOfContents className="order-3 w-full lg:order-3 lg:flex-none" items={tocItems} />
        ) : null}
      </div>
      <PopularPostsWidget excludeIds={[post.id]} className="mt-12" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, (_key, value) => value ?? undefined) }}
      />
    </main>
  );
}
