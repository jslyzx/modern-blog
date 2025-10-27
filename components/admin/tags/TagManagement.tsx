"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface TagSummary {
  id: number;
  name: string;
  slug: string;
  postCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface TagManagementProps {
  initialTags: TagSummary[];
  initialPagination: PaginationState;
  initialSearch?: string;
}

const DEFAULT_PAGE_SIZE = 20;

const normalizeSearch = (value: string): string => value.trim();

export function TagManagement({ initialTags, initialPagination, initialSearch = "" }: TagManagementProps) {
  const [tags, setTags] = useState<TagSummary[]>(initialTags);
  const [pagination, setPagination] = useState<PaginationState>(initialPagination);
  const [search, setSearch] = useState<string>(normalizeSearch(initialSearch));
  const [searchInput, setSearchInput] = useState<string>(normalizeSearch(initialSearch));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingTag, setEditingTag] = useState<TagSummary | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deletingTag, setDeletingTag] = useState<TagSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageSize = pagination?.pageSize || DEFAULT_PAGE_SIZE;

  useEffect(() => {
    setTags(initialTags);
    setPagination(initialPagination);
  }, [initialTags, initialPagination]);

  const fetchTags = useCallback(
    async (page: number, searchTerm: string) => {
      const trimmedSearch = normalizeSearch(searchTerm);

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        if (trimmedSearch) {
          params.set("search", trimmedSearch);
        }

        const response = await fetch(`/api/tags?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "加载标签失败");
        }

        setTags(Array.isArray(data.tags) ? (data.tags as TagSummary[]) : []);
        setPagination(data.pagination as PaginationState);
        setSearch(trimmedSearch);
        setSearchInput(trimmedSearch);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载标签失败");
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  const handleSearchSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await fetchTags(1, searchInput);
    },
    [fetchTags, searchInput],
  );

  const handleResetSearch = useCallback(async () => {
    setSearchInput("");
    await fetchTags(1, "");
  }, [fetchTags]);

  const handleCreateTag = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const name = normalizeSearch(newTagName);

      if (!name) {
        setError("标签名称不能为空");
        return;
      }

      setCreating(true);
      setError(null);

      try {
        const response = await fetch("/api/tags", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "创建标签失败");
        }

        setNewTagName("");
        await fetchTags(1, search);
      } catch (err) {
        setError(err instanceof Error ? err.message : "创建标签失败");
      } finally {
        setCreating(false);
      }
    },
    [fetchTags, newTagName, search],
  );

  const openEditDialog = useCallback((tag: TagSummary) => {
    setEditingTag(tag);
    setEditingName(tag.name);
    setEditError(null);
  }, []);

  const closeEditDialog = useCallback(() => {
    setEditingTag(null);
    setEditingName("");
    setEditError(null);
  }, []);

  const handleUpdateTag = useCallback(async () => {
    if (!editingTag) {
      return;
    }

    const name = normalizeSearch(editingName);

    if (!name) {
      setEditError("标签名称不能为空");
      return;
    }

    setUpdating(true);
    setEditError(null);

    try {
      const response = await fetch(`/api/tags/${editingTag.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "更新标签失败");
      }

      const updatedTag = data.tag as TagSummary;

      setTags((prev) => prev.map((tag) => (tag.id === updatedTag.id ? updatedTag : tag)));
      closeEditDialog();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "更新标签失败");
    } finally {
      setUpdating(false);
    }
  }, [closeEditDialog, editingName, editingTag]);

  const openDeleteDialog = useCallback((tag: TagSummary) => {
    setDeletingTag(tag);
    setDeleteError(null);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeletingTag(null);
    setDeleteError(null);
  }, []);

  const handleDeleteTag = useCallback(async () => {
    if (!deletingTag) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/tags/${deletingTag.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "删除标签失败");
      }

      const nextTotal = Math.max(0, pagination.total - 1);
      const currentPageSize = pagination.pageSize || DEFAULT_PAGE_SIZE;
      const maxPage = currentPageSize > 0 ? Math.max(1, Math.ceil(nextTotal / currentPageSize)) : 1;
      const nextPage = Math.min(pagination.page, maxPage);

      await fetchTags(nextPage, search);
      closeDeleteDialog();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "删除标签失败");
    } finally {
      setDeleting(false);
    }
  }, [closeDeleteDialog, deletingTag, fetchTags, pagination.page, pagination.pageSize, pagination.total, search]);

  const handlePrevPage = useCallback(async () => {
    if (pagination.page <= 1 || loading) {
      return;
    }

    await fetchTags(pagination.page - 1, search);
  }, [fetchTags, loading, pagination.page, search]);

  const handleNextPage = useCallback(async () => {
    if (!pagination.hasNextPage || loading) {
      return;
    }

    await fetchTags(pagination.page + 1, search);
  }, [fetchTags, loading, pagination.hasNextPage, pagination.page, search]);

  const pageInfo = useMemo(() => {
    const total = pagination.total ?? 0;
    const page = pagination.page ?? 1;
    const pageCount = pagination.pageCount ?? (pageSize > 0 ? Math.ceil(total / pageSize) : 1);

    return { total, page, pageCount };
  }, [pageSize, pagination.page, pagination.pageCount, pagination.total]);

  return (
    <div className="space-y-6">
      <form className="flex flex-col gap-3 md:flex-row" onSubmit={handleSearchSubmit}>
        <div className="flex-1">
          <Label htmlFor="tagSearchInput" className="sr-only">
            搜索标签
          </Label>
          <Input
            id="tagSearchInput"
            placeholder="输入标签名称或拼音搜索"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            disabled={loading}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            搜索
          </Button>
          <Button type="button" variant="outline" onClick={handleResetSearch} disabled={loading || !search}>
            重置
          </Button>
        </div>
      </form>

      <form className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center" onSubmit={handleCreateTag}>
        <div className="flex-1">
          <Label htmlFor="newTagInput" className="sr-only">
            新建标签
          </Label>
          <Input
            id="newTagInput"
            placeholder="输入新的标签名称"
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            disabled={creating}
          />
        </div>
        <Button type="submit" disabled={creating}>
          {creating ? "创建中..." : "新建标签"}
        </Button>
      </form>

      {error ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">名称</TableHead>
              <TableHead className="w-[30%]">别名</TableHead>
              <TableHead>文章数</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !tags.length ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  正在加载标签...
                </TableCell>
              </TableRow>
            ) : null}

            {!loading && tags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  暂无标签。
                </TableCell>
              </TableRow>
            ) : null}

            {tags.map((tag) => (
              <TableRow key={tag.id}>
                <TableCell className="font-medium">{tag.name}</TableCell>
                <TableCell className="text-muted-foreground">{tag.slug}</TableCell>
                <TableCell>{tag.postCount}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(tag)}>
                      编辑
                    </Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => openDeleteDialog(tag)}>
                      删除
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground md:flex-row">
        <div>
          第 {pageInfo.page} 页，共 {pageInfo.pageCount || 1} 页，{pageInfo.total} 个标签
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handlePrevPage} disabled={loading || pagination.page <= 1}>
            上一页
          </Button>
          <Button type="button" variant="outline" onClick={handleNextPage} disabled={loading || !pagination.hasNextPage}>
            下一页
          </Button>
        </div>
      </div>

      <Dialog open={Boolean(editingTag)} onOpenChange={(open) => (!open ? closeEditDialog() : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑标签</DialogTitle>
            <DialogDescription>更新标签名称时，系统会自动生成新的拼音别名。</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="editTagName">标签名称</Label>
            <Input
              id="editTagName"
              value={editingName}
              onChange={(event) => setEditingName(event.target.value)}
              disabled={updating}
            />
          </div>

          {editError ? (
            <div className="rounded border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {editError}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEditDialog} disabled={updating}>
              取消
            </Button>
            <Button type="button" onClick={handleUpdateTag} disabled={updating}>
              {updating ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingTag)} onOpenChange={(open) => (!open ? closeDeleteDialog() : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除标签</DialogTitle>
            <DialogDescription>删除后，标签将从所有文章中移除，且无法恢复。</DialogDescription>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            确认删除标签
            {deletingTag ? `「${deletingTag.name}」` : ""}?
          </p>

          {deleteError ? (
            <div className="rounded border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDeleteDialog} disabled={deleting}>
              取消
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteTag} disabled={deleting}>
              {deleting ? "删除中..." : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
