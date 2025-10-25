import { getSiteName, getSiteDescription } from "@/lib/site";

export function SiteFooter() {
  const siteName = getSiteName();
  const siteDescription = getSiteDescription();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <h3 className="mb-3 text-lg font-semibold">{siteName}</h3>
            <p className="text-sm text-muted-foreground">{siteDescription}</p>
          </div>
          <div>
            <h3 className="mb-3 text-lg font-semibold">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/" className="text-muted-foreground hover:text-foreground">
                  Home
                </a>
              </li>
              <li>
                <a href="/search" className="text-muted-foreground hover:text-foreground">
                  Search
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {currentYear} {siteName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
