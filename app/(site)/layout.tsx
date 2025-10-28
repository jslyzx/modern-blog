import Link from "next/link";
import { ReactNode } from "react";

import ThemeToggle from "@/components/ThemeToggle";
import { getSiteConfig } from "@/lib/site";

type SiteLayoutProps = {
  children: ReactNode;
};

const getCurrentYear = () => new Date().getFullYear();

export default async function SiteLayout({ children }: SiteLayoutProps) {
  const site = await getSiteConfig();
  const siteName = site.siteName;
  const siteDescription = site.siteDescription;
  const currentYear = getCurrentYear();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="container mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Link
              href="/"
              className="text-2xl font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {siteName}
            </Link>
            <p className="text-sm text-muted-foreground">{siteDescription}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <Link href="/search" className="transition-colors hover:text-primary">
              Search
            </Link>
            <Link href="/rss" className="transition-colors hover:text-primary">
              RSS
            </Link>
            <ThemeToggle className="ml-2" />
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border bg-card/60">
        <div className="container mx-auto max-w-5xl px-4 py-8 text-center text-sm text-muted-foreground sm:text-left">
          <p className="text-base font-semibold text-foreground">{siteName}</p>
          <p className="mt-2">{siteDescription}</p>
          <p className="mt-4 text-xs text-muted-foreground/80">© {currentYear} {siteName}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
