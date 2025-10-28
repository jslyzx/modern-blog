import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { PostContent } from "@/components/site/PostContent";
import { TableOfContents } from "@/components/site/TableOfContents";
import { htmlToPlainText, renderPostContent, truncateWords } from "@/lib/markdown";
import { getPostByIdForPreview, type PreviewPost } from "@/lib/posts";
import {
  buildPostPath,
  buildPostUrlFromConfig,
  createAbsoluteUrlFromConfig,
  ensureAbsoluteUrlFromConfig,
  getSiteConfig,
} from "@/lib/site";
import { verifyPreviewToken } from "@/lib/preview-token";
import { countTocItems, generateToc } from "@/lib/toc";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const INVALID_METADATA: Metadata = {
  title: "预览链接无效",
  description: "预览链接无效或已过期。",
  robots: {
    index: false,
    follow: false,
  },
};

const formatDate = (date: Date | null): string | null => {
  if (!date) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("zh-CN", { dateStyle: "long" }).format(date);
  } catch (error) {
    console.warn("Failed to format date", { error });
    return date.toISOString();
  }
};

const getPostContentSource = (post: PreviewPost): string => {
  if (post.contentHtml.trim().length > 0) {
    return post.contentHtml;
  }

  if (post.contentMd && post.contentMd.trim().length > 0) {
    return post.contentMd;
  }

  return "";
};

const formatExpiryDuration = (ms: number): string => {
  if (ms <= 0) {
    return "已过期";
  }

  const totalMinutes = Math.ceil(ms / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    if (minutes === 0) {
      return `${hours} 小时`;
    }

    return `${hours} 小时 ${minutes} 分钟`;
  }

  return `${Math.max(totalMinutes, 1)} 分钟`;
};

const formatDateTime = (date: Date): string => {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch (error) {
    console.warn("Failed to format date/time", { error });
    return date.toISOString();
  }
};

type PreviewPageProps = {
  params: {
    token: string;
  };
};

export async function generateMetadata({ params }: PreviewPageProps): Promise<Metadata> {
  const verification = verifyPreviewToken(params.token);

  if (!verification) {
    return INVALID_METADATA;
  }

  const post = await getPostByIdForPreview(verification.postId);

  if (!post) {
    return INVALID_METADATA;
  }

  const site = await getSiteConfig();
  const contentSource = getPostContentSource(post);
  const renderedHtml = await renderPostContent(contentSource);
  const plainTextContent = htmlToPlainText(renderedHtml);
  const summary = post.summary?.trim();
  const description = summary || truncateWords(plainTextContent, 40) || site.siteDescription;
  const previewPath = `/preview/${encodeURIComponent(params.token)}`;
  const previewUrl = createAbsoluteUrlFromConfig(site, previewPath);
  const canonicalCandidate = post.slug
    ? createAbsoluteUrlFromConfig(site, buildPostPath(post.slug))
    : previewUrl;
  const coverImage = ensureAbsoluteUrlFromConfig(site, post.coverImageUrl) ?? site.defaultOgImage;

  return {
    title: `${post.title}（预览）`,
    description,
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical: canonicalCandidate,
    },
    openGraph: {
      type: "article",
      title: `${post.title}（预览）`,
      description,
      url: previewUrl,
      siteName: site.siteName,
      publishedTime: post.publishedAt?.toISOString() ?? undefined,
      modifiedTime: (post.updatedAt ?? post.publishedAt)?.toISOString() ?? undefined,
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
      title: `${post.title}（预览）`,
      description,
      images: [coverImage],
    },
  };
}

const PreviewAccessMessage = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-24">
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-destructive">401 未授权</p>
        <h1 className="mt-4 text-2xl font-semibold text-destructive">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-destructive/40 bg-background px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10"
          >
            返回首页
          </Link>
        </div>
      </div>
    </main>
  );
};

const PREVIEW_STATUS_LABELS: Record<Exclude<PreviewPost["status"], null>, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

const buildStructuredData = (
  post: PreviewPost,
  canonicalUrl: string,
  ogImage: string,
  siteName: string,
  description: string,
) => ({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: `${post.title}（预览）`,
  description: description || undefined,
  datePublished: post.publishedAt?.toISOString(),
  dateModified: (post.updatedAt ?? post.publishedAt)?.toISOString(),
  image: [ogImage],
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
});

export default async function PreviewPage({ params }: PreviewPageProps) {
  noStore();

  const verification = verifyPreviewToken(params.token);

  if (!verification) {
    return <PreviewAccessMessage title="预览链接已失效" description="链接可能已过期或被撤销，请联系作者重新生成。" />;
  }

  const post = await getPostByIdForPreview(verification.postId);

  if (!post) {
    return <PreviewAccessMessage title="文章不存在" description="文章可能已被删除或暂时不可用。" />;
  }

  const site = await getSiteConfig();
  const previewPath = `/preview/${encodeURIComponent(params.token)}`;
  const previewUrl = createAbsoluteUrlFromConfig(site, previewPath);
  const canonicalHref = post.slug ? buildPostUrlFromConfig(site, post.slug) : null;
  const canonicalUrl = canonicalHref
    ? ensureAbsoluteUrlFromConfig(site, canonicalHref) ?? createAbsoluteUrlFromConfig(site, buildPostPath(post.slug))
    : previewUrl;
  const coverMetadata = post.coverImageMetadata;
  const coverImageSource = coverMetadata?.original.url ?? post.coverImageUrl ?? null;
  const coverImage = coverImageSource ? ensureAbsoluteUrlFromConfig(site, coverImageSource) : null;
  const coverImageBlur = coverMetadata?.blurDataUrl ?? null;
  const coverImageWebp = coverMetadata?.webp?.url ? ensureAbsoluteUrlFromConfig(site, coverMetadata.webp.url) : null;
  const coverImageWidth = coverMetadata?.original.width ?? 1200;
  const coverImageHeight = coverMetadata?.original.height ?? 630;
  const ogImage = coverImage ?? site.defaultOgImage;
  const publishedLabel = formatDate(post.publishedAt);
  const updatedLabel =
    post.updatedAt && post.publishedAt && post.updatedAt.getTime() !== post.publishedAt.getTime()
      ? formatDate(post.updatedAt)
      : null;

  const contentSource = getPostContentSource(post);
  const html = await renderPostContent(contentSource);
  const tocItems = generateToc(html);
  const hasTableOfContents = countTocItems(tocItems) >= 3;
  const plainTextContent = htmlToPlainText(html);
  const summary = post.summary?.trim();
  const siteName = site.siteName;
  const descriptionForSchema = summary || truncateWords(plainTextContent, 40) || site.siteDescription;
  const structuredData = buildStructuredData(post, canonicalUrl, ogImage, siteName, descriptionForSchema);

  const now = Date.now();
  const remainingMs = Math.max(0, verification.exp - now);
  const expiresAt = new Date(verification.exp);
  const expiresInLabel = formatExpiryDuration(remainingMs);
  const expiresAtLabel = formatDateTime(expiresAt);
  const statusLabel = post.status ? PREVIEW_STATUS_LABELS[post.status] ?? post.status : "未知";

  return (
    <main className="relative container mx-auto max-w-5xl px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_55%)]" />
      <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary shadow-sm">
        <p className="font-semibold">预览模式</p>
        <p className="mt-1 text-xs text-primary/80">此链接将在 {expiresInLabel} 后过期（{expiresAtLabel}）。</p>
        <p className="mt-1 text-xs text-primary/70">当前文章状态：{statusLabel}</p>
      </div>
      <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
        {hasTableOfContents ? <TableOfContents className="order-1 lg:order-2" items={tocItems} /> : null}
        <article className="order-2 flex-1 prose prose-neutral max-w-none dark:prose-invert prose-pre:overflow-x-auto lg:order-1 lg:max-w-3xl">
          <header className="not-prose mb-8 border-b border-border pb-6">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">{post.title}</h1>
            {publishedLabel ? (
              <div className="mt-2 text-sm text-muted-foreground">
                <time dateTime={post.publishedAt?.toISOString()}>{publishedLabel}</time>
                {updatedLabel ? (
                  <span className="ml-1">
                    (更新于 <time dateTime={post.updatedAt?.toISOString()}>{updatedLabel}</time>)
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
        </article>
        {hasTableOfContents ? <TableOfContents items={tocItems} /> : null}
      </div>
      {summary ? (
        <div className="mt-12 rounded-lg border border-muted-foreground/20 bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">摘要</p>
          <p className="mt-1 leading-relaxed">{summary}</p>
        </div>
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, (_key, value) => value ?? undefined) }} />
    </main>
  );
}
