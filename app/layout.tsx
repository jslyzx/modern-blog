import "./globals.css";
import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

import { createAbsoluteUrlFromConfig, getSiteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteConfig();
  const metadataBase = new URL(site.origin);
  const canonicalUrl = createAbsoluteUrlFromConfig(site, "/");

  return {
    metadataBase,
    title: {
      default: site.siteName,
      template: `%s | ${site.siteName}`,
    },
    description: site.siteDescription,
    openGraph: {
      type: "website",
      title: site.siteName,
      description: site.siteDescription,
      siteName: site.siteName,
      url: canonicalUrl,
      images: [
        {
          url: site.defaultOgImage,
          width: 1200,
          height: 630,
          alt: site.siteName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: site.siteName,
      description: site.siteDescription,
      images: [site.defaultOgImage],
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased")}>{children}</body>
    </html>
  );
}
