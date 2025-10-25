import type { MetadataRoute } from "next";

import { getPublishedPosts, getPublishedTags } from "@/lib/posts";
import { createAbsoluteUrl, ensureAbsoluteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, tags] = await Promise.all([getPublishedPosts(), getPublishedTags()]);
  const now = new Date();

  const routes: MetadataRoute.Sitemap = [
    {
      url: createAbsoluteUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  for (const post of posts) {
    const url = ensureAbsoluteUrl(post.canonicalUrl) ?? createAbsoluteUrl(`/posts/${post.slug}`);

    routes.push({
      url,
      lastModified: post.updatedAt ?? post.publishedAt ?? now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  for (const tag of tags) {
    routes.push({
      url: createAbsoluteUrl(`/tags/${tag.slug}`),
      lastModified: tag.updatedAt ?? now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  routes.push({
    url: createAbsoluteUrl("/rss"),
    lastModified: now,
    changeFrequency: "hourly",
    priority: 0.5,
  });

  return routes;
}
