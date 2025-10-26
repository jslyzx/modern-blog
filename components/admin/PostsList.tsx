"use client";
// 类型定义
type PostStatus = 'draft' | 'published' | 'archived';
type PostStatusFilter = PostStatus | 'all';

interface AdminPost {
  id: number;
  title: string;
  slug: string;
  status: PostStatus;
  author_id: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

// 常量
const POST_STATUS_FILTERS: Array<{ value: PostStatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'published', label: '已发布' },
  { value: 'draft', label: '草稿' },
  { value: 'archived', label: '已归档' }
];

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_LABELS: Record<PostStatusFilter, string> = {
  all: "All",
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

const STATUS_BADGE_VARIANTS: Record<PostStatus, BadgeProps["variant"]> = {
  published: "success",
  draft: "secondary",
  archived: "outline",
};

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch (error) {
    console.warn("Failed to format date", { error });
    return date.toLocaleString();
  }
};

type PostsListProps = {
  posts: AdminPost[];
  statusFilter: PostStatusFilter;
  searchQuery: string;
};

export default function PostsList({ posts, statusFilter, searchQuery }: PostsListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [statusValue, setStatusValue] = useState<PostStatusFilter>(statusFilter);
  const [searchValue, setSearchValue] = useState(searchQuery);
  const [deleteTarget, setDeleteTarget] = useState<AdminPost | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startTransition] = useTransition();

  useEffect(() => {
    setStatusValue(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);

  const hasPosts = posts.length > 0;

  const statusOptions = useMemo(() => POST_STATUS_FILTERS.map((value) => ({ value, label: STATUS_LABELS[value] })), []);

  const updateFilters = (nextStatus: PostStatusFilter, nextSearch: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextStatus === "all") {
      params.delete("status");
    } else {
      params.set("status", nextStatus);
    }

    if (nextSearch) {
      params.set("search", nextSearch);
    } else {
      params.delete("search");
    }

    const query = params.toString();

    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  };

  const handleStatusChange = (nextStatus: PostStatusFilter) => {
    setStatusValue(nextStatus);
    updateFilters(nextStatus, searchValue.trim());
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateFilters(statusValue, searchValue.trim());
  };

  const handleClearSearch = () => {
    setSearchValue("");
    updateFilters(statusValue, "");
  };

  const handleToggleStatus = async (post: AdminPost) => {
    if (post.status === "archived") {
      return;
    }

    const nextStatus: PostStatus = post.status === "published" ? "draft" : "published";

    setTogglingId(post.id);
    setError(null);

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      let payload: unknown = null;

      if (response.headers.get("content-type")?.includes("application/json")) {
        try {
          payload = await response.json();
        } catch (parseError) {
          console.warn("Failed to parse PATCH response", parseError);
        }
      }

      if (!response.ok) {
        const message = typeof (payload as { error?: unknown })?.error === "string" ? payload.error : "Failed to update post status.";
        throw new Error(message);
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (toggleError) {
      console.error("Failed to toggle post status", toggleError);
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update post status.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeletingId(deleteTarget.id);
    setError(null);

    try {
      const response = await fetch(`/api/posts/${deleteTarget.id}`, {
        method: "DELETE",
      });

      let payload: unknown = null;

      if (response.headers.get("content-type")?.includes("application/json")) {
        try {
          payload = await response.json();
        } catch (parseError) {
          console.warn("Failed to parse DELETE response", parseError);
        }
      }

      if (!response.ok) {
        const message = typeof (payload as { error?: unknown })?.error === "string" ? payload.error : "Failed to delete post.";
        throw new Error(message);
      }

      setDeleteTarget(null);

      startTransition(() => {
        router.refresh();
      });
    } catch (deleteError) {
      console.error("Failed to delete post", deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete post.");
    } finally {
      setDeletingId(null);
    }
  };

  const isProcessing = isRefreshing || deletingId !== null || togglingId !== null;

  return (
    <div className="space-y-6">
      {error ? <Alert>{error}</Alert> : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSearchSubmit} className="flex w-full max-w-sm items-center gap-2">
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search by title"
            name="search"
            className="flex-1"
          />
          {searchValue ? (
            <Button type="button" variant="ghost" onClick={handleClearSearch} disabled={isProcessing}>
              Clear
            </Button>
          ) : null}
          <Button type="submit" variant="secondary" disabled={isProcessing}>
            Search
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm font-medium text-muted-foreground">
            Status
          </label>
          <select
            id="status-filter"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={statusValue}
            onChange={(event) => handleStatusChange(event.target.value as PostStatusFilter)}
            disabled={isProcessing}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasPosts ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => {
                const authorLabel = post.authorName ?? post.authorEmail ?? "—";
                const badgeVariant = STATUS_BADGE_VARIANTS[post.status];
                const toggleLabel = post.status === "published" ? "Unpublish" : "Publish";
                const canToggle = post.status === "draft" || post.status === "published";
                const isDeleting = deletingId === post.id;
                const isToggling = togglingId === post.id;

                return (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{post.title}</div>
                        <div className="text-xs text-muted-foreground">Slug: {post.slug}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant}>{STATUS_LABELS[post.status]}</Badge>
                    </TableCell>
                    <TableCell>{authorLabel}</TableCell>
                    <TableCell>{formatDateTime(post.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/posts/${post.id}/edit`}>Edit</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(post)}
                          disabled={!canToggle || isToggling || isDeleting || isRefreshing}
                        >
                          {isToggling ? "Updating..." : toggleLabel}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteTarget(post)}
                          disabled={isDeleting || isToggling || isRefreshing}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/20 p-12 text-center">
          <p className="text-sm font-medium text-foreground">No posts found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your filters or search to find what you are looking for."
              : "Get started by creating your first post."}
          </p>
        </div>
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && deletingId === null) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete post</DialogTitle>
            <DialogDescription>
              {deleteTarget ? `Are you sure you want to delete “${deleteTarget.title}”? This action cannot be undone.` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deletingId !== null}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deletingId !== null}
            >
              {deletingId !== null ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
