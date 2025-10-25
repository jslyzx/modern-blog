import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  getMetadataBase,
  getOgImageFallback,
  getSiteDescription,
  getSiteName,
} from "@/lib/site";

const siteName = getSiteName();
const siteDescription = getSiteDescription();
const metadataBase = getMetadataBase();
const siteOrigin = metadataBase.origin;
const defaultOgImage = getOgImageFallback();

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  openGraph: {
    type: "website",
    title: siteName,
    description: siteDescription,
    siteName,
    url: siteOrigin,
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: [defaultOgImage],
  },
  alternates: {
    canonical: siteOrigin,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased")}>{children}</body>
    </html>
  );
}
