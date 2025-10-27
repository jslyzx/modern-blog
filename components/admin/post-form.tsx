"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminPostDetails, PostStatus } from "@/lib/admin/posts";
import type { TagOption } from "@/lib/admin/tags";
import { slugify } from "@/lib/slug";

interface PostFormProps {
  mode: "create" | "edit";
  post?: AdminPostDetails;
  tags: TagOption[];
}

const statusOptions: Array<{ value: PostStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const ensureUniqueIds = (values: number[]) => Array.from(new Set(values));

export function PostForm({ mode, post, tags }: PostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(post?.coverImageUrl ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [status, setStatus] = useState<PostStatus>(post?.status ?? "draft");
  const [featured, setFeatured] = useState(post?.featured ?? false);
  const [allowComments, setAllowComments] = useState(post?.allowComments ?? true);
  const [tagIds, setTagIds] = useState<number[]>(ensureUniqueIds(post?.tags.map((tag) => tag.id) ?? []));
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PostStatus | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => a.name.localeCompare(b.name)),
    [tags],
  );

  const endpoint = mode === "create" ? "/api/posts" : `/api/posts/${post?.id ?? ""}`;
  const method = mode === "create" ? "POST" : "PUT";

  const handleTitleChange = (value: string) => {
    setTitle(value);

    if (!slugTouched) {
      setSlug(slugify(value));
    }
  };

  const regenerateSlug = () => {
    const next = slugify(title);
    setSlug(next);
    setSlugTouched(false);
  };

  const toggleTag = (tagId: number) => {
    setTagIds((previous) => {
      if (previous.includes(tagId)) {
        return previous.filter((id) => id !== tagId);
      }

      return ensureUniqueIds([...previous, tagId]);
    });
  };

  const resetMessages = () => {
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = (targetStatus: PostStatus) => {
    resetMessages();

    const resolvedTitle = title.trim();
    const resolvedSlug = (slugTouched ? slug : slug || slugify(title)).trim();

    if (!resolvedTitle) {
      setFormError("Title is required.");
      return;
    }

    if (!resolvedSlug) {
      setFormError("Slug is required.");
      return;
    }

    if (!content || !content.replace(/<[^>]+>/g, "").trim()) {
      setFormError("Content cannot be empty.");
      return;
    }

    setSlug(resolvedSlug);

    const payload: Record<string, unknown> = {
      title: resolvedTitle,
      slug: resolvedSlug,
      content,
      excerpt: excerpt.trim() ? excerpt.trim() : null,
      coverImageUrl: coverImageUrl.trim() ? coverImageUrl.trim() : null,
      status: targetStatus,
      allowComments,
      featured,
      tagIds,
    };

    if (mode === "edit" && post?.publishedAt) {
      payload.publishedAt = post.publishedAt.toISOString();
    }

    setPendingAction(targetStatus);
    setStatus(targetStatus);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(endpoint, {
            method,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            let message = "Failed to save post.";

            try {
              const data = await response.json();
              if (data?.error) {
                message = data.error;
              }
            } catch (parseError) {
              console.error("Failed to parse error response", parseError);
            }

            setFormError(message);
            return;
          }

          const data = await response.json();
          const savedPost = data?.data as AdminPostDetails | undefined;

          if (mode === "create" && savedPost?.id) {
            router.replace(`/admin/posts/${savedPost.id}/edit`);
            return;
          }

          router.refresh();
          setSuccessMessage("Post saved successfully.");
        } catch (error) {
          console.error("Failed to submit post", error);
          setFormError("Failed to save post. Please try again.");
        } finally {
          setPendingAction(null);
        }
      })();
    });
  };

  const pendingLabel = (action: PostStatus, defaultLabel: string) => {
    if (!isPending || pendingAction !== action) {
      return defaultLabel;
    }

    switch (action) {
      case "draft":
        return "Saving...";
      case "published":
        return "Publishing...";
      case "archived":
        return "Archiving...";
      default:
        return defaultLabel;
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Title</label>
            <Input value={title} onChange={(event) => handleTitleChange(event.target.value)} placeholder="Post title" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Slug</label>
            <div className="flex gap-2">
              <Input
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value);
                  setSlugTouched(true);
                }}
                placeholder="auto-generated-from-title"
              />
              <Button type="button" variant="outline" onClick={regenerateSlug}>
                Refresh
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Used in the URL. Only lowercase letters, numbers, and hyphens.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Summary / excerpt</label>
            <textarea
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none"
              placeholder="Optional summary displayed in lists or SEO metadata"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Content</label>
            <RichTextEditor value={content} onChange={setContent} />
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border bg-card p-4 shadow-sm space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Status</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as PostStatus)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Cover image URL</label>
              <Input
                value={coverImageUrl}
                onChange={(event) => setCoverImageUrl(event.target.value)}
                placeholder="https://example.com/cover.jpg"
                type="url"
              />
              <p className="text-xs text-muted-foreground">Provide a full image URL for the header banner.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tags</label>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-dashed p-3">
                {sortedTags.length ? (
                  sortedTags.map((tag) => {
                    const checked = tagIds.includes(tag.id);

                    return (
                      <label key={tag.id} className="flex items-center gap-3 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTag(tag.id)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                        />
                        <span>
                          #{tag.name}
                          <span className="ml-1 text-xs text-muted-foreground">({tag.slug})</span>
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground">No tags available yet.</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Selected tags: {tagIds.length}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Options</label>
              <div className="space-y-2 text-sm text-foreground">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(event) => setFeatured(event.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  />
                  Featured on homepage
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allowComments}
                    onChange={(event) => setAllowComments(event.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  />
                  Allow comments
                </label>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {formError ? (
        <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSubmit("draft")}
          disabled={isPending}
        >
          {pendingLabel("draft", "Save draft")}
        </Button>
        <Button
          type="button"
          onClick={() => handleSubmit("published")}
          disabled={isPending}
        >
          {pendingLabel("published", mode === "create" ? "Publish" : "Publish changes")}
        </Button>
        {mode === "edit" ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleSubmit("archived")}
            disabled={isPending}
            className="text-muted-foreground"
          >
            {pendingLabel("archived", "Archive")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
