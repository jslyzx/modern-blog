import type { RowDataPacket } from "mysql2";

import { query } from "@/lib/db";

const PUBLISHED_POST_CONDITION = "p.published_at IS NOT NULL AND p.published_at <= NOW()";

interface PostRow extends RowDataPacket {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  metaDescription: string | null;
  coverImageUrl: string | null;
  canonicalUrl: string | null;
  content: string;
  publishedAt: Date | string | null;
  updatedAt: Date | string | null;
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
  summary: string | null;
  metaDescription: string | null;
  coverImageUrl: string | null;
  canonicalUrl: string | null;
  content: string;
  publishedAt: Date | null;
  updatedAt: Date | null;
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
  summary: row.summary ?? null,
  metaDescription: row.metaDescription ?? null,
  coverImageUrl: row.coverImageUrl ?? null,
  canonicalUrl: row.canonicalUrl ?? null,
  content: row.content,
  publishedAt: toDate(row.publishedAt),
  updatedAt: toDate(row.updatedAt),
});

const POSTS_SELECT = `
  SELECT
    p.id,
    p.slug,
    p.title,
    p.summary AS summary,
    p.meta_description AS metaDescription,
    p.cover_image_url AS coverImageUrl,
    p.canonical_url AS canonicalUrl,
    p.content,
    p.published_at AS publishedAt,
    p.updated_at AS updatedAt
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
