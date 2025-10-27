"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminTag } from "@/lib/admin/tags";
import { slugify } from "@/lib/slug";

interface TagManagerProps {
  initialTags: AdminTag[];
}

interface EditableTagState {
  id: number;
  name: string;
  slug: string;
}

const sortTags = (tags: AdminTag[]) => [...tags].sort((a, b) => a.name.localeCompare(b.name));

export function TagManager({ initialTags }: TagManagerProps) {
  const [tags, setTags] = useState<AdminTag[]>(() => sortTags(initialTags));
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [editing, setEditing] = useState<EditableTagState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const hasTags = tags.length > 0;

  const previewTags = useMemo(() => sortTags(tags), [tags]);

  const resetMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const handleNewNameChange = (value: string) => {
    setNewName(value);
    setNewSlug(slugify(value));
  };

  const handleCreate = () => {
    resetMessages();

    const name = newName.trim();
    const slug = (newSlug.trim() || slugify(newName)).trim();

    if (!name) {
      setError("Tag name is required.");
      return;
    }

    if (!slug) {
      setError("Tag slug is required.");
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/tags", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name, slug }),
          });

          if (!response.ok) {
            let message = "Failed to create tag.";

            try {
              const data = await response.json();
              if (data?.error) {
                message = data.error;
              }
            } catch (parseError) {
              console.error("Failed to parse create tag error", parseError);
            }

            setError(message);
            return;
          }

          const data = await response.json();
          const tag = data?.data as AdminTag | undefined;

          if (tag) {
            setTags((previous) => sortTags([...previous, tag]));
          }

          setNewName("");
          setNewSlug("");
          setSuccessMessage("Tag created successfully.");
        } catch (createError) {
          console.error("Failed to create tag", createError);
          setError("Failed to create tag. Please try again.");
        }
      })();
    });
  };

  const startEditing = (tag: AdminTag) => {
    resetMessages();
    setEditing({ id: tag.id, name: tag.name, slug: tag.slug });
  };

  const cancelEditing = () => {
    setEditing(null);
  };

  const handleSaveEdit = () => {
    if (!editing) {
      return;
    }

    resetMessages();

    const name = editing.name.trim();
    const slug = editing.slug.trim() || slugify(editing.name).trim();

    if (!name) {
      setError("Tag name is required.");
      return;
    }

    if (!slug) {
      setError("Tag slug is required.");
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/tags/${editing.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name, slug }),
          });

          if (!response.ok) {
            let message = "Failed to update tag.";

            try {
              const data = await response.json();
              if (data?.error) {
                message = data.error;
              }
            } catch (parseError) {
              console.error("Failed to parse update tag error", parseError);
            }

            setError(message);
            return;
          }

          const data = await response.json();
          const updatedTag = data?.data as AdminTag | undefined;

          if (updatedTag) {
            setTags((previous) => sortTags(previous.map((tag) => (tag.id === updatedTag.id ? updatedTag : tag))));
          }

          setEditing(null);
          setSuccessMessage("Tag updated successfully.");
        } catch (updateError) {
          console.error("Failed to update tag", updateError);
          setError("Failed to update tag. Please try again.");
        }
      })();
    });
  };

  const handleDelete = (tag: AdminTag) => {
    resetMessages();

    if (!window.confirm(`Delete tag "${tag.name}"? Posts linked to this tag will lose the association.`)) {
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/tags/${tag.id}`, {
            method: "DELETE",
          });

          if (!response.ok && response.status !== 204) {
            let message = "Failed to delete tag.";

            try {
              const data = await response.json();
              if (data?.error) {
                message = data.error;
              }
            } catch (parseError) {
              console.error("Failed to parse delete tag error", parseError);
            }

            setError(message);
            return;
          }

          setTags((previous) => previous.filter((item) => item.id !== tag.id));
          setSuccessMessage("Tag deleted successfully.");
        } catch (deleteError) {
          console.error("Failed to delete tag", deleteError);
          setError("Failed to delete tag. Please try again.");
        }
      })();
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Create tag</h2>
        <p className="text-sm text-muted-foreground">Add metadata to categorize posts and improve navigation.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr,1fr,auto]">
          <Input
            value={newName}
            onChange={(event) => handleNewNameChange(event.target.value)}
            placeholder="Tag name"
            disabled={isPending}
          />
          <Input
            value={newSlug}
            onChange={(event) => setNewSlug(event.target.value)}
            placeholder="tag-slug"
            disabled={isPending}
          />
          <Button type="button" onClick={handleCreate} disabled={isPending}>
            {isPending ? "Saving..." : "Add tag"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{successMessage}</div>
      ) : null}

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-4 py-3 text-sm text-muted-foreground">{hasTags ? `${tags.length} tags` : "No tags yet"}</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Slug</th>
                <th className="px-6 py-3 font-medium">Posts</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {previewTags.length ? (
                previewTags.map((tag) => {
                  const isEditing = editing?.id === tag.id;

                  return (
                    <tr key={tag.id} className="border-b last:border-0">
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <Input
                            value={editing?.name ?? ""}
                            onChange={(event) => setEditing((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                            disabled={isPending}
                          />
                        ) : (
                          <span className="font-medium text-foreground">{tag.name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <Input
                            value={editing?.slug ?? ""}
                            onChange={(event) => setEditing((prev) => (prev ? { ...prev, slug: event.target.value } : prev))}
                            disabled={isPending}
                          />
                        ) : (
                          <span className="text-muted-foreground">{tag.slug}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{tag.postCount}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {isEditing ? (
                            <>
                              <Button type="button" size="sm" onClick={handleSaveEdit} disabled={isPending}>
                                {isPending ? "Saving..." : "Save"}
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={cancelEditing} disabled={isPending}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button type="button" size="sm" variant="outline" onClick={() => startEditing(tag)} disabled={isPending}>
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(tag)}
                                disabled={isPending}
                                className="text-destructive"
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    Create your first tag to organize posts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
