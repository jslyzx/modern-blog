import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { query } from "@/lib/db";

export const POST_STATUS_VALUES = ["published", "draft", "archived"] as const;
export type PostStatus = (typeof POST_STATUS_VALUES)[number];

export const POST_STATUS_FILTERS = ["all", ...POST_STATUS_VALUES] as const;
export type PostStatusFilter = (typeof POST_STATUS_FILTERS)[number];

const POST_STATUS_VALUE_SET = new Set<string>(POST_STATUS_VALUES);
const POST_STATUS_FILTER_SET = new Set<string>(POST_STATUS_FILTERS);

export const DEFAULT_POST_STATUS_FILTER: PostStatusFilter = "all";

type AdminPostRow = RowDataPacket & {
  id: number;
  slug: string;
  title: string;
  status: string | null;
  created_at: Date | string;
  updated_at: Date | string | null;
  published_at: Date | string | null;
  author_id: number | null;
  author_username: string | null;
  author_email: string | null;
};

export interface AdminPost {
  id: number;
  slug: string;
  title: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string | null;
  publishedAt: string | null;
  authorId: number | null;
  authorName: string | null;
  authorEmail: string | null;
}

export interface AdminPostsQuery {
  status?: PostStatusFilter | null;
  search?: string | null;
}

export const isPostStatus = (value: unknown): value is PostStatus =>
  typeof value === "string" && POST_STATUS_VALUE_SET.has(value);

export const isPostStatusFilter = (value: unknown): value is PostStatusFilter =>
  typeof value === "string" && POST_STATUS_FILTER_SET.has(value);

const toIsoString = (value: Date | string | null): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const mapRowToAdminPost = (row: AdminPostRow): AdminPost => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  status: isPostStatus(row.status) ? row.status : "draft",
  createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
  updatedAt: toIsoString(row.updated_at),
  publishedAt: toIsoString(row.published_at),
  authorId: typeof row.author_id === "number" ? row.author_id : null,
  authorName: row.author_username ?? null,
  authorEmail: row.author_email ?? null,
});

export async function getAdminPosts(queryOptions: AdminPostsQuery = {}): Promise<AdminPost[]> {
  const status = queryOptions.status && isPostStatusFilter(queryOptions.status) ? queryOptions.status : DEFAULT_POST_STATUS_FILTER;
  const search = queryOptions.search?.trim() ?? "";

  let sql = `
    SELECT
      p.id,
      p.slug,
      p.title,
      p.status,
      p.created_at,
      p.updated_at,
      p.published_at,
      p.author_id,
      u.username AS author_username,
      u.email AS author_email
    FROM posts p
    LEFT JOIN users u ON u.id = p.author_id
    WHERE 1 = 1
  `;

  const params: Array<string | number> = [];

  if (status !== "all") {
    sql += " AND p.status = ?";
    params.push(status);
  }

  if (search) {
    sql += " AND p.title LIKE ?";
    params.push(`%${search}%`);
  }

  sql += " ORDER BY p.created_at DESC";

  const rows = await query<AdminPostRow[]>(sql, params);

  return rows.map(mapRowToAdminPost);
}

export async function deletePostById(id: number): Promise<boolean> {
  const result = await query<ResultSetHeader>("DELETE FROM posts WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export async function updatePostStatus(id: number, status: PostStatus): Promise<boolean> {
  if (!isPostStatus(status)) {
    throw new Error(`Unsupported post status: ${status}`);
  }

  let sql = "UPDATE posts SET status = ?";
  const params: Array<string | number> = [status];

  if (status === "published") {
    sql += ", published_at = CASE WHEN published_at IS NULL THEN NOW() ELSE published_at END";
  } else if (status === "draft") {
    sql += ", published_at = NULL";
  }

  sql += ", updated_at = NOW() WHERE id = ?";
  params.push(id);

  const result = await query<ResultSetHeader>(sql, params);

  return result.affectedRows > 0;
}
