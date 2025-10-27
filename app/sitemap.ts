import type { MetadataRoute } from "next";

import { getPublishedPosts, getPublishedTags } from "@/lib/posts";
import { buildPostPath } from "@/lib/paths";
import { createAbsoluteUrlFromConfig, getSiteConfig } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, tags, site] = await Promise.all([getPublishedPosts(), getPublishedTags(), getSiteConfig()]);
  const now = new Date();

  const createUrl = (path: string) => createAbsoluteUrlFromConfig(site, path);

  const routes: MetadataRoute.Sitemap = [
    {
      url: createUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  for (const post of posts) {
    const url = createUrl(buildPostPath(post.slug));

    routes.push({
      url,
      lastModified: post.updatedAt ?? post.publishedAt ?? now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  for (const tag of tags) {
    routes.push({
      url: createUrl(`/tags/${tag.slug}`),
      lastModified: tag.updatedAt ?? now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  routes.push({
    url: createUrl("/rss"),
    lastModified: now,
    changeFrequency: "hourly",
    priority: 0.5,
  });

  return routes;
}
