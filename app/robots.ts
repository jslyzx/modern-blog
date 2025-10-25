import type { MetadataRoute } from "next";

import { createAbsoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const rootUrl = createAbsoluteUrl("/");
  const sitemap = createAbsoluteUrl("/sitemap.xml");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: [sitemap],
    host: new URL(rootUrl).origin,
  };
}
