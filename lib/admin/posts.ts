import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { query, queryWithConnection, withTransaction } from "@/lib/db";
import type { TagOption } from "@/lib/admin/tags";
import { getTagsForPost } from "@/lib/admin/tags";

export type PostStatus = "draft" | "published" | "archived";

export interface PostStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
}

export interface ListPostsParams {
  search?: string;
  status?: PostStatus | "all";
  limit?: number;
  offset?: number;
}

export interface BasePost {
  id: number;
  title: string;
  slug: string;
  status: PostStatus;
  excerpt: string | null;
  coverImageUrl: string | null;
  allowComments: boolean;
  featured: boolean;
  authorId: number | null;
  authorName: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
}

export interface AdminPostSummary extends BasePost {}

export interface AdminPostDetails extends BasePost {
  content: string;
  tags: TagOption[];
}

export interface CreatePostInput {
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  status: PostStatus;
  allowComments: boolean;
  featured: boolean;
  tagIds: number[];
  authorId?: number | null;
  publishedAt?: Date | null;
}

export interface UpdatePostInput extends CreatePostInput {}

interface PostRow extends RowDataPacket {
  id: number;
  title: string;
  slug: string;
  status?: string | null;
  statusRaw?: string | null;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  content?: string | null;
  allowComments?: number | boolean | null;
  isFeatured?: number | boolean | null;
  authorId?: number | null;
  authorName?: string | null;
  authorEmail?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  publishedAt?: Date | string | null;
}

const toDate = (value: Date | string | null | undefined): Date | null => {
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

const toBoolean = (value: number | boolean | string | null | undefined): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  }

  return false;
};

const resolveStatus = (row: PostRow): PostStatus => {
  const raw = (row.statusRaw ?? row.status ?? "").toString().toLowerCase();

  if (raw === "published" || raw === "draft" || raw === "archived") {
    return raw;
  }

  if (row.publishedAt) {
    return "published";
  }

  return "draft";
};

const mapPostSummary = (row: PostRow): AdminPostSummary => ({
  id: row.id,
  title: row.title,
  slug: row.slug,
  status: resolveStatus(row),
  excerpt: row.excerpt ?? null,
  coverImageUrl: row.coverImageUrl ?? null,
  allowComments: toBoolean(row.allowComments ?? null),
  featured: toBoolean(row.isFeatured ?? null),
  authorId: typeof row.authorId === "number" ? row.authorId : null,
  authorName: row.authorName ?? row.authorEmail ?? null,
  createdAt: toDate(row.createdAt ?? null),
  updatedAt: toDate(row.updatedAt ?? null),
  publishedAt: toDate(row.publishedAt ?? null),
});

const mapPostDetails = (row: PostRow, tags: TagOption[]): AdminPostDetails => ({
  ...mapPostSummary(row),
  content: row.content ?? "",
  tags,
});

const buildStatusCondition = (status?: PostStatus | "all"): string | null => {
  if (!status || status === "all") {
    return null;
  }

  if (status === "published") {
    return "(p.status = 'published' OR (p.status IS NULL AND p.published_at IS NOT NULL))";
  }

  if (status === "draft") {
    return "(p.status = 'draft' OR (p.status IS NULL AND p.published_at IS NULL))";
  }

  return "p.status = 'archived'";
};

export const listPosts = async ({
  search,
  status,
  limit = 50,
  offset = 0,
}: ListPostsParams = {}): Promise<AdminPostSummary[]> => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const statusCondition = buildStatusCondition(status);

  if (statusCondition) {
    conditions.push(statusCondition);
  }

  if (search?.trim()) {
    const like = `%${search.trim()}%`;
    conditions.push("(p.title LIKE ? OR p.slug LIKE ?)");
    params.push(like, like);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(limit);
  params.push(offset);

  const rows = await query<PostRow[]>(
    `SELECT
       p.id,
       p.title,
       p.slug,
       p.status AS statusRaw,
       p.excerpt,
       p.cover_image_url AS coverImageUrl,
       p.allow_comments AS allowComments,
       p.is_featured AS isFeatured,
       p.created_at AS createdAt,
       p.updated_at AS updatedAt,
       p.published_at AS publishedAt,
       p.author_id AS authorId,
       u.username AS authorName,
       u.email AS authorEmail
     FROM posts p
     LEFT JOIN users u ON u.id = p.author_id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    params,
  );

  return rows.map(mapPostSummary);
};

export const countPosts = async ({ search, status }: Omit<ListPostsParams, "limit" | "offset"> = {}): Promise<number> => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const statusCondition = buildStatusCondition(status);

  if (statusCondition) {
    conditions.push(statusCondition);
  }

  if (search?.trim()) {
    const like = `%${search.trim()}%`;
    conditions.push("(p.title LIKE ? OR p.slug LIKE ?)");
    params.push(like, like);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await query<Array<RowDataPacket & { total: number }>>(
    `SELECT COUNT(*) AS total FROM posts p ${whereClause}`,
    params,
  );

  return rows[0]?.total ?? 0;
};

export const getPostById = async (id: number): Promise<AdminPostDetails | null> => {
  const rows = await query<PostRow[]>(
    `SELECT
       p.id,
       p.title,
       p.slug,
       p.status AS statusRaw,
       p.excerpt,
       p.cover_image_url AS coverImageUrl,
       p.content,
       p.allow_comments AS allowComments,
       p.is_featured AS isFeatured,
       p.created_at AS createdAt,
       p.updated_at AS updatedAt,
       p.published_at AS publishedAt,
       p.author_id AS authorId,
       u.username AS authorName,
       u.email AS authorEmail
     FROM posts p
     LEFT JOIN users u ON u.id = p.author_id
     WHERE p.id = ?
     LIMIT 1`,
    [id],
  );

  if (!rows.length) {
    return null;
  }

  const tags = await getTagsForPost(id);

  return mapPostDetails(rows[0], tags);
};

export const getPostStats = async (): Promise<PostStats> => {
  const rows = await query<Array<RowDataPacket & PostStats>>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN p.status = 'published' OR (p.status IS NULL AND p.published_at IS NOT NULL) THEN 1 ELSE 0 END) AS published,
       SUM(CASE WHEN (p.status = 'draft' OR p.status IS NULL) AND p.published_at IS NULL THEN 1 ELSE 0 END) AS draft,
       SUM(CASE WHEN p.status = 'archived' THEN 1 ELSE 0 END) AS archived
     FROM posts p`,
  );

  const row = rows[0];

  return {
    total: row?.total ?? 0,
    published: row?.published ?? 0,
    draft: row?.draft ?? 0,
    archived: row?.archived ?? 0,
  };
};

export const createPost = async (input: CreatePostInput): Promise<AdminPostDetails> => {
  const postId = await withTransaction(async (connection) => {
    const publishedAtValue = input.status === "published" ? input.publishedAt ?? new Date() : null;

    const result = await queryWithConnection<ResultSetHeader>(
      connection,
      `INSERT INTO posts (
         title,
         slug,
         content,
         excerpt,
         cover_image_url,
         status,
         allow_comments,
         is_featured,
         author_id,
         published_at,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        input.title,
        input.slug,
        input.content,
        input.excerpt ?? null,
        input.coverImageUrl ?? null,
        input.status,
        input.allowComments ? 1 : 0,
        input.featured ? 1 : 0,
        input.authorId ?? null,
        publishedAtValue,
      ],
    );

    const createdId = Number(result.insertId);

    if (input.tagIds.length) {
      const placeholders = input.tagIds.map(() => "(?, ?)").join(", ");
      const values: Array<number> = [];

      input.tagIds.forEach((tagId) => {
        values.push(createdId, tagId);
      });

      await queryWithConnection(connection, `INSERT INTO post_tags (post_id, tag_id) VALUES ${placeholders}`, values);
    }

    return createdId;
  });

  const post = await getPostById(postId);

  if (!post) {
    throw new Error("Failed to load post after creation");
  }

  return post;
};

export const updatePost = async (id: number, input: UpdatePostInput): Promise<AdminPostDetails> => {
  const postId = await withTransaction(async (connection) => {
    const rows = await queryWithConnection<PostRow[]>(
      connection,
      `SELECT p.id, p.published_at AS publishedAt, p.status AS statusRaw FROM posts p WHERE p.id = ? FOR UPDATE`,
      [id],
    );

    if (!rows.length) {
      throw new Error("Post not found");
    }

    const existing = rows[0];
    const existingPublishedAt = toDate(existing.publishedAt ?? null);

    let publishedAtValue: Date | null = null;

    if (input.status === "published") {
      publishedAtValue = input.publishedAt ?? existingPublishedAt ?? new Date();
    } else if (input.status === "archived") {
      publishedAtValue = existingPublishedAt ?? null;
    } else {
      publishedAtValue = null;
    }

    await queryWithConnection<ResultSetHeader>(
      connection,
      `UPDATE posts
       SET title = ?,
           slug = ?,
           content = ?,
           excerpt = ?,
           cover_image_url = ?,
           status = ?,
           allow_comments = ?,
           is_featured = ?,
           author_id = ?,
           published_at = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        input.title,
        input.slug,
        input.content,
        input.excerpt ?? null,
        input.coverImageUrl ?? null,
        input.status,
        input.allowComments ? 1 : 0,
        input.featured ? 1 : 0,
        input.authorId ?? null,
        publishedAtValue,
        id,
      ],
    );

    await queryWithConnection(connection, `DELETE FROM post_tags WHERE post_id = ?`, [id]);

    if (input.tagIds.length) {
      const placeholders = input.tagIds.map(() => "(?, ?)").join(", ");
      const values: Array<number> = [];

      input.tagIds.forEach((tagId) => {
        values.push(id, tagId);
      });

      await queryWithConnection(connection, `INSERT INTO post_tags (post_id, tag_id) VALUES ${placeholders}`, values);
    }

    return id;
  });

  const post = await getPostById(postId);

  if (!post) {
    throw new Error("Failed to load post after update");
  }

  return post;
};

export const deletePost = async (id: number): Promise<boolean> => {
  return withTransaction(async (connection) => {
    await queryWithConnection(connection, `DELETE FROM post_tags WHERE post_id = ?`, [id]);

    const result = await queryWithConnection<ResultSetHeader>(connection, `DELETE FROM posts WHERE id = ?`, [id]);

    return result.affectedRows > 0;
  });
};
