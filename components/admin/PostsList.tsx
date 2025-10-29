"use client";

import { useEffect, useMemo, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { AdminPost, BulkPostAction, PostStatus, PostStatusFilter } from "@/lib/admin/types/post";
import { DEFAULT_POST_STATUS_FILTER, isPostStatusFilter, POST_STATUS_FILTERS } from "@/lib/admin/types/post";
import { useToast } from "@/components/ui/use-toast";

const STATUS_LABELS: Record<PostStatusFilter, string> = {
  all: "全部",
  published: "已发布",
  draft: "草稿",
  archived: "已归档",
};

const STATUS_BADGE_VARIANTS: Record<PostStatus, BadgeProps["variant"]> = {
  published: "success",
  draft: "secondary",
  archived: "outline",
};

const BULK_ACTION_ORDER: BulkPostAction[] = ["delete", "publish", "draft", "archive"];

const BULK_ACTION_LABELS: Record<BulkPostAction, string> = {
  delete: "批量删除",
  publish: "批量发布",
  draft: "批量设为草稿",
  archive: "批量归档",
};

const BULK_ACTION_PENDING_LABELS: Record<BulkPostAction, string> = {
  delete: "删除中...",
  publish: "发布中...",
  draft: "更新中...",
  archive: "归档中...",
};

const BULK_ACTION_TOAST_TITLES: Record<BulkPostAction, string> = {
  delete: "批量删除完成",
  publish: "批量发布完成",
  draft: "状态更新完成",
  archive: "批量归档完成",
};

const BULK_ACTION_SUCCESS_DESCRIPTIONS: Record<BulkPostAction, (count: number) => string> = {
  delete: (count) => `已删除 ${count} 篇文章`,
  publish: (count) => `已发布 ${count} 篇文章`,
  draft: (count) => `已设为草稿 ${count} 篇文章`,
  archive: (count) => `已归档 ${count} 篇文章`,
};

const DEFAULT_BULK_ERROR_MESSAGE = "批量操作失败。";
const PARTIAL_BULK_ERROR_MESSAGE = "部分文章处理失败。";

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

type BulkActionResponse = {
  successCount?: number;
  errors?: Array<{ id?: number; message?: string }>;
};

export default function PostsList({ posts, statusFilter, searchQuery }: PostsListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [statusValue, setStatusValue] = useState<PostStatusFilter>(statusFilter);
  const [searchValue, setSearchValue] = useState(searchQuery);
  const [deleteTarget, setDeleteTarget] = useState<AdminPost | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [bulkActionInFlight, setBulkActionInFlight] = useState<BulkPostAction | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startTransition] = useTransition();

  useEffect(() => {
    setStatusValue(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    setSelectedIds([]);
  }, [statusFilter, searchQuery]);

  const postIdSet = useMemo(() => new Set(posts.map((post) => post.id)), [posts]);

  useEffect(() => {
    setSelectedIds((previous) => {
      if (!previous.length) {
        return previous;
      }

      const filtered = previous.filter((id) => postIdSet.has(id));
      return filtered.length === previous.length ? previous : filtered;
    });
  }, [postIdSet]);

  const hasPosts = posts.length > 0;
  const selectedCount = selectedIds.length;
  const allSelected = hasPosts && selectedCount > 0 && selectedCount === posts.length;
  const isIndeterminateSelection = selectedCount > 0 && selectedCount < posts.length;

  const statusOptions = useMemo(
    () =>
      POST_STATUS_FILTERS.map((item) => ({
        value: item,
        label: STATUS_LABELS[item],
      })),
    [],
  );

  const updateFilters = (nextStatus: PostStatusFilter, nextSearch: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextStatus === DEFAULT_POST_STATUS_FILTER) {
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

  const handleStatusChange = (nextStatus: string) => {
    if (!isPostStatusFilter(nextStatus)) {
      return;
    }

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
        const message = typeof (payload as { error?: unknown })?.error === "string" ? (payload as { error: string }).error : "更新文章状态失败。";
        throw new Error(message);
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (toggleError) {
      console.error("Failed to toggle post status", toggleError);
      setError(toggleError instanceof Error ? toggleError.message : "更新文章状态失败。");
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
        const message = typeof (payload as { error?: unknown })?.error === "string" ? (payload as { error: string }).error : "删除文章失败。";
        throw new Error(message);
      }

      setDeleteTarget(null);

      startTransition(() => {
        router.refresh();
      });
    } catch (deleteError) {
      console.error("Failed to delete post", deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "删除文章失败。");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelection = (postId: number, checked: boolean) => {
    setSelectedIds((previous) => {
      if (checked) {
        return previous.includes(postId) ? previous : [...previous, postId];
      }

      return previous.filter((id) => id !== postId);
    });
  };

  const handleRowSelectionChange = (postId: number) => (event: ChangeEvent<HTMLInputElement>) => {
    toggleSelection(postId, event.target.checked);
  };

  const handleSelectAllChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(posts.map((post) => post.id));
    } else {
      setSelectedIds([]);
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const performBulkAction = async (action: BulkPostAction) => {
    const ids = [...selectedIds];

    if (!ids.length) {
      return;
    }

    setBulkActionInFlight(action);
    setIsBulkProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/posts/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, ids }),
      });

      let payload: unknown = null;

      if (response.headers.get("content-type")?.includes("application/json")) {
        try {
          payload = await response.json();
        } catch (parseError) {
          console.warn("Failed to parse bulk action response", parseError);
        }
      }

      if (!response.ok) {
        const message = typeof (payload as { error?: unknown })?.error === "string" ? (payload as { error: string }).error : DEFAULT_BULK_ERROR_MESSAGE;
        throw new Error(message);
      }

      const data = (payload ?? {}) as BulkActionResponse;
      const successCount = typeof data.successCount === "number" ? data.successCount : 0;
      const errors = Array.isArray(data.errors) ? data.errors : [];

      const failureMessages = errors
        .map((entry) => (typeof entry?.message === "string" ? entry.message : null))
        .filter((message): message is string => Boolean(message));

      const failedIds = errors
        .map((entry) => (typeof entry?.id === "number" ? entry.id : null))
        .filter((id): id is number => id !== null);

      if (successCount > 0) {
        toast({
          title: BULK_ACTION_TOAST_TITLES[action],
          description: BULK_ACTION_SUCCESS_DESCRIPTIONS[action](successCount),
          variant: "success",
        });

        startTransition(() => {
          router.refresh();
        });
      }

      if (failedIds.length > 0) {
        setSelectedIds(failedIds);
        setError(failureMessages.length > 0 ? failureMessages.join("；") : PARTIAL_BULK_ERROR_MESSAGE);
      } else {
        setSelectedIds([]);
        if (!failureMessages.length) {
          setError(null);
        }
      }
    } catch (bulkError) {
      console.error("Failed to perform bulk post action", bulkError);
      setError(bulkError instanceof Error ? bulkError.message : DEFAULT_BULK_ERROR_MESSAGE);
    } finally {
      setIsBulkProcessing(false);
      setBulkActionInFlight(null);
    }
  };

  const handleBulkActionClick = (action: BulkPostAction) => {
    if (!selectedIds.length || isBulkProcessing) {
      return;
    }

    if (action === "delete") {
      setIsBulkDeleteDialogOpen(true);
      return;
    }

    void performBulkAction(action);
  };

  const handleConfirmBulkDelete = async () => {
    try {
      await performBulkAction("delete");
    } finally {
      setIsBulkDeleteDialogOpen(false);
    }
  };

  const isProcessing = isRefreshing || deletingId !== null || togglingId !== null || isBulkProcessing;

  return (
    <div className="space-y-6">
      {error ? <Alert>{error}</Alert> : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSearchSubmit} className="flex w-full max-w-sm items-center gap-2">
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="按标题搜索"
            name="search"
            className="flex-1"
            disabled={isProcessing}
          />
          {searchValue ? (
            <Button type="button" variant="ghost" onClick={handleClearSearch} disabled={isProcessing}>
              清除
            </Button>
          ) : null}
          <Button type="submit" variant="secondary" disabled={isProcessing}>
            搜索
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm font-medium text-muted-foreground">
            状态
          </label>
          <select
            id="status-filter"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={statusValue}
            onChange={(event) => handleStatusChange(event.target.value)}
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

      {hasPosts && selectedCount > 0 ? (
        <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-medium text-foreground">已选择 {selectedCount} 篇文章</p>
          <div className="flex flex-wrap items-center gap-2">
            {BULK_ACTION_ORDER.map((action) => (
              <Button
                key={action}
                type="button"
                size="sm"
                variant={action === "delete" ? "destructive" : action === "publish" ? "default" : "outline"}
                disabled={isProcessing}
                onClick={() => handleBulkActionClick(action)}
              >
                {bulkActionInFlight === action ? BULK_ACTION_PENDING_LABELS[action] : BULK_ACTION_LABELS[action]}
              </Button>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={clearSelection} disabled={isProcessing}>
              清除选择
            </Button>
          </div>
        </div>
      ) : null}

      {hasPosts ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    aria-label={allSelected ? "取消全选" : "全选"}
                    checked={allSelected}
                    indeterminate={isIndeterminateSelection}
                    onChange={handleSelectAllChange}
                    disabled={isProcessing}
                  />
                </TableHead>
                <TableHead>标题</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>作者</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => {
                const authorLabel = post.authorName ?? post.authorEmail ?? "—";
                const badgeVariant = STATUS_BADGE_VARIANTS[post.status];
                const toggleLabel = post.status === "published" ? "取消发布" : "发布";
                const canToggle = post.status === "draft" || post.status === "published";
                const isDeleting = deletingId === post.id;
                const isToggling = togglingId === post.id;
                const isSelected = selectedIds.includes(post.id);

                return (
                  <TableRow key={post.id} className={isSelected ? "bg-muted/30" : undefined}>
                    <TableCell className="w-12">
                      <Checkbox
                        aria-label={`选择文章：${post.title}`}
                        checked={isSelected}
                        onChange={handleRowSelectionChange(post.id)}
                        disabled={isProcessing}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <div>{post.title}</div>
                        <div className="text-xs text-muted-foreground">链接别名：{post.slug}</div>
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
                          <Link href={`/admin/posts/${post.id}/edit`}>编辑</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(post)}
                          disabled={!canToggle || isToggling || isDeleting || isProcessing}
                        >
                          {isToggling ? "更新中..." : toggleLabel}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteTarget(post)}
                          disabled={isDeleting || isToggling || isProcessing}
                        >
                          删除
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
          <p className="text-sm font-medium text-foreground">暂无文章</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {searchQuery || statusFilter !== "all"
              ? "尝试调整筛选条件或修改搜索关键词。"
              : "开始创建您的第一篇文章。"}
          </p>
        </div>
      )}

      <Dialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && bulkActionInFlight !== "delete") {
            setIsBulkDeleteDialogOpen(false);
          } else if (open) {
            setIsBulkDeleteDialogOpen(true);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量删除文章</DialogTitle>
            <DialogDescription>{`确定要删除选中的 ${selectedCount} 篇文章吗？此操作不可撤销。`}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsBulkDeleteDialogOpen(false)}
              disabled={bulkActionInFlight === "delete"}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmBulkDelete}
              disabled={bulkActionInFlight === "delete"}
            >
              {bulkActionInFlight === "delete" ? "删除中..." : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <DialogTitle>删除文章</DialogTitle>
            <DialogDescription>
              {deleteTarget ? `确定要删除“${deleteTarget.title}”吗？此操作不可撤销。` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deletingId !== null}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deletingId !== null}
            >
              {deletingId !== null ? "删除中..." : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
