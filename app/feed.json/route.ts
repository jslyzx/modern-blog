import { prepareFeedItems } from "@/lib/feed";
import { getPublishedPosts } from "@/lib/posts";
import { createAbsoluteUrlFromConfig, getSiteConfig } from "@/lib/site";

const JSON_FEED_VERSION = "https://jsonfeed.org/version/1.1";
const FEED_LANGUAGE = "zh-CN";
const FEED_ITEM_LIMIT = 20;

const buildAuthors = (name: string, email: string | null) => {
  const authors: Array<{ name: string; url?: string }> = [];
  const trimmedName = name.trim();

  if (!trimmedName) {
    return authors;
  }

  const author: { name: string; url?: string } = { name: trimmedName };

  if (email?.trim()) {
    author.url = `mailto:${email.trim()}`;
  }

  authors.push(author);

  return authors;
};

export const revalidate = 3600;

export async function GET() {
  const [posts, site] = await Promise.all([
    getPublishedPosts({ limit: FEED_ITEM_LIMIT }),
    getSiteConfig(),
  ]);

  const items = await prepareFeedItems(posts, site);
  const siteUrl = createAbsoluteUrlFromConfig(site, "/");
  const feedUrl = createAbsoluteUrlFromConfig(site, "/feed.json");

  const feed = {
    version: JSON_FEED_VERSION,
    title: site.siteName,
    home_page_url: siteUrl,
    feed_url: feedUrl,
    language: FEED_LANGUAGE,
    description: site.siteDescription || site.siteName,
    icon: site.defaultOgImage,
    favicon: site.defaultOgImage,
    authors: buildAuthors(site.siteName, null),
    items: items.map((item) => {
      const authors = buildAuthors(item.author.name, item.author.email);
      const datePublished = item.publishedAt?.toISOString();
      const dateModified = item.updatedAt?.toISOString();
      const image = item.coverImage?.url;
      const attachments = item.coverImage && item.coverImage.mimeType
        ? [
            {
              url: item.coverImage.url,
              mime_type: item.coverImage.mimeType,
            },
          ]
        : undefined;

      return {
        id: item.id,
        url: item.link,
        title: item.title,
        content_html: item.contentHtml,
        summary: item.summaryText,
        date_published: datePublished,
        date_modified: dateModified,
        image,
        attachments,
        authors,
      };
    }),
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      "Content-Type": "application/feed+json; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
