import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import type { Element, Properties, Root } from "hast";

import { htmlToPlainText, renderPostContent } from "@/lib/markdown";
import type { PublishedPostAuthor, PublishedPostSummary } from "@/lib/posts";
import { buildPostPath } from "@/lib/paths";
import type { SiteConfig } from "@/lib/site";
import { createAbsoluteUrlFromConfig, ensureAbsoluteUrlFromConfig } from "@/lib/site";

const ABSOLUTE_URL_PATTERN = /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i;
const FIRST_PARAGRAPH_PATTERN = /<p[\s>][\s\S]*?<\/p>/i;
const STYLE_URL_PATTERN = /url\(("|')?([^\s)]+)("|')?\)/gi;
const URL_SCHEME_DELIMITER = ":";
const URL_ATTRIBUTES = [
  "href",
  "src",
  "poster",
  "data-src",
  "data-original-src",
  "data-webp",
  "data-preview",
  "dataPoster",
  "dataSrc",
  "dataOriginalSrc",
  "dataWebp",
  "dataPreview",
];
const SRCSET_ATTRIBUTES = ["srcset", "srcSet", "data-srcset", "dataSrcset"];
const IGNORED_SCHEMES = new Set(["mailto", "tel", "javascript", "data"]);

const FEED_CONTENT_STYLES = `
.feed-article { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.7; font-size: 16px; color: #111827; }
.feed-article h1, .feed-article h2, .feed-article h3, .feed-article h4, .feed-article h5, .feed-article h6 { color: #0f172a; margin-top: 2.5rem; margin-bottom: 1rem; line-height: 1.3; }
.feed-article h1 { font-size: 2.35rem; }
.feed-article h2 { font-size: 1.85rem; }
.feed-article h3 { font-size: 1.5rem; }
.feed-article p { margin: 1.25rem 0; }
.feed-article ul, .feed-article ol { margin: 1.5rem 0 1.5rem 1.75rem; padding: 0; }
.feed-article li { margin: 0.5rem 0; }
.feed-article blockquote { border-left: 4px solid #38bdf8; padding-left: 1rem; color: #475569; font-style: italic; background: #f8fafc; border-radius: 0.5rem; }
.feed-article pre { background: #0f172a; color: #f8fafc; padding: 1rem 1.25rem; border-radius: 0.75rem; overflow: auto; font-size: 0.95rem; }
.feed-article code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background: rgba(15, 23, 42, 0.08); padding: 0.1rem 0.4rem; border-radius: 0.35rem; }
.feed-article pre code { background: transparent; padding: 0; border-radius: 0; }
.feed-article img, .feed-article video { max-width: 100%; height: auto; border-radius: 0.75rem; margin: 1.5rem 0; }
.feed-article table { width: 100%; border-collapse: collapse; margin: 2rem 0; font-size: 0.95rem; }
.feed-article table th, .feed-article table td { border: 1px solid #e2e8f0; padding: 0.75rem 1rem; text-align: left; }
.feed-article a { color: #2563eb; text-decoration: underline; }
.feed-article hr { border: 0; border-top: 1px solid #e2e8f0; margin: 2.5rem 0; }
.feed-article figure { margin: 2rem 0; }
.feed-article figcaption { margin-top: 0.75rem; font-size: 0.9rem; color: #64748b; text-align: center; }
`;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toStringValue = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = toStringValue(entry);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
};

const resolveUrl = (raw: string, site: SiteConfig): string => {
  const trimmed = raw.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  const scheme = lower.includes(URL_SCHEME_DELIMITER) ? lower.split(URL_SCHEME_DELIMITER, 1)[0] : "";

  if (scheme && IGNORED_SCHEMES.has(scheme)) {
    return trimmed;
  }

  if (ABSOLUTE_URL_PATTERN.test(trimmed)) {
    if (trimmed.startsWith("//")) {
      try {
        return new URL(trimmed, site.origin).toString();
      } catch {
        return `https:${trimmed}`;
      }
    }
    return trimmed;
  }

  try {
    return new URL(trimmed, site.origin).toString();
  } catch {
    return createAbsoluteUrlFromConfig(site, trimmed);
  }
};

const convertSrcset = (value: string, site: SiteConfig): string =>
  value
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const [url, ...descriptors] = segment.split(/\s+/);
      if (!url) {
        return null;
      }
      const absoluteUrl = resolveUrl(url, site);
      return descriptors.length ? `${absoluteUrl} ${descriptors.join(" ")}` : absoluteUrl;
    })
    .filter((segment): segment is string => Boolean(segment))
    .join(", ");

const transformStyleUrls = (value: string, site: SiteConfig): string =>
  value.replace(STYLE_URL_PATTERN, (match, prefix, url, suffix) => {
    if (!url) {
      return match;
    }
    const absolute = resolveUrl(url, site);
    return `url(${prefix ?? ""}${absolute}${suffix ?? ""})`;
  });

const isElementNode = (node: unknown): node is Element => Boolean(node) && typeof node === "object" && (node as Element).type === "element";

const transformNodeUrls = (node: unknown, site: SiteConfig): void => {
  if (!node || typeof node !== "object") {
    return;
  }

  if (isElementNode(node)) {
    const properties: Properties = node.properties ?? {};

    if (!node.properties) {
      node.properties = properties;
    }

    for (const attribute of URL_ATTRIBUTES) {
      const rawValue = properties[attribute as keyof Properties];
      const value = toStringValue(rawValue);

      if (!value) {
        continue;
      }

      const absolute = resolveUrl(value, site);

      if (absolute !== value) {
        properties[attribute as keyof Properties] = absolute;
      }
    }

    for (const attribute of SRCSET_ATTRIBUTES) {
      const rawValue = properties[attribute as keyof Properties];
      const value = toStringValue(rawValue);

      if (!value) {
        continue;
      }

      const absolute = convertSrcset(value, site);
      properties[attribute as keyof Properties] = absolute;
    }

    if (typeof properties.style === "string") {
      properties.style = transformStyleUrls(properties.style, site);
    }

    if (Array.isArray(node.children)) {
      node.children.forEach((child) => transformNodeUrls(child, site));
    }

    return;
  }

  const children = (node as { children?: unknown[] }).children;

  if (Array.isArray(children)) {
    children.forEach((child) => transformNodeUrls(child, site));
  }
};

const ensureAbsoluteContent = (html: string, site: SiteConfig): string => {
  if (!html.trim()) {
    return "";
  }

  const parser = unified().use(rehypeParse, { fragment: true });
  const tree = parser.parse(html) as Root;
  transformNodeUrls(tree, site);
  const serializer = unified().use(rehypeStringify, { allowDangerousHtml: true });
  return String(serializer.stringify(tree));
};

const wrapContentWithStyles = (html: string): string => {
  const content = html.trim();

  if (!content) {
    return "";
  }

  return `<style>${FEED_CONTENT_STYLES}</style><div class="feed-article">${content}</div>`;
};

const extractSummaryHtml = (post: PublishedPostSummary, contentHtml: string): string | null => {
  const summaryText = post.summary?.trim();

  if (summaryText) {
    return `<p>${escapeHtml(summaryText)}</p>`;
  }

  const firstParagraph = FIRST_PARAGRAPH_PATTERN.exec(contentHtml ?? "");

  if (firstParagraph) {
    return firstParagraph[0];
  }

  if (post.title?.trim()) {
    return `<p>${escapeHtml(post.title.trim())}</p>`;
  }

  return null;
};

const resolveCoverImage = (post: PublishedPostSummary, site: SiteConfig): FeedCoverImage | null => {
  const metadata = post.coverImageMetadata;
  const sourceUrl = metadata?.original.url ?? post.coverImageUrl ?? null;

  if (!sourceUrl) {
    return null;
  }

  const absoluteUrl = ensureAbsoluteUrlFromConfig(site, sourceUrl) ?? createAbsoluteUrlFromConfig(site, sourceUrl);

  return {
    url: absoluteUrl,
    width: metadata?.original.width ?? null,
    height: metadata?.original.height ?? null,
    mimeType: metadata?.original.mimeType ?? null,
  };
};

const resolveAuthor = (author: PublishedPostAuthor | undefined, site: SiteConfig): FeedAuthor => {
  const name = author?.name?.trim() || site.siteName;
  const email = author?.email?.trim() || null;

  return {
    name,
    email,
  };
};

const buildGuid = (link: string, post: PublishedPostSummary): string => {
  const seed = post.updatedAt?.getTime() ?? post.publishedAt?.getTime() ?? post.id;
  return `${link}#${seed}`;
};

const getPostLink = (post: PublishedPostSummary, site: SiteConfig): string => {
  const slug = post.slug?.trim();

  if (!slug) {
    return createAbsoluteUrlFromConfig(site, "/");
  }

  return createAbsoluteUrlFromConfig(site, buildPostPath(slug));
};

const resolveContentSource = (post: PublishedPostSummary): string => {
  const markdownSource = post.contentMd?.trim();

  if (markdownSource) {
    return markdownSource;
  }

  return post.contentHtml ?? "";
};

const renderFeedContent = async (
  post: PublishedPostSummary,
  site: SiteConfig,
): Promise<{ absoluteHtml: string; wrappedHtml: string }> => {
  const source = resolveContentSource(post);
  const rendered = source ? await renderPostContent(source) : "";
  const absolute = ensureAbsoluteContent(rendered, site);
  const wrappedHtml = wrapContentWithStyles(absolute);

  return {
    absoluteHtml: absolute,
    wrappedHtml,
  };
};

export interface FeedCoverImage {
  url: string;
  width: number | null;
  height: number | null;
  mimeType: string | null;
}

export interface FeedAuthor {
  name: string;
  email: string | null;
}

export interface PreparedFeedItem {
  id: string;
  link: string;
  title: string;
  summaryHtml: string | null;
  summaryText: string;
  contentHtml: string;
  publishedAt: Date | null;
  updatedAt: Date | null;
  author: FeedAuthor;
  coverImage: FeedCoverImage | null;
}

export const prepareFeedItems = async (
  posts: PublishedPostSummary[],
  site: SiteConfig,
): Promise<PreparedFeedItem[]> => {
  const items = await Promise.all(
    posts.map(async (post) => {
      const content = await renderFeedContent(post, site);
      const link = getPostLink(post, site);
      const summaryHtml = extractSummaryHtml(post, content.absoluteHtml);
      const summaryTextSource = summaryHtml ?? content.absoluteHtml;
      const summaryText = htmlToPlainText(summaryTextSource).slice(0, 5000);
      const author = resolveAuthor(post.author, site);
      const coverImage = resolveCoverImage(post, site);
      const guid = buildGuid(link, post);

      return {
        id: guid,
        link,
        title: post.title,
        summaryHtml,
        summaryText,
        contentHtml: content.wrappedHtml,
        publishedAt: post.publishedAt ?? post.createdAt ?? null,
        updatedAt: post.updatedAt ?? post.publishedAt ?? post.createdAt ?? null,
        author,
        coverImage,
      } satisfies PreparedFeedItem;
    }),
  );

  return items;
};
