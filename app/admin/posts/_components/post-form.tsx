"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { JSONContent } from "@tiptap/core";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/slug";
import type { Post, PostStatus } from "@/types/post";

import { PostEditor } from "./post-editor";
import { TagMultiSelect } from "./tag-multiselect";

const DEFAULT_EDITOR_STATE: { html: string; json: JSONContent | null } = {
  html: "",
  json: null,
};

const STATUS_OPTIONS: Array<{ value: PostStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const toDatetimeLocal = (value: string | null): string => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (num: number) => String(num).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
};

const fromDatetimeLocal = (value: string): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const parseMetadata = (raw: string): Record<string, unknown> | null => {
  const trimmed = raw.trim();

  if (!trimmed) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch (error) {
    throw new Error("Metadata must be valid JSON");
  }
};

type PostFormProps = {
  mode: "create" | "edit";
  initialPost?: Post;
};

export function PostForm({ mode, initialPost }: PostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [slug, setSlug] = useState(initialPost?.slug ?? "");
  const [slugDirty, setSlugDirty] = useState(false);
  const [status, setStatus] = useState<PostStatus>(initialPost?.status ?? "draft");
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt ?? "");
  const [metadataInput, setMetadataInput] = useState(
    JSON.stringify(initialPost?.metadata ?? {}, null, 2),
  );
  const [tags, setTags] = useState<string[]>(initialPost?.tags ?? []);
  const [allowComments, setAllowComments] = useState<boolean>(initialPost?.allowComments ?? true);
  const [isFeatured, setIsFeatured] = useState<boolean>(initialPost?.isFeatured ?? false);
  const [publishedAt, setPublishedAt] = useState<string>(toDatetimeLocal(initialPost?.publishedAt ?? null));
  const [editorState, setEditorState] = useState<{ html: string; json: JSONContent | null }>(() => ({
    html: initialPost?.content ?? DEFAULT_EDITOR_STATE.html,
    json: initialPost?.editorContent ?? DEFAULT_EDITOR_STATE.json,
  }));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!slugDirty && (mode === "create" || !initialPost)) {
      if (title.trim().length === 0) {
        if (slug !== "") {
          setSlug("");
        }
        return;
      }

      const generated = slugify(title);
      if (generated !== slug) {
        setSlug(generated);
      }
    }
  }, [initialPost, mode, slug, slugDirty, title]);

  const slugError = useMemo(() => {
    if (!slug) {
      return null;
    }

    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
      ? null
      : "Slug may contain lowercase letters, numbers, and hyphens";
  }, [slug]);

  const handleSlugChange = (value: string) => {
    setSlugDirty(true);
    setSlug(slugify(value));
  };

  const handleEditorChange = (payload: { html: string; json: JSONContent }) => {
    setEditorState(payload);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    let metadata: Record<string, unknown> | null = {};

    try {
      metadata = parseMetadata(metadataInput);
    } catch (metadataError) {
      setError(metadataError instanceof Error ? metadataError.message : "Metadata is invalid");
      return;
    }

    if (slugError) {
      setError(slugError);
      return;
    }

    if (status === "published" && title.trim().length === 0) {
      setError("Title is required to publish a post");
      return;
    }

    if (status === "published" && editorState.html.trim().length === 0) {
      setError("Content is required to publish a post");
      return;
    }

    const payload = {
      title: title.trim() ? title.trim() : null,
      slug: slug.trim() ? slug.trim() : undefined,
      status,
      excerpt: excerpt.trim() ? excerpt.trim() : null,
      content: editorState.html.trim() ? editorState.html : null,
      editorContent: editorState.json,
      metadata,
      tags,
      allowComments,
      isFeatured,
      publishedAt: status === "published" ? fromDatetimeLocal(publishedAt) : null,
      editorId: 1,
    };

    startTransition(() => {
      const endpoint = mode === "create" ? "/api/posts" : `/api/posts/${initialPost?.id ?? ""}`;
      const method = mode === "create" ? "POST" : "PUT";

      fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            const message = typeof errorBody.error === "string" ? errorBody.error : "Failed to save post";
            throw new Error(message);
          }

          return response.json() as Promise<Post>;
        })
        .then((post) => {
          setMessage(mode === "create" ? "Post created successfully" : "Post updated successfully");

          if (mode === "create") {
            router.push(`/admin/posts/${post.id}`);
            router.refresh();
          } else {
            setSlugDirty(false);
            setSlug(post.slug);
            setTitle(post.title ?? "");
            setTags(post.tags);
            setAllowComments(post.allowComments);
            setIsFeatured(post.isFeatured);
            setPublishedAt(toDatetimeLocal(post.publishedAt));
          }
        })
        .catch((submitError) => {
          console.error(submitError);
          setError(submitError instanceof Error ? submitError.message : "Failed to save post");
        });
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="post-title">Title</Label>
          <Input
            id="post-title"
            placeholder="Post title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="post-slug">Slug</Label>
          <Input
            id="post-slug"
            placeholder="auto-generated"
            value={slug}
            onChange={(event) => handleSlugChange(event.target.value)}
            onBlur={(event) => handleSlugChange(event.target.value)}
          />
          {slugError && <p className="text-sm text-destructive">{slugError}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="post-status">Status</Label>
          <select
            id="post-status"
            value={status}
            onChange={(event) => {
              const nextStatus = event.target.value as PostStatus;
              setStatus(nextStatus);

              if (nextStatus === "published" && !publishedAt) {
                setPublishedAt(toDatetimeLocal(new Date().toISOString()));
              }
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {status === "published" && (
          <div className="grid gap-2">
            <Label htmlFor="post-published-at">Published at</Label>
            <Input
              id="post-published-at"
              type="datetime-local"
              value={publishedAt}
              onChange={(event) => setPublishedAt(event.target.value)}
            />
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="post-excerpt">Excerpt</Label>
          <Textarea
            id="post-excerpt"
            placeholder="Short summary of the post"
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>Content</Label>
          <PostEditor value={editorState.json} onChange={handleEditorChange} />
        </div>
        <div className="grid gap-2">
          <Label>Tags</Label>
          <TagMultiSelect value={tags} onChange={setTags} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="post-metadata">Metadata</Label>
          <Textarea
            id="post-metadata"
            value={metadataInput}
            onChange={(event) => setMetadataInput(event.target.value)}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">Provide SEO metadata and custom fields as JSON.</p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={allowComments}
              onChange={(event) => setAllowComments(event.target.checked)}
              className="h-4 w-4 rounded border-muted-foreground"
            />
            Allow comments
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(event) => setIsFeatured(event.target.checked)}
              className="h-4 w-4 rounded border-muted-foreground"
            />
            Feature on homepage
          </label>
        </div>
      </div>

      {error && <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>}
      {message && <div className="rounded-md border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary">{message}</div>}

      <div className="flex items-center justify-end gap-3">
        {mode === "edit" && (
          <Button type="button" variant="secondary" onClick={() => router.refresh()} disabled={isPending}>
            Reset
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create post" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
