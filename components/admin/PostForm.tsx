"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { PostEditor } from "@/components/admin/PostEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface Tag {
  id: number;
  name: string;
}

interface PostFormData {
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverImageUrl: string;
  status: "draft" | "published" | "archived";
  featured: boolean;
  allowComments: boolean;
  tags: number[];
}

interface PostFormProps {
  initialData?: PostFormData;
  postId?: number;
  availableTags: Tag[];
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w\-\u4e00-\u9fa5]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function PostForm({ initialData, postId, availableTags }: PostFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<PostFormData>(
    initialData ?? {
      title: "",
      slug: "",
      summary: "",
      content: "",
      coverImageUrl: "",
      status: "draft",
      featured: false,
      allowComments: true,
      tags: [],
    },
  );
  const [autoSlug, setAutoSlug] = useState(!initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTitleChange = (title: string) => {
    setFormData((prev) => ({
      ...prev,
      title,
      slug: autoSlug ? generateSlug(title) : prev.slug,
    }));
  };

  const handleSlugChange = (slug: string) => {
    setAutoSlug(false);
    setFormData((prev) => ({ ...prev, slug }));
  };

  const handleTagToggle = (tagId: number) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tagId) ? prev.tags.filter((id) => id !== tagId) : [...prev.tags, tagId],
    }));
  };

  const handleSubmit = async (e: FormEvent, submitStatus: "draft" | "published") => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        status: submitStatus,
        slug: formData.slug || generateSlug(formData.title),
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
            placeholder="wenzhang-lianjie"
            required
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">将自动根据标题生成，可手动修改</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="summary">摘要</Label>
        <Textarea
          id="summary"
          value={formData.summary}
          onChange={(e) => setFormData((prev) => ({ ...prev, summary: e.target.value }))}
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
          onChange={(e) => setFormData((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
          placeholder="https://example.com/image.jpg"
          type="url"
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">后续可支持上传功能</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">内容 *</Label>
        <PostEditor
          content={formData.content}
          onChange={(content) => setFormData((prev) => ({ ...prev, content }))}
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
            onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value as any }))}
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
            <Label htmlFor="featured">推荐</Label>
            <Switch
              id="featured"
              checked={formData.featured}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, featured: checked }))}
              disabled={loading}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="allowComments">允许评论</Label>
            <Switch
              id="allowComments"
              checked={formData.allowComments}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, allowComments: checked }))}
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
