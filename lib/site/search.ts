import type { RowDataPacket } from "mysql2";

import { query } from "@/lib/db";

const PUBLISHED_POST_CONDITION = "p.status = 'published' AND (p.published_at IS NULL OR p.published_at <= NOW())";
const MAX_QUERY_LENGTH = 200;
const MAX_LIMIT = 50;

const toDate = (value: Date | string | null): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const normalizeNullableText = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
};

const normalizeSlug = (value: string | null): string => {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/^\/+/, "");
};

type SearchPostRow = RowDataPacket & {
  id: number;
  slug: string | null;
  title: string;
  summary: string | null;
  publishedAt: Date | string | null;
  createdAt: Date | string | null;
};

type SearchTagRow = RowDataPacket & {
  postId: number;
  tagId: number | null;
  tagSlug: string | null;
  tagName: string | null;
};

export interface SearchResultTag {
  id: number;
  slug: string;
  name: string;
}

export interface SearchResultPost {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  publishedAt: Date | null;
  createdAt: Date | null;
  tags: SearchResultTag[];
}

export interface SearchPublishedPostsOptions {
  query: string;
  limit?: number;
  offset?: number;
}

export interface SearchPublishedPostsResult {
  posts: SearchResultPost[];
  hasMore: boolean;
}

export const sanitizeSearchQuery = (value: string): string => {
  const collapsed = value.replace(/\s+/g, " ");
  const trimmed = collapsed.trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.slice(0, MAX_QUERY_LENGTH);
};

export const searchPublishedPosts = async (
  options: SearchPublishedPostsOptions,
): Promise<SearchPublishedPostsResult> => {
  const queryText = sanitizeSearchQuery(options.query ?? "");

  if (!queryText) {
    return {
      posts: [],
      hasMore: false,
    };
  }

  const sanitizedLimit = (() => {
    const { limit } = options;

    if (typeof limit !== "number" || !Number.isFinite(limit)) {
      return 10;
    }

    const normalized = Math.max(0, Math.floor(limit));

    return Math.min(normalized, MAX_LIMIT);
  })();

  const sanitizedOffset = (() => {
    const { offset } = options;

    if (typeof offset !== "number" || !Number.isFinite(offset)) {
      return 0;
    }

    return Math.max(0, Math.floor(offset));
  })();

  const wildcard = `%${queryText}%`;

  const rows = await query<SearchPostRow[]>(
    `
      SELECT
        p.id,
        p.slug,
        p.title,
        p.summary AS summary,
        p.published_at AS publishedAt,
        p.created_at AS createdAt
      FROM posts p
      WHERE ${PUBLISHED_POST_CONDITION}
        AND (p.title LIKE ? OR p.summary LIKE ?)
      ORDER BY COALESCE(p.published_at, p.created_at) DESC
      LIMIT ?
      OFFSET ?
    `,
    [wildcard, wildcard, sanitizedLimit + 1, sanitizedOffset],
  );

  const hasMore = rows.length > sanitizedLimit;
  const limitedRows = hasMore ? rows.slice(0, sanitizedLimit) : rows;

  if (!limitedRows.length) {
    return {
      posts: [],
      hasMore,
    };
  }

  const postIds = limitedRows.map((row) => row.id);

  const tagRows = await query<SearchTagRow[]>(
    `
      SELECT
        pt.post_id AS postId,
        t.id AS tagId,
        t.slug AS tagSlug,
        t.name AS tagName
      FROM post_tags pt
      INNER JOIN tags t ON t.id = pt.tag_id
      WHERE pt.post_id IN (?)
      ORDER BY t.name ASC
    `,
    [postIds],
  ).catch((error) => {
    console.warn("Failed to load tags for search results", {
      postIds,
      error,
    });

    return [] as SearchTagRow[];
  });

  const tagsByPost = new Map<number, SearchResultTag[]>();

  for (const row of tagRows) {
    if (typeof row.postId !== "number" || typeof row.tagId !== "number") {
      continue;
    }

    if (!row.tagName) {
      continue;
    }

    const slug = row.tagSlug?.trim() ?? "";

    const tag: SearchResultTag = {
      id: row.tagId,
      slug,
      name: row.tagName,
    };

    const existing = tagsByPost.get(row.postId);

    if (existing) {
      existing.push(tag);
    } else {
      tagsByPost.set(row.postId, [tag]);
    }
  }

  const posts = limitedRows.map<SearchResultPost>((row) => {
    const slug = normalizeSlug(row.slug);

    return {
      id: row.id,
      slug,
      title: row.title,
      summary: normalizeNullableText(row.summary),
      publishedAt: toDate(row.publishedAt),
      createdAt: toDate(row.createdAt),
      tags: tagsByPost.get(row.id) ?? [],
    };
  });

  return {
    posts,
    hasMore,
  };
};
