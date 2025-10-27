import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { randomSlugId } from "@/lib/slug";
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

type SlugLookupRow = RowDataPacket & {
  id: number;
};

export interface UniqueSlugOptions {
  excludeId?: number;
}

export async function isPostSlugTaken(slug: string, excludeId?: number): Promise<boolean> {
  if (!slug) {
    return false;
  }

  let sql = "SELECT id FROM posts WHERE slug = ?";
  const params: Array<string | number> = [slug];

  if (typeof excludeId === "number") {
    sql += " AND id <> ?";
    params.push(excludeId);
  }

  sql += " LIMIT 1";

  const rows = await query<SlugLookupRow[]>(sql, params);

  return rows.length > 0;
}

const INCREMENTAL_SUFFIX_LIMIT = 10;
const RANDOM_SUFFIX_ATTEMPTS = 5;

export async function ensureUniquePostSlug(baseSlug: string, options: UniqueSlugOptions = {}): Promise<string> {
  let slug = baseSlug || `post-${randomSlugId()}`;
  const { excludeId } = options;

  if (!(await isPostSlugTaken(slug, excludeId))) {
    return slug;
  }

  const base = slug;

  for (let increment = 2; increment <= INCREMENTAL_SUFFIX_LIMIT + 1; increment += 1) {
    const candidate = `${base}-${increment}`;

    if (!(await isPostSlugTaken(candidate, excludeId))) {
      return candidate;
    }
  }

  for (let attempt = 0; attempt < RANDOM_SUFFIX_ATTEMPTS; attempt += 1) {
    const candidate = `${base}-${randomSlugId()}`;

    if (!(await isPostSlugTaken(candidate, excludeId))) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique slug");
}

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

type AdminPostDetailRow = RowDataPacket & {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  content_html: string | null;
  cover_image_url: string | null;
  status: string | null;
  is_featured: number;
  allow_comments: number;
  created_at: Date | string;
  updated_at: Date | string | null;
  published_at: Date | string | null;
  author_id: number | null;
};

type TagRow = RowDataPacket & {
  id: number;
  name: string;
};

export interface AdminPostDetail {
  id: number;
  slug: string;
  title: string;
  summary: string;
  contentHtml: string;
  coverImageUrl: string;
  status: PostStatus;
  isFeatured: boolean;
  allowComments: boolean;
  createdAt: string;
  updatedAt: string | null;
  publishedAt: string | null;
  authorId: number | null;
  tags: Array<{ id: number; name: string }>;
}

export async function getPostById(id: number): Promise<AdminPostDetail | null> {
  const rows = await query<AdminPostDetailRow[]>(
    `SELECT
      id,
      slug,
      title,
      summary,
      content_html,
      cover_image_url,
      status,
      is_featured,
      allow_comments,
      created_at,
      updated_at,
      published_at,
      author_id
    FROM posts
    WHERE id = ?`,
    [id],
  );

  if (!rows.length) {
    return null;
  }

  const row = rows[0];

  const tagRows = await query<TagRow[]>(
    `SELECT t.id, t.name
     FROM tags t
     INNER JOIN post_tags pt ON pt.tag_id = t.id
     WHERE pt.post_id = ?`,
    [id],
  );

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? "",
    contentHtml: row.content_html ?? "",
    coverImageUrl: row.cover_image_url ?? "",
    status: isPostStatus(row.status) ? row.status : "draft",
    isFeatured: Boolean(row.is_featured),
    allowComments: Boolean(row.allow_comments),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at),
    publishedAt: toIsoString(row.published_at),
    authorId: row.author_id,
    tags: tagRows.map((tag) => ({ id: tag.id, name: tag.name })),
  };
}

export interface CreatePostInput {
  title: string;
  slug: string;
  summary: string;
  contentHtml: string;
  coverImageUrl: string;
  status: PostStatus;
  isFeatured: boolean;
  allowComments: boolean;
  authorId: number;
  tags: number[];
}

export async function createPost(input: CreatePostInput): Promise<number> {
  const publishedAtExpression = input.status === "published" ? "NOW()" : "NULL";

  const result = await query<ResultSetHeader>(
    `INSERT INTO posts (
      title,
      slug,
      summary,
      content_html,
      cover_image_url,
      status,
      is_featured,
      allow_comments,
      author_id,
      published_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${publishedAtExpression}, NOW(), NOW())`,
    [
      input.title,
      input.slug,
      input.summary,
      input.contentHtml,
      input.coverImageUrl || null,
      input.status,
      input.isFeatured ? 1 : 0,
      input.allowComments ? 1 : 0,
      input.authorId,
    ],
  );

  const postId = result.insertId;

  if (input.tags.length > 0) {
    const values = input.tags.map((tagId) => [postId, tagId]);
    await query(
      `INSERT INTO post_tags (post_id, tag_id) VALUES ${values.map(() => "(?, ?)").join(", ")}`,
      values.flat(),
    );
  }

  return postId;
}

export interface UpdatePostInput {
  title: string;
  slug: string;
  summary: string;
  contentHtml: string;
  coverImageUrl: string;
  status: PostStatus;
  isFeatured: boolean;
  allowComments: boolean;
  tags: number[];
}

export async function updatePost(id: number, input: UpdatePostInput): Promise<boolean> {
  const result = await query<ResultSetHeader>(
    `UPDATE posts SET
      title = ?,
      slug = ?,
      summary = ?,
      content_html = ?,
      cover_image_url = ?,
      status = ?,
      is_featured = ?,
      allow_comments = ?,
      updated_at = NOW(),
      published_at = CASE
        WHEN ? = 'published' AND published_at IS NULL THEN NOW()
        WHEN ? = 'draft' THEN NULL
        ELSE published_at
      END
    WHERE id = ?`,
    [
      input.title,
      input.slug,
      input.summary,
      input.contentHtml,
      input.coverImageUrl || null,
      input.status,
      input.isFeatured ? 1 : 0,
      input.allowComments ? 1 : 0,
      input.status,
      input.status,
      id,
    ],
  );

  await query("DELETE FROM post_tags WHERE post_id = ?", [id]);

  if (input.tags.length > 0) {
    const values = input.tags.map((tagId) => [id, tagId]);
    await query(
      `INSERT INTO post_tags (post_id, tag_id) VALUES ${values.map(() => "(?, ?)").join(", ")}`,
      values.flat(),
    );
  }

  return result.affectedRows > 0;
}

export async function getAllTags(): Promise<Array<{ id: number; name: string }>> {
  const rows = await query<TagRow[]>("SELECT id, name FROM tags ORDER BY name ASC");
  return rows.map((row) => ({ id: row.id, name: row.name }));
}
