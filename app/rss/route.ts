import { markdownToHtml } from "@/lib/markdown";
import { getPublishedPosts } from "@/lib/posts";
import {
  createAbsoluteUrl,
  ensureAbsoluteUrl,
  getSiteDescription,
  getSiteName,
} from "@/lib/site";

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

const buildSummaryHtml = (markdown: string): string => {
  const html = markdownToHtml(markdown);

  if (!html) {
    return "";
  }

  const paragraphMatch = html.match(/<p>[\s\S]*?<\/p>/);

  return paragraphMatch ? paragraphMatch[0] : html;
};

export const revalidate = 3600;

export async function GET() {
  const posts = await getPublishedPosts(RSS_ITEM_LIMIT);
  const siteName = getSiteName();
  const siteDescription = getSiteDescription();
  const siteUrl = createAbsoluteUrl("/");

  const items = posts
    .map((post) => {
      const link = ensureAbsoluteUrl(post.canonicalUrl) ?? createAbsoluteUrl(`/posts/${post.slug}`);
      const summarySource = post.summary ?? post.content;
      const summaryHtml = buildSummaryHtml(summarySource) || markdownToHtml(summarySource) || `<p>${escapeXml(post.title)}</p>`;
      const cdata = sanitizeCdata(summaryHtml);
      const publishedAt = toRssDate(post.publishedAt);
      const guidSeed = post.updatedAt?.getTime() ?? post.publishedAt?.getTime() ?? post.id;

      return `
        <item>
          <title>${escapeXml(post.title)}</title>
          <link>${escapeXml(link)}</link>
          <guid isPermaLink="false">${escapeXml(`${link}#${guidSeed}`)}</guid>
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
