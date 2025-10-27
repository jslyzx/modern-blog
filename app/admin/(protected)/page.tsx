import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPostStats, listPosts } from "@/lib/admin/posts";

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

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

export default async function AdminHome() {
  const [stats, recentPosts] = await Promise.all([
    getPostStats(),
    listPosts({ limit: 5, status: "all" }),
  ]);

  return (
    <section className="space-y-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Review content performance and jump into managing posts, tags, and media.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/admin/posts/new">Create new post</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/tags">Manage tags</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-muted-foreground">Total posts</CardTitle>
            <CardDescription>Total content items in the system.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-3xl font-semibold text-foreground">{formatNumber(stats.total)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-muted-foreground">Published</CardTitle>
            <CardDescription>Visible on the public blog.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-3xl font-semibold text-emerald-500">{formatNumber(stats.published)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-muted-foreground">Drafts</CardTitle>
            <CardDescription>Awaiting review or publication.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-3xl font-semibold text-amber-500">{formatNumber(stats.draft)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-muted-foreground">Archived</CardTitle>
            <CardDescription>No longer publicly accessible.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-3xl font-semibold text-muted-foreground">{formatNumber(stats.archived)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-lg font-semibold">Recent posts</CardTitle>
            <CardDescription>Latest published and draft entries.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/posts" className="flex items-center gap-1">
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Title</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Published</th>
                  <th className="px-6 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentPosts.length ? (
                  recentPosts.map((post) => (
                    <tr key={post.id} className="border-b last:border-0">
                      <td className="px-6 py-3">
                        <Link href={`/admin/posts/${post.id}/edit`} className="font-medium text-foreground hover:underline">
                          {post.title}
                        </Link>
                      </td>
                      <td className="px-6 py-3 capitalize">{post.status}</td>
                      <td className="px-6 py-3">{formatDate(post.publishedAt)}</td>
                      <td className="px-6 py-3">{formatDate(post.updatedAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-6 text-center text-sm text-muted-foreground">
                      No posts yet. Start by creating a new post.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
