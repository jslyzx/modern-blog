import type { MetadataRoute } from "next";

import { createAbsoluteUrlFromConfig, getSiteConfig } from "@/lib/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSiteConfig();
  const rootUrl = createAbsoluteUrlFromConfig(site, "/");
  const sitemap = createAbsoluteUrlFromConfig(site, "/sitemap.xml");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: [sitemap],
    host: new URL(rootUrl).origin,
  };
}
