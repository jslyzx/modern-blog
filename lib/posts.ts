import type { RowDataPacket } from "mysql2";

import { query } from "@/lib/db";
import { htmlToPlainText } from "@/lib/markdown";

const PUBLISHED_POST_CONDITION = "p.status = 'published' AND (p.published_at IS NULL OR p.published_at <= NOW())";
const META_DESCRIPTION_MAX_LENGTH = 160;

interface PostRow extends RowDataPacket {
  id: number;
  slug: string | null;
  title: string;
  summary: string | null;
  coverImageUrl: string | null;
  contentHtml: string | null;
  contentMd: string | null;
  publishedAt: Date | string | null;
  updatedAt: Date | string | null;
  createdAt: Date | string | null;
  isFeatured: number | null;
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
  contentHtml: string;
  contentMd: string | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
  createdAt: Date | null;
  isFeatured: boolean;
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

const normalizeNullableText = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
};

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const truncateToLength = (value: string, limit: number): string => {
  if (value.length <= limit) {
    return value;
  }

  const slicePoint = Math.max(limit - 1, 0);
  const truncated = value.slice(0, slicePoint);
  const lastSpace = truncated.lastIndexOf(" ");
  const safeSlice =
    lastSpace > 0 && lastSpace >= slicePoint * 0.6 ? truncated.slice(0, lastSpace) : truncated;

  return `${safeSlice.trimEnd()}…`;
};

const deriveMetaDescription = (summary: string | null, contentHtml: string): string | null => {
  if (summary) {
    const normalizedSummary = collapseWhitespace(summary);

    if (normalizedSummary) {
      return truncateToLength(normalizedSummary, META_DESCRIPTION_MAX_LENGTH);
    }
  }

  if (!contentHtml) {
    return null;
  }

  const plainText = collapseWhitespace(htmlToPlainText(contentHtml));

  if (!plainText) {
    return null;
  }

  return truncateToLength(plainText, META_DESCRIPTION_MAX_LENGTH);
};

const mapPostRow = (row: PostRow): PublishedPostSummary => {
  const summary = normalizeNullableText(row.summary);
  const contentHtml = row.contentHtml ?? "";
  const contentMd = normalizeNullableText(row.contentMd);
  const metaDescription = deriveMetaDescription(summary, contentHtml);
  const rawSlug = (row.slug ?? "").trim();
  const slug = rawSlug.replace(/^\/+/, "");

  return {
    id: row.id,
    slug,
    title: row.title,
    summary,
    metaDescription,
    coverImageUrl: row.coverImageUrl ?? null,
    contentHtml,
    contentMd,
    publishedAt: toDate(row.publishedAt),
    updatedAt: toDate(row.updatedAt),
    createdAt: toDate(row.createdAt),
    isFeatured: Boolean(row.isFeatured),
  };
};

const POSTS_SELECT = `
  SELECT
    p.id,
    p.slug,
    p.title,
    p.summary AS summary,
    p.cover_image_url AS coverImageUrl,
    p.content_html AS contentHtml,
    p.content_md AS contentMd,
    p.published_at AS publishedAt,
    p.updated_at AS updatedAt,
    p.created_at AS createdAt,
    p.is_featured AS isFeatured
  FROM posts p
  WHERE ${PUBLISHED_POST_CONDITION}
`;

export interface GetPublishedPostsOptions {
  limit?: number;
  offset?: number;
}

export const getPublishedPosts = async (
  options: GetPublishedPostsOptions = {},
): Promise<PublishedPostSummary[]> => {
  const { limit, offset } = options;

  const sanitizedLimit =
    typeof limit === "number" && Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : undefined;
  const sanitizedOffset =
    typeof offset === "number" && Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : undefined;

  let sql = `${POSTS_SELECT} ORDER BY COALESCE(p.published_at, p.created_at) DESC`;
  const params: number[] = [];

  if (sanitizedLimit !== undefined) {
    sql += " LIMIT ?";
    params.push(sanitizedLimit);

    if (sanitizedOffset && sanitizedOffset > 0) {
      sql += " OFFSET ?";
      params.push(sanitizedOffset);
    }
  } else if (sanitizedOffset && sanitizedOffset > 0) {
    sql += " LIMIT 18446744073709551615 OFFSET ?";
    params.push(sanitizedOffset);
  }

  const rows = await query<PostRow[]>(sql, params);

  return rows.map(mapPostRow);
};

export const getPublishedPostSlugs = async (): Promise<string[]> => {
  const rows = await query<Array<RowDataPacket & { slug: string | null }>>(
    `SELECT p.slug FROM posts p WHERE ${PUBLISHED_POST_CONDITION} ORDER BY COALESCE(p.published_at, p.created_at) DESC`,
  );

  return rows
    .map((row) => row.slug?.trim())
    .filter((slug): slug is string => Boolean(slug));
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
