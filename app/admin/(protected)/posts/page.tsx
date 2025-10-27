import Link from "next/link";

import { DeletePostButton } from "@/components/admin/delete-post-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { countPosts, listPosts, type PostStatus } from "@/lib/admin/posts";

const statusLabels: Record<PostStatus, string> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

const statusBadgeClasses: Record<PostStatus, string> = {
  published: "bg-emerald-100 text-emerald-700",
  draft: "bg-amber-100 text-amber-700",
  archived: "bg-slate-200 text-slate-700",
};

const statusOptions: Array<{ value: PostStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

const formatDate = (value: Date | null): string => {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(value);
  } catch (_error) {
    return value.toISOString();
  }
};

const parseParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

type PostsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const buildPageHref = (page: number, search?: string, status?: PostStatus | "all") => {
  const params = new URLSearchParams();

  if (search?.trim()) {
    params.set("q", search.trim());
  }

  if (status && status !== "all") {
    params.set("status", status);
  }

  if (page > 1) {
    params.set("page", page.toString());
  }

  const query = params.toString();

  return query ? `/admin/posts?${query}` : "/admin/posts";
};

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const searchTerm = parseParam(searchParams?.q) ?? "";
  const statusParam = parseParam(searchParams?.status);
  const pageParam = parseParam(searchParams?.page);

  const statusValue = statusOptions.some((option) => option.value === statusParam)
    ? (statusParam as PostStatus | "all")
    : "all";

  const searchValue = searchTerm.trim();
  const searchFilter = searchValue.length ? searchValue : undefined;

  const page = Number.isFinite(Number(pageParam)) ? Math.max(1, Number(pageParam)) : 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    listPosts({ search: searchFilter, status: statusValue, limit, offset }),
    countPosts({ search: searchFilter, status: statusValue }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;
  const start = posts.length ? offset + 1 : 0;
  const end = posts.length ? offset + posts.length : 0;

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Posts</h1>
          <p className="text-sm text-muted-foreground">Manage published content, drafts, and archives.</p>
        </div>
        <Button asChild>
          <Link href="/admin/posts/new">New post</Link>
        </Button>
      </div>

      <form className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-[1fr,200px,auto] md:items-center" method="get">
        <Input
          name="q"
          defaultValue={searchTerm}
          placeholder="Search by title or slug"
          className="md:col-span-1"
        />
        <div className="md:col-span-1">
          <label htmlFor="status" className="sr-only">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={statusValue}
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2 md:col-span-1">
          <Button type="submit" variant="default">
            Apply
          </Button>
          <Button type="reset" variant="outline" asChild>
            <Link href="/admin/posts">Reset</Link>
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3 text-sm text-muted-foreground">
          <span>
            Showing {start}–{end} of {total} posts
          </span>
          <span>Status: {statusOptions.find((option) => option.value === statusValue)?.label ?? "All"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Title</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Author</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.length ? (
                posts.map((post) => (
                  <tr key={post.id} className="border-b last:border-0">
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <Link href={`/admin/posts/${post.id}/edit`} className="font-medium text-foreground hover:underline">
                          {post.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">/{post.slug}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses[post.status]}`}
                      >
                        {statusLabels[post.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{post.authorName ?? "—"}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(post.createdAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/posts/${post.id}/edit`}>Edit</Link>
                        </Button>
                        <DeletePostButton postId={post.id} postTitle={post.title} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    No posts found. Adjust your filters or create a new post.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3 text-sm shadow-sm">
          <div>
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild disabled={!hasPrevious}>
              <Link href={buildPageHref(page - 1, searchTerm, statusValue)}>Previous</Link>
            </Button>
            <Button variant="outline" size="sm" asChild disabled={!hasNext}>
              <Link href={buildPageHref(page + 1, searchTerm, statusValue)}>Next</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
