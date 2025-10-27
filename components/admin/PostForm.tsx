"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { PostEditor } from "@/components/admin/PostEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { generateSlug } from "@/lib/slug";

interface Tag {
  id: number;
  name: string;
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
  tags: number[];
}

interface PostFormProps {
  initialData?: PostFormData;
  postId?: number;
  availableTags: Tag[];
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
  tags: [],
});

const cloneFormData = (data: PostFormData): PostFormData => ({
  ...data,
  tags: [...data.tags],
});

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

  if (a.tags.length !== b.tags.length) {
    return false;
  }

  return a.tags.every((tagId, index) => tagId === b.tags[index]);
};

export function PostForm({ initialData, postId, availableTags }: PostFormProps) {
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

  const handleTagToggle = (tagId: number) => {
    setFormData((prev) => {
      if (!prev) {
        return prev;
      }

      const tags = prev.tags.includes(tagId)
        ? prev.tags.filter((id) => id !== tagId)
        : [...prev.tags, tagId];

      return { ...prev, tags };
    });
  };

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
          contentHtml={formData.contentHtml}
          onChange={(content) => setFormData((prev) => (prev ? { ...prev, contentHtml: content } : prev))}
        />
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-semibold">标签</h3>
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleTagToggle(tag.id)}
              disabled={loading}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                formData.tags.includes(tag.id)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-muted"
              }`}
            >
              {tag.name}
            </button>
          ))}
          {availableTags.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无可用标签，请先创建标签。</p>
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
