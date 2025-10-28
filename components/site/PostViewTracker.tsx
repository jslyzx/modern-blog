"use client";

import { useEffect } from "react";

export interface PostViewTrackerProps {
  postId: number;
}

const STORAGE_PREFIX = "post-viewed:";

const isValidId = (value: number): boolean => Number.isFinite(value) && value > 0;

export function PostViewTracker({ postId }: PostViewTrackerProps) {
  useEffect(() => {
    if (!isValidId(postId) || typeof window === "undefined") {
      return;
    }

    const storageKey = `${STORAGE_PREFIX}${postId}`;
    const hasSessionStorage = typeof window.sessionStorage !== "undefined";

    const getStoredValue = (): string | null => {
      if (!hasSessionStorage) {
        return null;
      }

      try {
        return window.sessionStorage.getItem(storageKey);
      } catch {
        return null;
      }
    };

    const setStoredValue = (): void => {
      if (!hasSessionStorage) {
        return;
      }

      try {
        window.sessionStorage.setItem(storageKey, "1");
      } catch {
        return;
      }
    };

    const removeStoredValue = (): void => {
      if (!hasSessionStorage) {
        return;
      }

      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        return;
      }
    };

    if (getStoredValue()) {
      return;
    }

    setStoredValue();

    let cancelled = false;

    const trackView = async () => {
      try {
        const response = await fetch(`/api/posts/${postId}/view`, {
          method: "POST",
          keepalive: true,
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!response.ok && !cancelled) {
          removeStoredValue();
        }
      } catch {
        if (!cancelled) {
          removeStoredValue();
        }
      }
    };

    trackView();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  return null;
}
