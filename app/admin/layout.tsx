import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            Manage posts, tags, and site content.
          </p>
        </div>
        <nav className="flex gap-4 text-sm font-medium text-muted-foreground">
          <Link
            href="/admin/posts"
            className="transition hover:text-foreground"
          >
            Posts
          </Link>
          <Link
            href="/admin/tags"
            className="transition hover:text-foreground"
          >
            Tags
          </Link>
          <Link
            href="/"
            className="transition hover:text-foreground"
          >
            View site
          </Link>
        </nav>
      </header>
      <main className="flex flex-1 flex-col gap-6 pb-10">{children}</main>
    </div>
  );
}
