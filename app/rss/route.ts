import { prepareFeedItems, type FeedAuthor, type PreparedFeedItem } from "@/lib/feed";
import { getPublishedPosts } from "@/lib/posts";
import { createAbsoluteUrlFromConfig, getSiteConfig } from "@/lib/site";

const RSS_ITEM_LIMIT = 20;

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sanitizeCdata = (value: string): string => value.replace(/]]>/g, "]]&gt;");

const toRssDate = (value?: Date | null): string => {
  const date = value ?? new Date();
  return date.toUTCString();
};

const buildAuthorTag = (author: FeedAuthor): string => {
  const name = author.name.trim() || "Unknown";

  if (author.email) {
    return `<author>${escapeXml(`${author.email} (${name})`)}</author>`;
  }

  return `<author>${escapeXml(name)}</author>`;
};

const buildDescription = (item: PreparedFeedItem): string => {
  if (item.summaryHtml) {
    const safe = sanitizeCdata(item.summaryHtml);
    return `<description><![CDATA[${safe}]]></description>`;
  }

  const fallback = item.summaryText?.trim() || item.title;
  return `<description>${escapeXml(fallback)}</description>`;
};

const buildContent = (item: PreparedFeedItem): string => {
  if (!item.contentHtml?.trim()) {
    return "";
  }

  const safe = sanitizeCdata(item.contentHtml);
  return `<content:encoded><![CDATA[${safe}]]></content:encoded>`;
};

const buildMediaContent = (item: PreparedFeedItem): string => {
  const cover = item.coverImage;

  if (!cover) {
    return "";
  }

  const attributes = [
    `url="${escapeXml(cover.url)}"`,
    'medium="image"',
  ];

  if (typeof cover.width === "number" && Number.isFinite(cover.width)) {
    attributes.push(`width="${cover.width}"`);
  }

  if (typeof cover.height === "number" && Number.isFinite(cover.height)) {
    attributes.push(`height="${cover.height}"`);
  }

  if (cover.mimeType) {
    attributes.push(`type="${escapeXml(cover.mimeType)}"`);
  }

  return `<media:content ${attributes.join(" ")} />`;
};

const buildItemXml = (item: PreparedFeedItem): string => {
  const pubDate = item.publishedAt ? `<pubDate>${toRssDate(item.publishedAt)}</pubDate>` : "";
  const updated = item.updatedAt ? `<atom:updated>${escapeXml(item.updatedAt.toISOString())}</atom:updated>` : "";
  const description = buildDescription(item);
  const content = buildContent(item);
  const author = buildAuthorTag(item.author);
  const media = buildMediaContent(item);

  return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="false">${escapeXml(item.id)}</guid>
      ${author}
      ${pubDate}
      ${description}
      ${content}
      ${media}
      ${updated}
    </item>`;
};

const determineLastBuildDate = (items: PreparedFeedItem[]): Date => {
  let latest: Date | null = null;

  for (const item of items) {
    const candidate = item.updatedAt ?? item.publishedAt;

    if (candidate && (!latest || candidate.getTime() > latest.getTime())) {
      latest = candidate;
    }
  }

  return latest ?? new Date();
};

export const revalidate = 3600;

export async function GET() {
  const [posts, site] = await Promise.all([
    getPublishedPosts({ limit: RSS_ITEM_LIMIT }),
    getSiteConfig(),
  ]);

  const items = await prepareFeedItems(posts, site);
  const siteUrl = createAbsoluteUrlFromConfig(site, "/");
  const feedUrl = createAbsoluteUrlFromConfig(site, "/rss");
  const jsonFeedUrl = createAbsoluteUrlFromConfig(site, "/feed.json");

  const siteName = site.siteName;
  const siteDescription = site.siteDescription || siteName;
  const lastBuildDate = determineLastBuildDate(items);
  const channelImage = site.defaultOgImage
    ? `    <image>
      <url>${escapeXml(site.defaultOgImage)}</url>
      <title>${escapeXml(siteName)}</title>
      <link>${escapeXml(siteUrl)}</link>
    </image>`
    : "";

  const channelParts = [
    `    <title>${escapeXml(siteName)}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <description>${escapeXml(siteDescription)}</description>`,
    "    <language>zh-CN</language>",
    `    <lastBuildDate>${toRssDate(lastBuildDate)}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    `    <atom:link href="${escapeXml(jsonFeedUrl)}" rel="alternate" type="application/feed+json" />`,
  ];

  if (channelImage) {
    channelParts.push(channelImage);
  }

  for (const item of items) {
    channelParts.push(buildItemXml(item));
  }

  const channelContent = channelParts.join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
${channelContent}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
