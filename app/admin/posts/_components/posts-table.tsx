"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Post, PostStatus } from "@/types/post";

import { StatusBadge } from "./status-badge";

type StatusFilter = "all" | PostStatus;

type PostsResponse = {
  posts: Post[];
  total: number;
  page: number;
  pageSize: number;
};

const STATUS_OPTIONS: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

export function PostsTable() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewUpdateId, setViewUpdateId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const pageSize = 20;

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();

    const params = new URLSearchParams();

    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }

    if (searchTerm) {
      params.set("search", searchTerm);
    }

    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    fetch(`/api/posts?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load posts");
        }

        return (await response.json()) as PostsResponse;
      })
      .then((payload) => {
        setPosts(payload.posts);
        setTotal(payload.total);
      })
      .catch((fetchError) => {
        if (fetchError.name === "AbortError") {
          return;
        }

        console.error(fetchError);
        setError(fetchError instanceof Error ? fetchError.message : "Unknown error");
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [page, pageSize, searchTerm, statusFilter]);

  const pageCount = useMemo(() => {
    return total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  }, [pageSize, total]);

  const canGoBack = page > 1;
  const canGoForward = page < pageCount;

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);

  const handleDelete = (postId: number) => {
    if (!window.confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
      return;
    }

    setDeletingId(postId);
    setError(null);

    startTransition(() => {
      fetch(`/api/posts/${postId}`, { method: "DELETE" })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to delete post");
          }

          setPosts((current) => current.filter((post) => post.id !== postId));
          setTotal((current) => Math.max(0, current - 1));
        })
        .catch((deleteError) => {
          console.error(deleteError);
          setError(deleteError instanceof Error ? deleteError.message : "Failed to delete post");
        })
        .finally(() => {
          setDeletingId(null);
        });
    });
  };

  const handleIncrementView = (postId: number) => {
    setViewUpdateId(postId);
    setError(null);

    startTransition(() => {
      fetch(`/api/posts/${postId}/view`, { method: "POST" })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Failed to update view count");
          }

          return (await response.json()) as { id: number; viewCount: number };
        })
        .then((payload) => {
          setPosts((current) =>
            current.map((post) => (post.id === payload.id ? { ...post, viewCount: payload.viewCount } : post)),
          );
        })
        .catch((viewError) => {
          console.error(viewError);
          setError(viewError instanceof Error ? viewError.message : "Failed to update view count");
        })
        .finally(() => {
          setViewUpdateId(null);
        });
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <label htmlFor="post-status" className="text-sm font-medium text-muted-foreground">
            Status
          </label>
          <select
            id="post-status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full lg:w-72">
          <Input
            placeholder="Search posts..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium">Views</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 && !loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>
                  No posts found.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="border-b last:border-0">
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-sm text-foreground">{post.title ?? "Untitled"}</span>
                      <span className="text-xs text-muted-foreground">/{post.slug}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={post.status} />
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{formatDateTime(post.updatedAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span>{post.viewCount}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleIncrementView(post.id)}
                        disabled={viewUpdateId === post.id}
                      >
                        {viewUpdateId === post.id ? "Updating..." : "+1"}
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/posts/${post.id}`}>Edit</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "text-destructive hover:text-destructive focus-visible:text-destructive",
                          deletingId === post.id && "opacity-70",
                        )}
                        onClick={() => handleDelete(post.id)}
                        disabled={deletingId === post.id}
                      >
                        {deletingId === post.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(loading || isPending) && (
        <div className="text-sm text-muted-foreground">Loading posts…</div>
      )}

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {rangeStart} – {rangeEnd} of {total} posts
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={!canGoBack}>
            Previous
          </Button>
          <span>
            Page {page} of {pageCount}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={!canGoForward}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
