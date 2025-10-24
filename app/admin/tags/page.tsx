"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
import { slugify } from "@/lib/slug";

type TagListItem = {
  id: number;
  name: string;
  slug: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

type TagFormState = {
  name: string;
  slug: string;
};

const initialFormState: TagFormState = {
  name: "",
  slug: "",
};

const formatDateTime = (value: string) => new Date(value).toLocaleString();

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

export default function AdminTagsPage() {
  const [tags, setTags] = useState<TagListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagListItem | null>(null);
  const [formState, setFormState] = useState<TagFormState>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugDirty, setSlugDirty] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadTags = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchJson<{ tags: TagListItem[] }>("/api/tags", {
        method: "GET",
        cache: "no-store",
      });
      setTags(data.tags);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load tags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags().catch(() => {
      /* error handled inside loadTags */
    });
  }, [loadTags]);

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);

    if (!open) {
      setFormState(initialFormState);
      setEditingTag(null);
      setFormError(null);
      setIsSubmitting(false);
      setSlugDirty(false);
    }
  };

  const openCreateDialog = () => {
    setEditingTag(null);
    setFormState(initialFormState);
    setFormError(null);
    setSlugDirty(false);
    setDialogOpen(true);
  };

  const openEditDialog = (tag: TagListItem) => {
    setEditingTag(tag);
    setFormState({ name: tag.name, slug: tag.slug });
    setFormError(null);
    setSlugDirty(true);
    setDialogOpen(true);
  };

  const handleNameChange = (value: string) => {
    setFormState((prev) => {
      const nextName = value;
      const shouldUpdateSlug = !slugDirty;
      return {
        name: nextName,
        slug: shouldUpdateSlug ? slugify(nextName) : prev.slug,
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

  const dialogTitle = editingTag ? "Edit tag" : "Create tag";
  const dialogDescription = editingTag
    ? "Update the tag name or slug."
    : "Create a new tag to organize your posts.";

  const submitLabel = editingTag ? "Save changes" : "Create tag";

  const sortedTags = useMemo(
    () =>
      [...tags].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [tags],
  );

  const handleSubmit = async () => {
    const trimmedName = formState.name.trim();
    const normalizedSlug = slugify(formState.slug.trim() || trimmedName);

    if (!trimmedName) {
      setFormError("Name cannot be empty");
      return;
    }

    if (!normalizedSlug) {
      setFormError("Slug cannot be empty");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        name: trimmedName,
        slug: normalizedSlug,
      };

      if (editingTag) {
        await fetchJson(`/api/tags/${editingTag.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJson("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setDialogOpen(false);
      await loadTags();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Failed to save tag");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (tag: TagListItem) => {
    const confirmed = window.confirm(
      tag.usageCount > 0
        ? `This tag is used by ${tag.usageCount} post(s). Deleting it will remove the association. Continue?`
        : "Delete this tag?",
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(tag.id);

    try {
      await fetchJson(`/api/tags/${tag.id}`, {
        method: "DELETE",
      });
      await loadTags();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete tag";
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Tags</h2>
          <p className="text-sm text-muted-foreground">
            Manage tags and track how often they are used by posts.
          </p>
        </div>
        <Button onClick={openCreateDialog}>New tag</Button>
      </div>

      {loading ? (
        <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
          Loading tags...
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/60 bg-destructive/10 p-6 text-sm text-destructive">
          {error}
        </div>
      ) : sortedTags.length === 0 ? (
        <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
          No tags yet. Create one to start organizing your posts.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[600px] table-fixed text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Usage</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedTags.map((tag) => (
                <tr key={tag.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{tag.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{tag.slug}</td>
                  <td className="px-4 py-3">{tag.usageCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTime(tag.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditDialog(tag)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(tag)}
                        disabled={deletingId === tag.id}
                      >
                        {deletingId === tag.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="tag-name">
                Name
              </label>
              <Input
                id="tag-name"
                value={formState.name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="Design"
                disabled={isSubmitting}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="tag-slug">
                Slug
              </label>
              <Input
                id="tag-slug"
                value={formState.slug}
                onChange={(event) => handleSlugChange(event.target.value)}
                placeholder="design"
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                The slug is used in URLs. Only lowercase letters, numbers, and hyphens are recommended.
              </p>
            </div>
            {formError ? (
              <div className="rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => handleDialogOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : submitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
