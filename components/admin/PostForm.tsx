"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PostEditor } from "@/components/admin/PostEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
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
  initialTags?: TagOption[];
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

const AUTO_SAVE_DEBOUNCE_MS = 3000;
const STORAGE_KEY_PREFIX = "admin.post.draft";

const getStorageKey = (postId?: number) => `${STORAGE_KEY_PREFIX}.${postId ?? "new"}`;

const serializeFormData = (data: PostFormData): string =>
  JSON.stringify({
    ...data,
    tagIds: [...data.tagIds].sort((a, b) => a - b),
  });

const isValidStatus = (value: unknown): value is PostFormData["status"] =>
  value === "draft" || value === "published" || value === "archived";

const sanitizeStoredFormData = (value: unknown): PostFormData => {
  const fallback = createEmptyFormData();

  if (typeof value !== "object" || value === null) {
    return fallback;
  }

  const data = value as Partial<PostFormData>;

  return {
    title: typeof data.title === "string" ? data.title : fallback.title,
    slug: typeof data.slug === "string" ? data.slug : fallback.slug,
    summary: typeof data.summary === "string" ? data.summary : fallback.summary,
    contentHtml: typeof data.contentHtml === "string" ? data.contentHtml : fallback.contentHtml,
    coverImageUrl: typeof data.coverImageUrl === "string" ? data.coverImageUrl : fallback.coverImageUrl,
    status: isValidStatus(data.status) ? data.status : fallback.status,
    isFeatured: typeof data.isFeatured === "boolean" ? data.isFeatured : fallback.isFeatured,
    allowComments: typeof data.allowComments === "boolean" ? data.allowComments : fallback.allowComments,
    tagIds: Array.isArray(data.tagIds)
      ? data.tagIds
          .map((id) => {
            if (typeof id === "number" && Number.isFinite(id)) {
              return Math.trunc(id);
            }

            if (typeof id === "string" && id.trim()) {
              const numeric = Number.parseInt(id, 10);
              return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
            }

            return null;
          })
          .filter((id): id is number => typeof id === "number" && id > 0)
      : fallback.tagIds,
  };
};

const formatAutoSaveTime = (timestamp: number) =>
  new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));

const formatPreviewExpiryTime = (timestamp: number): string => {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));
  } catch (error) {
    console.warn("Failed to format preview expiry", error);
    return new Date(timestamp).toLocaleString();
  }
};

const formatPreviewRemaining = (timestamp: number): string => {
  const diff = timestamp - Date.now();

  if (diff <= 0) {
    return "已过期";
  }

  const totalMinutes = Math.ceil(diff / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    if (minutes === 0) {
      return `${hours} 小时`;
    }

    return `${hours} 小时 ${minutes} 分钟`;
  }

  return `${Math.max(totalMinutes, 1)} 分钟`;
};

export function PostForm({ initialData, postId, initialTags }: PostFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEditing = typeof postId === "number";
  const normalizedInitialTags = useMemo(() => initialTags ?? [], [initialTags]);
  const storageKey = useMemo(() => getStorageKey(postId), [postId]);

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
  const [tagOptions, setTagOptions] = useState<TagOption[]>(() => mergeTagOptions([], normalizedInitialTags));
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [tagModalError, setTagModalError] = useState<string | null>(null);
  const [tagLoading, setTagLoading] = useState(false);
  const [hasLoadedTags, setHasLoadedTags] = useState(normalizedInitialTags.length > 0);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(isEditing ? "saved" : "idle");
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [generatingPreviewLink, setGeneratingPreviewLink] = useState(false);
  const [previewLinkInfo, setPreviewLinkInfo] = useState<{ url: string; expiresAt: number } | null>(null);
  const [lastPreviewCopyFailed, setLastPreviewCopyFailed] = useState(false);

  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoSavedSnapshotRef = useRef<string | null>(null);
  const lastRemoteSnapshotRef = useRef<string | null>(null);
  const lastErrorSnapshotRef = useRef<string | null>(null);
  const latestFormDataRef = useRef<PostFormData | null>(null);
  const autoSaveAbortControllerRef = useRef<AbortController | null>(null);
  const hasAttemptedRestoreRef = useRef(false);

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
    if (normalizedInitialTags.length === 0) {
      return;
    }

    setTagOptions((prev) => mergeTagOptions(prev, normalizedInitialTags));
    setHasLoadedTags(true);
  }, [normalizedInitialTags]);

  useEffect(() => {
    setPreviewLinkInfo(null);
    setLastPreviewCopyFailed(false);
  }, [postId]);

  useEffect(() => {
    if (!formData) {
      latestFormDataRef.current = null;
      return;
    }

    latestFormDataRef.current = formData;

    const snapshot = serializeFormData(formData);

    if (lastAutoSavedSnapshotRef.current === null) {
      lastAutoSavedSnapshotRef.current = snapshot;
    }

    if (lastRemoteSnapshotRef.current === null) {
      lastRemoteSnapshotRef.current = snapshot;
    }
  }, [formData]);

  useEffect(() => {
    if (!formData) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    if (hasAttemptedRestoreRef.current) {
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(storageKey);

      if (storedValue) {
        const parsed = JSON.parse(storedValue) as { data?: unknown; updatedAt?: unknown };

        if (parsed && typeof parsed === "object" && parsed.data !== undefined) {
          const restored = sanitizeStoredFormData(parsed.data);
          const restoredSnapshot = serializeFormData(restored);
          const currentSnapshot = serializeFormData(formData);

          if (restoredSnapshot !== currentSnapshot) {
            const updatedAt = typeof parsed.updatedAt === "number" ? parsed.updatedAt : null;
            const promptMessage =
              updatedAt !== null
                ? `检测到 ${formatAutoSaveTime(updatedAt)} 的本地草稿，是否需要恢复？`
                : "检测到本地草稿内容，是否恢复？";

            if (window.confirm(promptMessage)) {
              setFormData(cloneFormData(restored));
              if (updatedAt) {
                setLastSavedAt(updatedAt);
              }
            } else {
              window.localStorage.removeItem(storageKey);
            }
          }
        }
      }
    } catch (restoreError) {
      console.error("Failed to restore draft from localStorage", restoreError);
    } finally {
      hasAttemptedRestoreRef.current = true;
    }
  }, [formData, storageKey]);

  useEffect(() => {
    if (!formData) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    if (!hasAttemptedRestoreRef.current) {
      return;
    }

    try {
      const payload = {
        data: formData,
        updatedAt: Date.now(),
      };

      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (persistError) {
      console.error("Failed to persist draft to localStorage", persistError);
    }
  }, [formData, storageKey]);

  const runAutoSave = useCallback(
    async (data: PostFormData) => {
      if (!data) {
        return;
      }

      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }

      const snapshot = serializeFormData(data);

      if (lastAutoSavedSnapshotRef.current === snapshot) {
        return;
      }

      setAutoSaveStatus("saving");
      setAutoSaveError(null);

      if (!postId) {
        lastAutoSavedSnapshotRef.current = snapshot;
        lastErrorSnapshotRef.current = null;
        setAutoSaveStatus("saved");
        setLastSavedAt(Date.now());

        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              storageKey,
              JSON.stringify({ data: data, updatedAt: Date.now() }),
            );
          } catch (writeError) {
            console.error("Failed to update draft timestamp", writeError);
          }
        }

        return;
      }

      if (!data.title.trim()) {
        lastErrorSnapshotRef.current = snapshot;
        setAutoSaveStatus("error");
        setAutoSaveError("请输入标题以保存草稿");
        return;
      }

      autoSaveAbortControllerRef.current?.abort();
      const controller = new AbortController();
      autoSaveAbortControllerRef.current = controller;

      try {
        const normalizedSlug = data.slug.trim() ? generateSlug(data.slug) : generateSlug(data.title);
        const payload = {
          ...data,
          slug: normalizedSlug,
          status: "draft" as const,
          tags: data.tagIds,
        };

        const response = await fetch(`/api/posts/${postId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        let result: any = null;

        try {
          result = await response.json();
        } catch {
          // ignore parse errors
        }

        if (!response.ok) {
          const message = typeof result?.error === "string" ? result.error : "自动保存失败";
          throw new Error(message);
        }

        lastAutoSavedSnapshotRef.current = snapshot;
        lastRemoteSnapshotRef.current = snapshot;
        lastErrorSnapshotRef.current = null;
        setAutoSaveStatus("saved");
        setLastSavedAt(Date.now());
        setHasUnsavedChanges(false);
        setAutoSaveError(null);

        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              storageKey,
              JSON.stringify({ data: data, updatedAt: Date.now() }),
            );
          } catch (writeError) {
            console.error("Failed to update draft timestamp", writeError);
          }
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to auto save draft", err);
        lastErrorSnapshotRef.current = snapshot;
        setAutoSaveStatus("error");
        setAutoSaveError(err instanceof Error ? err.message : "自动保存失败");
      } finally {
        if (autoSaveAbortControllerRef.current === controller) {
          autoSaveAbortControllerRef.current = null;
        }
      }
    },
    [postId, storageKey],
  );

  const handleRetryAutoSave = useCallback(() => {
    const latest = latestFormDataRef.current;

    if (latest) {
      void runAutoSave(cloneFormData(latest));
    }
  }, [runAutoSave]);

  useEffect(() => {
    if (autoSaveStatus !== "error") {
      return;
    }

    if (!formData) {
      return;
    }

    if (!lastErrorSnapshotRef.current) {
      return;
    }

    const snapshot = serializeFormData(formData);

    if (snapshot !== lastErrorSnapshotRef.current) {
      setAutoSaveStatus("idle");
      setAutoSaveError(null);
      lastErrorSnapshotRef.current = null;
    }
  }, [autoSaveStatus, formData]);

  useEffect(() => {
    if (!formData) {
      return;
    }

    if (loading) {
      return;
    }

    const snapshot = serializeFormData(formData);

    if (autoSaveStatus === "error" && lastErrorSnapshotRef.current === snapshot) {
      return;
    }

    const remoteSnapshot = lastRemoteSnapshotRef.current;
    const hasRemoteChanges = remoteSnapshot === null ? true : remoteSnapshot !== snapshot;

    setHasUnsavedChanges(hasRemoteChanges);

    const pendingAutoSave =
      lastAutoSavedSnapshotRef.current === null || lastAutoSavedSnapshotRef.current !== snapshot;

    if (!pendingAutoSave) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }

      setAutoSaveStatus((prev) => {
        if (prev === "error" || prev === "saving") {
          return prev;
        }

        return "saved";
      });

      return;
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    if (autoSaveError && autoSaveStatus !== "error") {
      setAutoSaveError(null);
    }

    if (autoSaveStatus !== "saving") {
      setAutoSaveStatus("idle");
    }

    const timer = setTimeout(() => {
      autoSaveTimeoutRef.current = null;
      const latest = latestFormDataRef.current;
      if (latest) {
        void runAutoSave(cloneFormData(latest));
      }
    }, AUTO_SAVE_DEBOUNCE_MS);

    autoSaveTimeoutRef.current = timer;

    return () => {
      clearTimeout(timer);
      if (autoSaveTimeoutRef.current === timer) {
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [formData, autoSaveError, autoSaveStatus, loading, runAutoSave]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      autoSaveAbortControllerRef.current?.abort();
    };
  }, []);

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

  const handleGeneratePreviewLink = useCallback(async () => {
    if (!postId) {
      toast({
        title: "无法生成预览链接",
        description: "请先保存文章，再尝试生成预览链接。",
        variant: "destructive",
      });
      return;
    }

    if (generatingPreviewLink) {
      return;
    }

    setGeneratingPreviewLink(true);
    setLastPreviewCopyFailed(false);

    try {
      const response = await fetch(`/api/posts/${postId}/preview-token`, {
        method: "POST",
      });

      let result: any = null;

      try {
        result = await response.json();
      } catch {
        // ignore parse errors
      }

      if (!response.ok) {
        const message = typeof result?.error === "string" ? result.error : "生成预览链接失败";
        throw new Error(message);
      }

      const previewUrl = typeof result?.previewUrl === "string" ? result.previewUrl : null;
      const expiresAtCandidate =
        typeof result?.expiresAt === "string" ? Date.parse(result.expiresAt) : result?.expiresAt;
      const expiresInFallback =
        typeof result?.expiresInMs === "number" && Number.isFinite(result.expiresInMs)
          ? Math.max(0, Math.trunc(result.expiresInMs))
          : null;

      let expiresAtMs =
        typeof expiresAtCandidate === "number" && Number.isFinite(expiresAtCandidate)
          ? expiresAtCandidate
          : Number.NaN;

      if (Number.isNaN(expiresAtMs) && expiresInFallback !== null) {
        expiresAtMs = Date.now() + expiresInFallback;
      }

      if (!previewUrl || Number.isNaN(expiresAtMs)) {
        throw new Error("预览链接响应缺少必要信息，请稍后重试。");
      }

      setPreviewLinkInfo({ url: previewUrl, expiresAt: expiresAtMs });

      let copySucceeded = false;

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(previewUrl);
          copySucceeded = true;
          toast({
            title: "预览链接已复制",
            description: `链接将在 ${formatPreviewRemaining(expiresAtMs)} 后过期。`,
            variant: "success",
          });
        } catch (copyError) {
          console.warn("Failed to copy preview link", copyError);
        }
      }

      if (!copySucceeded) {
        setLastPreviewCopyFailed(true);
        toast({
          title: "预览链接已生成",
          description: "请手动复制下方的链接。",
        });
      } else {
        setLastPreviewCopyFailed(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成预览链接失败";
      toast({
        title: "生成预览链接失败",
        description: message,
        variant: "destructive",
      });
    } finally {
      setGeneratingPreviewLink(false);
    }
  }, [postId, generatingPreviewLink, toast]);

  const handleCopyPreviewLink = useCallback(async () => {
    if (!previewLinkInfo) {
      toast({
        title: "暂无预览链接",
        description: "请先生成预览链接。",
        variant: "destructive",
      });
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setLastPreviewCopyFailed(true);
      toast({
        title: "无法复制链接",
        description: "浏览器不支持剪贴板操作，请手动复制链接。",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(previewLinkInfo.url);
      setLastPreviewCopyFailed(false);
      toast({
        title: "预览链接已复制",
        description: `链接将在 ${formatPreviewRemaining(previewLinkInfo.expiresAt)} 后过期。`,
        variant: "success",
      });
    } catch (error) {
      console.warn("Failed to copy preview link", error);
      setLastPreviewCopyFailed(true);
      toast({
        title: "复制失败",
        description: "浏览器阻止了剪贴板操作，请手动复制链接。",
        variant: "destructive",
      });
    }
  }, [previewLinkInfo, toast]);

  const handleSubmit = async (e: FormEvent, submitStatus: "draft" | "published") => {
    e.preventDefault();

    if (!formData) {
      return;
    }

    autoSaveAbortControllerRef.current?.abort();
    autoSaveAbortControllerRef.current = null;
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    setLoading(true);
    setError(null);
    setAutoSaveStatus("saving");
    setAutoSaveError(null);

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

      const savedSnapshot = serializeFormData({
        ...formData,
        slug: normalizedSlug,
        status: submitStatus,
      });

      lastAutoSavedSnapshotRef.current = savedSnapshot;
      lastRemoteSnapshotRef.current = savedSnapshot;
      lastErrorSnapshotRef.current = null;
      setAutoSaveStatus("saved");
      setLastSavedAt(Date.now());
      setHasUnsavedChanges(false);

      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(storageKey);
        } catch (clearError) {
          console.error("Failed to remove draft from localStorage", clearError);
        }
      }

      router.push("/admin/posts");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "发生未知错误";
      setError(message);
      setAutoSaveStatus("error");
      setAutoSaveError(message);
      setLoading(false);
    }
  };

  const formattedLastSavedAt = useMemo(() => (lastSavedAt ? formatAutoSaveTime(lastSavedAt) : null), [lastSavedAt]);

  const autoSaveIndicatorClassName = useMemo(
    () =>
      cn(
        "text-xs",
        autoSaveStatus === "error"
          ? "text-destructive"
          : autoSaveStatus === "saving"
            ? "text-primary"
            : "text-muted-foreground",
      ),
    [autoSaveStatus],
  );

  const autoSaveMessage = useMemo(() => {
    if (autoSaveStatus === "saving") {
      return "自动保存中...";
    }

    if (autoSaveStatus === "saved") {
      if (postId) {
        return formattedLastSavedAt ? `已自动保存（${formattedLastSavedAt}）` : "已自动保存";
      }

      if (!formattedLastSavedAt) {
        return "草稿将在几秒后自动保存";
      }

      return `已保存到本地（${formattedLastSavedAt}）`;
    }

    if (autoSaveStatus === "error") {
      return autoSaveError ?? "自动保存失败";
    }

    return postId ? "有未保存的更改" : "草稿将在几秒后自动保存";
  }, [autoSaveError, autoSaveStatus, formattedLastSavedAt, postId]);

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
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="title">标题 *</Label>
            <div className="flex items-center gap-2">
              <span className={autoSaveIndicatorClassName} role="status" aria-live="polite">
                {autoSaveMessage}
              </span>
              {autoSaveStatus === "error" ? (
                <button
                  type="button"
                  onClick={handleRetryAutoSave}
                  className="text-xs text-primary transition hover:underline"
                >
                  重试
                </button>
              ) : null}
            </div>
          </div>
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

      <div className="border-t pt-6">
        <div className="flex flex-wrap items-center gap-3">
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
          <Button
            type="button"
            variant="outline"
            onClick={handleGeneratePreviewLink}
            disabled={loading || generatingPreviewLink || !postId}
            title={!postId ? "请先保存文章以生成预览链接" : undefined}
          >
            {generatingPreviewLink ? "生成中..." : "生成预览链接"}
          </Button>
        </div>
        {postId ? (
          <div className="mt-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
            {previewLinkInfo ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-primary">预览链接</span>
                  <Button type="button" size="sm" variant="secondary" onClick={handleCopyPreviewLink}>
                    复制链接
                  </Button>
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <a href={previewLinkInfo.url} target="_blank" rel="noreferrer">
                      打开预览
                    </a>
                  </Button>
                </div>
                <p className="break-all rounded-md border border-primary/20 bg-background px-3 py-2 text-foreground">
                  {previewLinkInfo.url}
                </p>
                <p className="text-xs">
                  将在 <span className="font-medium text-primary">{formatPreviewRemaining(previewLinkInfo.expiresAt)}</span> 后过期（
                  {formatPreviewExpiryTime(previewLinkInfo.expiresAt)}）。
                </p>
                {lastPreviewCopyFailed ? (
                  <p className="text-xs text-destructive">无法自动复制，请手动复制上方链接。</p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs">
                生成后的预览链接有效期为 24 小时，可分享给协作者或审阅者查看文章草稿。
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">保存文章后即可生成 24 小时有效的预览链接。</p>
        )}
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

export default PostForm;
