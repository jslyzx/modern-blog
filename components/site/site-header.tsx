import Link from "next/link";
import { getSiteName } from "@/lib/site";

export function SiteHeader() {
  const siteName = getSiteName();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <span className="inline-block text-xl font-bold">{siteName}</span>
          </Link>
        </div>
        <nav className="flex items-center space-x-6 text-sm font-medium">
          <Link href="/" className="transition-colors hover:text-foreground/80">
            Home
          </Link>
          <Link href="/search" className="transition-colors hover:text-foreground/80">
            Search
          </Link>
        </nav>
      </div>
    </header>
  );
}
