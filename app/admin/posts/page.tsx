"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type TagSummary = {
  id: number;
  name: string;
  slug: string;
};

type PostListItem = {
  id: number;
  title: string;
  slug: string;
  status: "draft" | "published";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: TagSummary[];
};

type PostsResponse = {
  posts: PostListItem[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
  };
};

const fetchJson = async <T,>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    const message = typeof (data as { error?: string }).error === "string"
      ? (data as { error?: string }).error
      : "Request failed";
    throw new Error(message);
  }

  return data;
};

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleString();
};

const statusBadgeClass = (status: "draft" | "published") => {
  if (status === "published") {
    return "inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600";
  }

  return "inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600";
};

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchJson<PostsResponse>("/api/posts", {
        method: "GET",
        cache: "no-store",
      });
      setPosts(data.posts);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts().catch(() => {
      /* handled inside loadPosts */
    });
  }, [loadPosts]);

  const sortedPosts = useMemo(
    () =>
      [...posts].sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [posts],
  );

  const handleDelete = async (post: PostListItem) => {
    const confirmed = window.confirm("Delete this post? This action cannot be undone.");

    if (!confirmed) {
      return;
    }

    setDeletingId(post.id);

    try {
      await fetchJson(`/api/posts/${post.id}`, {
        method: "DELETE",
      });
      await loadPosts();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete post";
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Posts</h2>
          <p className="text-sm text-muted-foreground">
            Create, edit, and organize your blog posts.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/posts/new">New post</Link>
        </Button>
      </div>

      {loading ? (
        <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
          Loading posts...
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/60 bg-destructive/10 p-6 text-sm text-destructive">
          {error}
        </div>
      ) : sortedPosts.length === 0 ? (
        <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
          No posts yet. Create your first post to get started.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[720px] table-fixed text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Tags</th>
                <th className="px-4 py-3 font-medium">Published</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPosts.map((post) => (
                <tr key={post.id} className="border-t">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex flex-col">
                      <span>{post.title}</span>
                      <span className="text-xs text-muted-foreground">/{post.slug}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadgeClass(post.status)}>{post.status}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {post.tags.length === 0 ? "—" : post.tags.map((tag) => tag.name).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(post.publishedAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(post.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={`/admin/posts/${post.id}`}>Edit</Link>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(post)}
                        disabled={deletingId === post.id}
                      >
                        {deletingId === post.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
