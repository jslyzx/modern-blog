import type { RowDataPacket } from "mysql2";

import { query } from "@/lib/db";

const PUBLISHED_POST_CONDITION = "p.published_at IS NOT NULL AND p.published_at <= NOW()";

interface PostRow extends RowDataPacket {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  metaDescription: string | null;
  coverImageUrl: string | null;
  canonicalUrl: string | null;
  content: string;
  publishedAt: Date | string | null;
  updatedAt: Date | string | null;
  isFeatured?: number | boolean;
}

interface TagRow extends RowDataPacket {
  id: number;
  slug: string;
  name: string;
  lastUpdated: Date | string | null;
}

export interface PublishedTag {
  id: number;
  slug: string;
  name: string;
  updatedAt: Date | null;
}

export interface PublishedPostSummary {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  metaDescription: string | null;
  coverImageUrl: string | null;
  canonicalUrl: string | null;
  content: string;
  publishedAt: Date | null;
  updatedAt: Date | null;
  isFeatured?: boolean;
}

export interface PublishedPost extends PublishedPostSummary {
  tags: PublishedTag[];
}

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

const mapPostRow = (row: PostRow): PublishedPostSummary => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  excerpt: row.excerpt ?? null,
  metaDescription: row.metaDescription ?? null,
  coverImageUrl: row.coverImageUrl ?? null,
  canonicalUrl: row.canonicalUrl ?? null,
  content: row.content,
  publishedAt: toDate(row.publishedAt),
  updatedAt: toDate(row.updatedAt),
  isFeatured: Boolean(row.isFeatured),
});

const POSTS_SELECT = `
  SELECT
    p.id,
    p.slug,
    p.title,
    p.excerpt,
    p.meta_description AS metaDescription,
    p.cover_image_url AS coverImageUrl,
    p.canonical_url AS canonicalUrl,
    p.content,
    p.published_at AS publishedAt,
    p.updated_at AS updatedAt,
    p.is_featured AS isFeatured
  FROM posts p
  WHERE ${PUBLISHED_POST_CONDITION}
`;

export const getPublishedPosts = async (limit?: number): Promise<PublishedPostSummary[]> => {
  const sql = limit ? `${POSTS_SELECT} ORDER BY p.published_at DESC LIMIT ?` : `${POSTS_SELECT} ORDER BY p.published_at DESC`;
  const params = limit ? [limit] : [];

  const rows = await query<PostRow[]>(sql, params);

  return rows.map(mapPostRow);
};

export const getPublishedPostSlugs = async (): Promise<string[]> => {
  const rows = await query<Array<RowDataPacket & { slug: string }>>(
    `SELECT p.slug FROM posts p WHERE ${PUBLISHED_POST_CONDITION}`,
  );

  return rows.map((row) => row.slug);
};

const getTagsForPost = async (postId: number): Promise<PublishedTag[]> => {
  try {
    const rows = await query<TagRow[]>(
      `
        SELECT
          t.id,
          t.slug,
          t.name,
          MAX(p.updated_at) AS lastUpdated
        FROM tags t
        INNER JOIN post_tags pt ON pt.tag_id = t.id
        INNER JOIN posts p ON p.id = pt.post_id
        WHERE pt.post_id = ?
          AND ${PUBLISHED_POST_CONDITION}
        GROUP BY t.id, t.slug, t.name
        ORDER BY t.name ASC
      `,
      [postId],
    );

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      updatedAt: toDate(row.lastUpdated),
    }));
  } catch (error) {
    console.warn("Failed to load tags for post", {
      postId,
      error,
    });

    return [];
  }
};

export const getPublishedPostBySlug = async (slug: string): Promise<PublishedPost | null> => {
  const rows = await query<PostRow[]>(`${POSTS_SELECT} AND p.slug = ? LIMIT 1`, [slug]);

  if (!rows.length) {
    return null;
  }

  const post = mapPostRow(rows[0]);
  const tags = await getTagsForPost(post.id);

  return {
    ...post,
    tags,
  };
};

export const getPublishedTags = async (): Promise<PublishedTag[]> => {
  try {
    const rows = await query<TagRow[]>(
      `
        SELECT
          t.id,
          t.slug,
          t.name,
          MAX(p.updated_at) AS lastUpdated
        FROM tags t
        INNER JOIN post_tags pt ON pt.tag_id = t.id
        INNER JOIN posts p ON p.id = pt.post_id
        WHERE ${PUBLISHED_POST_CONDITION}
        GROUP BY t.id, t.slug, t.name
        ORDER BY t.name ASC
      `,
    );

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      updatedAt: toDate(row.lastUpdated),
    }));
  } catch (error) {
    console.warn("Failed to load published tags", { error });
    return [];
  }
};

export interface PaginatedPosts {
  posts: PublishedPostSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const getPublishedPostsPaginated = async (
  page: number = 1,
  pageSize: number = 10,
): Promise<PaginatedPosts> => {
  const offset = (page - 1) * pageSize;

  const [rows, countResult] = await Promise.all([
    query<PostRow[]>(
      `${POSTS_SELECT} ORDER BY p.published_at DESC LIMIT ? OFFSET ?`,
      [pageSize, offset],
    ),
    query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) as total FROM posts p WHERE ${PUBLISHED_POST_CONDITION}`,
    ),
  ]);

  const total = countResult[0]?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    posts: rows.map(mapPostRow),
    total,
    page,
    pageSize,
    totalPages,
  };
};

export const getFeaturedPosts = async (limit: number = 3): Promise<PublishedPostSummary[]> => {
  const rows = await query<PostRow[]>(
    `${POSTS_SELECT} AND p.is_featured = 1 ORDER BY p.published_at DESC LIMIT ?`,
    [limit],
  );

  return rows.map(mapPostRow);
};

export const searchPublishedPosts = async (searchQuery: string): Promise<PublishedPostSummary[]> => {
  if (!searchQuery?.trim()) {
    return [];
  }

  const searchTerm = `%${searchQuery.trim()}%`;
  const rows = await query<PostRow[]>(
    `${POSTS_SELECT} AND (p.title LIKE ? OR p.excerpt LIKE ?) ORDER BY p.published_at DESC LIMIT 50`,
    [searchTerm, searchTerm],
  );

  return rows.map(mapPostRow);
};

export interface AdjacentPosts {
  previous: PublishedPostSummary | null;
  next: PublishedPostSummary | null;
}

export const getAdjacentPosts = async (currentPostId: number): Promise<AdjacentPosts> => {
  const [previousRows, nextRows] = await Promise.all([
    query<PostRow[]>(
      `
        SELECT
          p.id,
          p.slug,
          p.title,
          p.excerpt,
          p.meta_description AS metaDescription,
          p.cover_image_url AS coverImageUrl,
          p.canonical_url AS canonicalUrl,
          p.content,
          p.published_at AS publishedAt,
          p.updated_at AS updatedAt,
          p.is_featured AS isFeatured
        FROM posts p
        WHERE ${PUBLISHED_POST_CONDITION}
          AND p.id < ?
        ORDER BY p.published_at DESC
        LIMIT 1
      `,
      [currentPostId],
    ),
    query<PostRow[]>(
      `
        SELECT
          p.id,
          p.slug,
          p.title,
          p.excerpt,
          p.meta_description AS metaDescription,
          p.cover_image_url AS coverImageUrl,
          p.canonical_url AS canonicalUrl,
          p.content,
          p.published_at AS publishedAt,
          p.updated_at AS updatedAt,
          p.is_featured AS isFeatured
        FROM posts p
        WHERE ${PUBLISHED_POST_CONDITION}
          AND p.id > ?
        ORDER BY p.published_at ASC
        LIMIT 1
      `,
      [currentPostId],
    ),
  ]);

  return {
    previous: previousRows.length > 0 ? mapPostRow(previousRows[0]) : null,
    next: nextRows.length > 0 ? mapPostRow(nextRows[0]) : null,
  };
};
