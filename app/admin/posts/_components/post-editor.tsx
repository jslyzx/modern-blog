"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/slug";

type TagOption = {
  id: number;
  name: string;
  slug: string;
};

type TagsResponse = {
  tags: Array<TagOption & { usageCount: number; createdAt: string; updatedAt: string }>;
};

type PostEditorInitialPost = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
  tags: TagOption[];
};

type PostFormState = {
  title: string;
  slug: string;
  status: "draft" | "published";
  excerpt: string;
  content: string;
  publishedAt: string;
  tagIds: number[];
};

type PostEditorProps = {
  initialPost?: PostEditorInitialPost;
  mode: "create" | "edit";
  postId?: number;
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

const toDateTimeLocal = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const offsetDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
};

const fromDateTimeLocal = (value: string): string => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date");
  }

  return parsed.toISOString();
};

const textareaClassName =
  "min-h-[160px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ring-offset-background";

const selectClassName =
  "h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ring-offset-background";

export function PostEditor({ initialPost, mode, postId }: PostEditorProps) {
  const router = useRouter();

  const [formState, setFormState] = useState<PostFormState>(() => ({
    title: initialPost?.title ?? "",
    slug: initialPost?.slug ?? "",
    status: initialPost?.status ?? "draft",
    excerpt: initialPost?.excerpt ?? "",
    content: initialPost?.content ?? "",
    publishedAt: toDateTimeLocal(initialPost?.publishedAt),
    tagIds: initialPost?.tags.map((tag) => tag.id) ?? [],
  }));
  const [slugDirty, setSlugDirty] = useState(Boolean(initialPost));
  const [tags, setTags] = useState<TagOption[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    setTagsLoading(true);
    setTagsError(null);

    try {
      const data = await fetchJson<TagsResponse>("/api/tags", { cache: "no-store" });
      setTags(
        data.tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
        })),
      );
    } catch (error) {
      setTagsError(error instanceof Error ? error.message : "Failed to load tags");
    } finally {
      setTagsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags().catch(() => {
      /* handled above */
    });
  }, [loadTags]);

  const availableTags = useMemo(
    () =>
      [...tags].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [tags],
  );

  const handleTitleChange = (value: string) => {
    setFormState((prev) => {
      const nextTitle = value;
      const shouldUpdateSlug = !slugDirty;
      return {
        ...prev,
        title: nextTitle,
        slug: shouldUpdateSlug ? slugify(nextTitle) : prev.slug,
      };
    });
  };

  const handleSlugChange = (value: string) => {
    setSlugDirty(true);
    setFormState((prev) => ({
      ...prev,
      slug: value,
    }));
  };

  const toggleTag = (tagId: number) => {
    setFormState((prev) => {
      const exists = prev.tagIds.includes(tagId);
      return {
        ...prev,
        tagIds: exists ? prev.tagIds.filter((id) => id !== tagId) : [...prev.tagIds, tagId],
      };
    });
  };

  const handleStatusChange = (value: "draft" | "published") => {
    setFormState((prev) => ({
      ...prev,
      status: value,
      publishedAt: value === "draft" ? "" : prev.publishedAt,
    }));
  };

  const handlePublishedAtChange = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      publishedAt: value,
    }));
  };

  const resetMessages = () => {
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    const trimmedTitle = formState.title.trim();

    if (!trimmedTitle) {
      setFormError("Title cannot be empty");
      return;
    }

    const normalizedSlug = slugify((formState.slug || trimmedTitle).trim());

    if (!normalizedSlug) {
      setFormError("Slug cannot be empty");
      return;
    }

    let publishedAtIso: string | null = null;

    if (formState.status === "published") {
      if (formState.publishedAt) {
        try {
          publishedAtIso = fromDateTimeLocal(formState.publishedAt);
        } catch (error) {
          setFormError("Published date is invalid");
          return;
        }
      } else if (initialPost?.publishedAt) {
        publishedAtIso = initialPost.publishedAt;
      } else {
        publishedAtIso = new Date().toISOString();
      }
    }

    const excerptValue = formState.excerpt.trim();
    const hasContent = formState.content.trim().length > 0;

    const payload = {
      title: trimmedTitle,
      slug: normalizedSlug,
      status: formState.status,
      excerpt: excerptValue ? excerptValue : null,
      content: hasContent ? formState.content : null,
      publishedAt: formState.status === "published" ? publishedAtIso : null,
      tagIds: formState.tagIds,
    };

    setIsSubmitting(true);

    try {
      if (mode === "create") {
        await fetchJson("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Post created successfully");
        router.push("/admin/posts");
        router.refresh();
      } else if (mode === "edit" && typeof postId === "number") {
        await fetchJson(`/api/posts/${postId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Post updated successfully");
        router.refresh();
      } else {
        throw new Error("Invalid editor state");
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save post");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/admin/posts");
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-4 rounded-md border bg-card/50 p-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="post-title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="post-title"
            placeholder="Designing delightful experiences"
            value={formState.title}
            onChange={(event) => handleTitleChange(event.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="post-slug" className="text-sm font-medium">
            Slug
          </label>
          <Input
            id="post-slug"
            placeholder="designing-delightful-experiences"
            value={formState.slug}
            onChange={(event) => handleSlugChange(event.target.value)}
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            Slugs appear in URLs. Use lowercase letters, numbers, and hyphens.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="post-status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="post-status"
            value={formState.status}
            onChange={(event) => handleStatusChange(event.target.value as "draft" | "published")}
            className={selectClassName}
            disabled={isSubmitting}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="post-published-at" className="text-sm font-medium">
            Published at
          </label>
          <Input
            id="post-published-at"
            type="datetime-local"
            value={formState.publishedAt}
            onChange={(event) => handlePublishedAtChange(event.target.value)}
            disabled={isSubmitting || formState.status !== "published"}
          />
          <p className="text-xs text-muted-foreground">
            Set when the post should be considered published.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-md border bg-card/50 p-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="post-excerpt" className="text-sm font-medium">
            Excerpt
          </label>
          <textarea
            id="post-excerpt"
            className={textareaClassName}
            value={formState.excerpt}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                excerpt: event.target.value,
              }))
            }
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            A short summary used in listing views and SEO metadata.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="post-content" className="text-sm font-medium">
            Content
          </label>
          <textarea
            id="post-content"
            className={`${textareaClassName} min-h-[260px]`}
            value={formState.content}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                content: event.target.value,
              }))
            }
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            Supports Markdown or HTML depending on your rendering pipeline.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-md border bg-card/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tags
            </h3>
            <p className="text-xs text-muted-foreground">
              Assign tags to improve content discovery.
            </p>
          </div>
          <Button variant="ghost" size="sm" type="button" onClick={() => router.push("/admin/tags")}>
            Manage tags
          </Button>
        </div>
        {tagsLoading ? (
          <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Loading tags...
          </div>
        ) : tagsError ? (
          <div className="rounded-md border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {tagsError}
          </div>
        ) : availableTags.length === 0 ? (
          <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            No tags available yet.
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {availableTags.map((tag) => {
              const checked = formState.tagIds.includes(tag.id);
              return (
                <label
                  key={tag.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                    checked ? "border-primary bg-primary/10" : "hover:border-primary"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={checked}
                    onChange={() => toggleTag(tag.id)}
                    disabled={isSubmitting}
                  />
                  <span>{tag.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {formError ? (
        <div className="rounded-md border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-md border border-emerald-500/60 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
          {successMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save post"}
        </Button>
      </div>
    </form>
  );
}
