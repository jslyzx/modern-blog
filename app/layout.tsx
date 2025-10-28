import "./globals.css";
import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import Script from "next/script";
import { ReactNode } from "react";

import { ThemeProvider, THEME_STORAGE_KEY } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from "@/components/ui/use-toast";
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
      types: {
        "application/rss+xml": [
          {
            url: "/rss",
            title: `${site.siteName} RSS`,
          },
        ],
        "application/feed+json": [
          {
            url: "/feed.json",
            title: `${site.siteName} JSON Feed`,
          },
        ],
      },
    },
  };
}

const themeInitScript = `(() => {
  try {
    const storageKey = "${THEME_STORAGE_KEY}";
    const storedTheme = window.localStorage.getItem(storageKey);
    const mediaQuery = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const prefersDark = mediaQuery ? mediaQuery.matches : false;
    const theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";
    const resolved = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
    const root = document.documentElement;

    if (resolved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  } catch (_error) {
    /* noop */
  }
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <link rel="alternate" type="application/rss+xml" href="/rss" />
        <link rel="alternate" type="application/feed+json" href="/feed.json" />
      </head>
      <body className={cn("min-h-screen bg-background font-sans antialiased")}>
        <ThemeProvider>
          <ToastProvider>
            {children}
            <Toaster />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
