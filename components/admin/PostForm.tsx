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
  excerpt: string;
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
      excerpt: "",
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
        throw new Error(result.error || "Failed to save post");
      }

      router.push("/admin/posts");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
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
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Enter post title"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            value={formData.slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="post-url-slug"
            required
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">Auto-generated from title, but editable</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="excerpt">Summary</Label>
        <Textarea
          id="excerpt"
          value={formData.excerpt}
          onChange={(e) => setFormData((prev) => ({ ...prev, excerpt: e.target.value }))}
          placeholder="Brief summary of the post (optional)"
          rows={3}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="coverImageUrl">Cover Image URL</Label>
        <Input
          id="coverImageUrl"
          value={formData.coverImageUrl}
          onChange={(e) => setFormData((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
          placeholder="https://example.com/image.jpg"
          type="url"
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">Upload feature can be added later</p>
      </div>

      <div className="space-y-2">
        <Label>Content *</Label>
        <PostEditor
          content={formData.content}
          onChange={(content) => setFormData((prev) => ({ ...prev, content }))}
        />
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-semibold">Tags</h3>
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
            <p className="text-sm text-muted-foreground">No tags available. Create tags first.</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value as any }))}
            disabled={loading}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="featured">Featured</Label>
            <Switch
              id="featured"
              checked={formData.featured}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, featured: checked }))}
              disabled={loading}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="allowComments">Allow Comments</Label>
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
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={(e) => handleSubmit(e, "draft")}
          disabled={loading || !formData.title}
        >
          Save as Draft
        </Button>
        <Button
          type="button"
          onClick={(e) => handleSubmit(e, "published")}
          disabled={loading || !formData.title}
        >
          {loading ? "Saving..." : "Publish"}
        </Button>
      </div>
    </form>
  );
}
