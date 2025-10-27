import { getPublishedPosts } from "@/lib/posts";
import { buildPostPath } from "@/lib/paths";
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

const extractFirstParagraph = (html: string): string => {
  if (!html?.trim()) {
    return "";
  }

  const paragraphMatch = html.match(/<p[\s>][\s\S]*?<\/p>/i);

  return paragraphMatch ? paragraphMatch[0] : html;
};

export const revalidate = 3600;

export async function GET() {
  const [posts, site] = await Promise.all([
    getPublishedPosts({ limit: RSS_ITEM_LIMIT }),
    getSiteConfig(),
  ]);
  const siteName = site.siteName;
  const siteDescription = site.siteDescription;
  const siteUrl = createAbsoluteUrlFromConfig(site, "/");

  const items = posts
    .map((post) => {
      const link = createAbsoluteUrlFromConfig(site, buildPostPath(post.slug));
      const summaryText = post.summary?.trim() ?? "";
      const summaryHtml = summaryText
        ? `<p>${escapeXml(summaryText)}</p>`
        : extractFirstParagraph(post.contentHtml) || `<p>${escapeXml(post.title)}</p>`;
      const cdata = sanitizeCdata(summaryHtml);
      const publishedAt = toRssDate(post.publishedAt);
      const guidSeed = post.updatedAt?.getTime() ?? post.publishedAt?.getTime() ?? post.id;
      const guidValue = `${link}#${guidSeed}`;

      return `
        <item>
          <title>${escapeXml(post.title)}</title>
          <link>${escapeXml(link)}</link>
          <guid isPermaLink="false">${escapeXml(guidValue)}</guid>
          <description><![CDATA[${cdata}]]></description>
          <pubDate>${publishedAt}</pubDate>
        </item>
      `.trim();
    })
    .join("\n    ");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(siteDescription)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
