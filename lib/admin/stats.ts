import type { RowDataPacket } from "mysql2/promise";

import { query } from "@/lib/db";
import { isPostStatus, type PostStatus } from "@/lib/admin/posts";

type NumericValue = number | string | null | undefined;

const toCount = (value: NumericValue): number => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

const ensureNonNegative = (value: number): number => (value < 0 ? 0 : value);

const normalizeCount = (value: NumericValue): number => ensureNonNegative(toCount(value));

interface PostCountsRow extends RowDataPacket {
  total: NumericValue;
  published: NumericValue;
  draft: NumericValue;
  archived: NumericValue;
}

export interface PostCounts {
  total: number;
  published: number;
  draft: number;
  archived: number;
}

export const getPostCounts = async (): Promise<PostCounts> => {
  const rows = await query<PostCountsRow[]>(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
      SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived
    FROM posts`,
  );

  const row = rows[0];

  return {
    total: normalizeCount(row?.total),
    published: normalizeCount(row?.published),
    draft: normalizeCount(row?.draft),
    archived: normalizeCount(row?.archived),
  };
};

interface CountRow extends RowDataPacket {
  count: NumericValue;
}

const getSingleCount = async (sql: string): Promise<number> => {
  const rows = await query<CountRow[]>(sql);
  const row = rows[0];

  return normalizeCount(row?.count);
};

export const getTagCount = async (): Promise<number> => getSingleCount("SELECT COUNT(*) AS count FROM tags");

export const getUserCount = async (): Promise<number> => getSingleCount("SELECT COUNT(*) AS count FROM users WHERE status = 'active'");

const isMissingTableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === "string" && code === "ER_NO_SUCH_TABLE";
};

export const getMediaCount = async (): Promise<number | null> => {
  try {
    return await getSingleCount("SELECT COUNT(*) AS count FROM media");
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn("Media table not found when loading admin stats");
      return null;
    }

    throw error;
  }
};

const toIsoString = (value: Date | string | null): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

interface LatestPostRow extends RowDataPacket {
  id: number;
  title: string | null;
  slug: string | null;
  status: string | null;
  created_at: Date | string;
  published_at: Date | string | null;
}

export interface LatestPostSummary {
  id: number;
  title: string;
  slug: string;
  status: PostStatus;
  createdAt: string;
  publishedAt: string | null;
}

export const getLatestPosts = async (limit = 5): Promise<LatestPostSummary[]> => {
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.trunc(limit), 50) : 5;

  const rows = await query<LatestPostRow[]>(
    `SELECT
      id,
      title,
      slug,
      status,
      created_at,
      published_at
    FROM posts
    ORDER BY created_at DESC
    LIMIT ?`,
    [normalizedLimit],
  );

  return rows.map((row) => {
    const status: PostStatus = isPostStatus(row.status) ? row.status : "draft";

    return {
      id: row.id,
      title: row.title ?? "未命名文章",
      slug: row.slug ?? "",
      status,
      createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
      publishedAt: toIsoString(row.published_at),
    };
  });
};
