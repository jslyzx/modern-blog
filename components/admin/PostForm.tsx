"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { PostEditor } from "@/components/admin/PostEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { generateSlug } from "@/lib/slug";

interface TagOption {
  id: number;
  name: string;
  slug: string;
}

interface PostFormData {
  title: string;
  slug: string;
  summary: string;
  contentHtml: string;
  coverImageUrl: string;
  status: "draft" | "published" | "archived";
  isFeatured: boolean;
  allowComments: boolean;
  tagIds: number[];
}

interface PostFormProps {
  initialData?: PostFormData;
  postId?: number;
  initialTags: TagOption[];
}

const createEmptyFormData = (): PostFormData => ({
  title: "",
  slug: "",
  summary: "",
  contentHtml: "",
  coverImageUrl: "",
  status: "draft",
  isFeatured: false,
  allowComments: true,
  tagIds: [],
});

const cloneFormData = (data: PostFormData): PostFormData => ({
  ...data,
  tagIds: [...data.tagIds],
});

const mergeTagOptions = (current: TagOption[], incoming: TagOption[]): TagOption[] => {
  const map = new Map<number, TagOption>();

  for (const tag of current) {
    map.set(tag.id, tag);
  }

  for (const tag of incoming) {
    map.set(tag.id, tag);
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
};

const isSameFormData = (a: PostFormData | null | undefined, b: PostFormData | null | undefined): boolean => {
  if (!a || !b) {
    return false;
  }

  if (
    a.title !== b.title ||
    a.slug !== b.slug ||
    a.summary !== b.summary ||
    a.contentHtml !== b.contentHtml ||
    a.coverImageUrl !== b.coverImageUrl ||
    a.status !== b.status ||
    a.isFeatured !== b.isFeatured ||
    a.allowComments !== b.allowComments
  ) {
    return false;
  }

  if (a.tagIds.length !== b.tagIds.length) {
    return false;
  }

  return a.tagIds.every((tagId, index) => tagId === b.tagIds[index]);
};

export function PostForm({ initialData, postId, initialTags }: PostFormProps) {
  const router = useRouter();
  const isEditing = typeof postId === "number";

  const [formData, setFormData] = useState<PostFormData | null>(() => {
    if (initialData) {
      return cloneFormData(initialData);
    }

    if (isEditing) {
      return null;
    }

    return createEmptyFormData();
  });
  const [autoSlug, setAutoSlug] = useState(!initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagOptions, setTagOptions] = useState<TagOption[]>(() => mergeTagOptions([], initialTags));
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [tagModalError, setTagModalError] = useState<string | null>(null);
  const [tagLoading, setTagLoading] = useState(false);
  const [hasLoadedTags, setHasLoadedTags] = useState(initialTags.length > 0);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    if (!initialData) {
      if (!isEditing) {
        setFormData((prev) => (prev === null ? createEmptyFormData() : prev));
      }
      return;
    }

    setFormData((prev) => {
      if (isSameFormData(prev, initialData)) {
        return prev;
      }

      return cloneFormData(initialData);
    });
    setAutoSlug(false);
  }, [initialData, isEditing]);

  useEffect(() => {
    setTagOptions((prev) => mergeTagOptions(prev, initialTags));

    if (initialTags.length > 0) {
      setHasLoadedTags(true);
    }
  }, [initialTags]);

  const editorInstanceKey = postId ? `post-${postId}` : "post-new";

  const handleTitleChange = (title: string) => {
    setFormData((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        title,
        slug: autoSlug ? generateSlug(title) : prev.slug,
      };
    });
  };

  const handleSlugChange = (slug: string) => {
    setAutoSlug(false);
    setFormData((prev) => (prev ? { ...prev, slug } : prev));
  };

  const handleSlugBlur = () => {
    setFormData((prev) => {
      if (!prev) {
        return prev;
      }

      const trimmed = prev.slug.trim();

      if (!trimmed) {
        setAutoSlug(true);
        return { ...prev, slug: generateSlug(prev.title) };
      }

      return { ...prev, slug: generateSlug(trimmed) };
    });
  };

  const fetchTags = useCallback(async () => {
    setTagLoading(true);
    setTagModalError(null);

    try {
      const response = await fetch("/api/tags?page=1&pageSize=200");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "加载标签失败");
      }

      const fetched = Array.isArray(result.tags) ? (result.tags as TagOption[]) : [];
      setTagOptions((prev) => mergeTagOptions(prev, fetched));
      setHasLoadedTags(true);
    } catch (err) {
      setTagModalError(err instanceof Error ? err.message : "加载标签失败");
    } finally {
      setTagLoading(false);
    }
  }, []);

  const handleDialogOpenChange = (open: boolean) => {
    setTagDialogOpen(open);

    if (open) {
      setTagModalError(null);

      if (!hasLoadedTags) {
        void fetchTags();
      }
    } else {
      setTagModalError(null);
      setTagSearch("");
    }
  };

  const toggleTagSelection = (tagId: number) => {
    setFormData((prev) => {
      if (!prev) {
        return prev;
      }

      const exists = prev.tagIds.includes(tagId);
      const tagIds = exists ? prev.tagIds.filter((id) => id !== tagId) : [...prev.tagIds, tagId];

      return { ...prev, tagIds };
    });
  };

  const handleRemoveTag = (tagId: number) => {
    setFormData((prev) => {
      if (!prev) {
        return prev;
      }

      if (!prev.tagIds.includes(tagId)) {
        return prev;
      }

      return {
        ...prev,
        tagIds: prev.tagIds.filter((id) => id !== tagId),
      };
    });
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();

    if (!name) {
      setTagModalError("标签名称不能为空");
      return;
    }

    setCreatingTag(true);
    setTagModalError(null);

    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "创建标签失败");
      }

      const createdTag = (result.tag ?? null) as TagOption | null;

      if (createdTag && typeof createdTag.id === "number") {
        setTagOptions((prev) => mergeTagOptions(prev, [createdTag]));
        setFormData((prev) => {
          if (!prev) {
            return prev;
          }

          if (prev.tagIds.includes(createdTag.id)) {
            return prev;
          }

          return {
            ...prev,
            tagIds: [...prev.tagIds, createdTag.id],
          };
        });
        setNewTagName("");
        setTagSearch("");
        setHasLoadedTags(true);
      }
    } catch (err) {
      setTagModalError(err instanceof Error ? err.message : "创建标签失败");
    } finally {
      setCreatingTag(false);
    }
  };

  const selectedTagIds = formData?.tagIds ?? [];

  const selectedTags = useMemo(() => {
    if (!selectedTagIds.length) {
      return [] as TagOption[];
    }

    const tagMap = new Map<number, TagOption>(tagOptions.map((tag) => [tag.id, tag]));

    return selectedTagIds.map((id) => tagMap.get(id) ?? { id, name: `标签 ${id}`, slug: String(id) });
  }, [selectedTagIds, tagOptions]);

  const filteredTags = useMemo(() => {
    const keyword = tagSearch.trim().toLowerCase();

    if (!keyword) {
      return tagOptions;
    }

    return tagOptions.filter((tag) =>
      tag.name.toLowerCase().includes(keyword) || tag.slug.toLowerCase().includes(keyword),
    );
  }, [tagOptions, tagSearch]);

  const handleSubmit = async (e: FormEvent, submitStatus: "draft" | "published") => {
    e.preventDefault();

    if (!formData) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const normalizedSlug = formData.slug.trim() ? generateSlug(formData.slug) : generateSlug(formData.title);

      const payload = {
        ...formData,
        status: submitStatus,
        slug: normalizedSlug,
        tags: formData.tagIds,
      };

      const url = postId ? `/api/posts/${postId}` : "/api/posts";
      const method = postId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "保存文章失败");
      }

      router.push("/admin/posts");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "发生未知错误");
      setLoading(false);
    }
  };

  if (!formData) {
    return <PostFormSkeleton />;
  }

  return (
    <form className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">标题 *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="请输入文章标题"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">链接别名 *</Label>
          <Input
            id="slug"
            value={formData.slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            onBlur={handleSlugBlur}
            placeholder="wenzhang-lianjie"
            required
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">留空则自动根据标题生成（中文将转拼音）</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="summary">摘要</Label>
        <Textarea
          id="summary"
          value={formData.summary}
          onChange={(e) => setFormData((prev) => (prev ? { ...prev, summary: e.target.value } : prev))}
          placeholder="请输入文章简要摘要（可选）"
          rows={3}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="coverImageUrl">封面图片地址</Label>
        <Input
          id="coverImageUrl"
          value={formData.coverImageUrl}
          onChange={(e) => setFormData((prev) => (prev ? { ...prev, coverImageUrl: e.target.value } : prev))}
          placeholder="https://example.com/image.jpg"
          type="url"
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">后续可支持上传功能</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">内容 *</Label>
        <PostEditor
          key={editorInstanceKey}
          editorKey={editorInstanceKey}
          content={formData.contentHtml}
          onChange={(content) => setFormData((prev) => (prev ? { ...prev, contentHtml: content } : prev))}
        />
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">标签</h3>
          <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(true)} disabled={loading}>
            选择标签
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">为文章选择多个相关标签，便于内容分类和展示。</p>
        <div className="flex flex-wrap gap-2">
          {selectedTags.length ? (
            selectedTags.map((tag) => (
              <span
                key={tag.id}
                className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-sm"
              >
                <span>{tag.name}</span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground transition hover:text-destructive"
                  onClick={() => handleRemoveTag(tag.id)}
                  disabled={loading}
                >
                  移除
                </button>
              </span>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">尚未选择标签</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">状态</Label>
          <Select
            value={formData.status}
            onValueChange={(value) =>
              setFormData((prev) => (prev ? { ...prev, status: value as PostFormData["status"] } : prev))
            }
            disabled={loading}
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="请选择状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="published">已发布</SelectItem>
              <SelectItem value="archived">已归档</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="isFeatured">推荐</Label>
            <Switch
              id="isFeatured"
              checked={formData.isFeatured}
              onCheckedChange={(checked) => setFormData((prev) => (prev ? { ...prev, isFeatured: checked } : prev))}
              disabled={loading}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="allowComments">允许评论</Label>
            <Switch
              id="allowComments"
              checked={formData.allowComments}
              onCheckedChange={(checked) => setFormData((prev) => (prev ? { ...prev, allowComments: checked } : prev))}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 border-t pt-6">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/posts")} disabled={loading}>
          取消
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={(e) => handleSubmit(e, "draft")}
          disabled={loading || !formData.title}
        >
          保存草稿
        </Button>
        <Button
          type="button"
          onClick={(e) => handleSubmit(e, "published")}
          disabled={loading || !formData.title}
        >
          {loading ? "保存中..." : postId ? "更新" : "发布"}
        </Button>
      </div>

      <Dialog open={tagDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>选择标签</DialogTitle>
            <DialogDescription>选择或新建标签，为文章添加合适的分类。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {tagModalError ? (
              <div className="rounded border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {tagModalError}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="newTagName">新建标签</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="newTagName"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="输入标签名称"
                  disabled={creatingTag || loading}
                />
                <Button
                  type="button"
                  onClick={handleCreateTag}
                  disabled={creatingTag || loading || !newTagName.trim()}
                >
                  {creatingTag ? "创建中..." : "添加"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagSearch">搜索标签</Label>
              <Input
                id="tagSearch"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="输入标签名称或拼音"
                disabled={tagLoading}
              />
            </div>

            <div className="max-h-64 space-y-3 overflow-y-auto rounded border bg-muted/20 p-3">
              {tagLoading ? (
                <p className="text-sm text-muted-foreground">标签加载中...</p>
              ) : filteredTags.length ? (
                <div className="flex flex-wrap gap-2">
                  {filteredTags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);

                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTagSelection(tag.id)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-sm transition",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background hover:bg-muted",
                        )}
                        disabled={loading}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无匹配标签。</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

export function PostFormSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <div className="h-4 w-20 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
          <div className="h-3 w-32 rounded bg-muted/70" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-4 w-16 rounded bg-muted" />
        <div className="h-24 rounded bg-muted" />
      </div>

      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-10 rounded bg-muted" />
        <div className="h-3 w-40 rounded bg-muted/70" />
      </div>

      <div className="space-y-2">
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="h-[320px] rounded border bg-muted/60" />
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="h-5 w-12 rounded bg-muted" />
        <div className="flex flex-wrap gap-2">
          <div className="h-7 w-16 rounded-full border bg-muted" />
          <div className="h-7 w-14 rounded-full border bg-muted" />
          <div className="h-7 w-20 rounded-full border bg-muted" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-6 w-10 rounded-full bg-muted" />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-6 w-10 rounded-full bg-muted" />
          </div>
        </div>
      </div>

      <div className="flex gap-3 border-t pt-6">
        <div className="h-10 w-20 rounded bg-muted" />
        <div className="h-10 w-24 rounded bg-muted" />
        <div className="h-10 w-16 rounded bg-muted" />
      </div>
    </div>
  );
}
