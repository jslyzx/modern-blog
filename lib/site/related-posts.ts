import type { RowDataPacket } from "mysql2";

import { query } from "@/lib/db";
import { loadImageMetadata } from "@/lib/image-metadata";
import { htmlToPlainText } from "@/lib/markdown";
import {
  getTagsForPublishedPosts,
  type PublishedPostSummary,
  type PublishedTag,
} from "@/lib/posts";

const PUBLISHED_POST_CONDITION = "p.status = 'published' AND (p.published_at IS NULL OR p.published_at <= NOW())";
const META_DESCRIPTION_MAX_LENGTH = 160;

interface RelatedPostRow extends RowDataPacket {
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
  viewCount: number | string | bigint | null;
  authorId: number | null;
  authorName: string | null;
  authorEmail: string | null;
  sharedTagCount: number | string | bigint | null;
}

interface PostTagRow extends RowDataPacket {
  tagId: number | null;
}

interface RelatedPostWithScore {
  post: PublishedPostSummary;
  sharedTagCount: number;
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

const mapRelatedPostRow = (row: RelatedPostRow): RelatedPostWithScore => {
  const summary = normalizeNullableText(row.summary);
  const contentHtml = row.contentHtml ?? "";
  const contentMd = normalizeNullableText(row.contentMd);
  const metaDescription = deriveMetaDescription(summary, contentHtml);
  const rawSlug = (row.slug ?? "").trim();
  const slug = rawSlug.replace(/^\/+/, "");
  const coverImageUrl = normalizeNullableText(row.coverImageUrl);
  const authorId = typeof row.authorId === "number" ? row.authorId : null;
  const authorName = normalizeNullableText(row.authorName);
  const authorEmail = normalizeNullableText(row.authorEmail);
  const sharedTagCount = Number(row.sharedTagCount ?? 0);
  const rawViewCount = Number(row.viewCount ?? 0);
  const viewCount = Number.isNaN(rawViewCount) ? 0 : Math.max(0, Math.trunc(rawViewCount));

  const post: PublishedPostSummary = {
    id: row.id,
    slug,
    title: row.title,
    summary,
    metaDescription,
    coverImageUrl,
    coverImageMetadata: null,
    contentHtml,
    contentMd,
    publishedAt: toDate(row.publishedAt),
    updatedAt: toDate(row.updatedAt),
    createdAt: toDate(row.createdAt),
    isFeatured: Boolean(row.isFeatured),
    viewCount,
    author: {
      id: authorId,
      name: authorName,
      email: authorEmail,
    },
  };

  return {
    post,
    sharedTagCount: Number.isNaN(sharedTagCount) ? 0 : sharedTagCount,
  };
};

const enrichCoverImageMetadata = async (posts: PublishedPostSummary[]): Promise<void> => {
  await Promise.all(
    posts.map(async (post) => {
      if (!post.coverImageUrl) {
        post.coverImageMetadata = null;
        return;
      }

      const metadata = await loadImageMetadata(post.coverImageUrl);
      post.coverImageMetadata = metadata;
    }),
  );
};

const sanitizeId = (value: number): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.floor(value);

  return normalized > 0 ? normalized : null;
};

const sanitizeLimit = (value: number | undefined, fallback: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.max(0, Math.floor(value));

  return normalized === 0 ? fallback : Math.min(normalized, 10);
};

const fetchTagIdsForPost = async (postId: number): Promise<number[]> => {
  try {
    const rows = await query<PostTagRow[]>(
      `
        SELECT pt.tag_id AS tagId
        FROM post_tags pt
        INNER JOIN posts p ON p.id = pt.post_id
        WHERE pt.post_id = ?
          AND ${PUBLISHED_POST_CONDITION}
      `,
      [postId],
    );

    const tagIds = rows
      .map((row) => (typeof row.tagId === "number" ? Math.max(0, Math.floor(row.tagId)) : null))
      .filter((value): value is number => value !== null && value > 0);

    return Array.from(new Set(tagIds));
  } catch (error) {
    console.warn("Failed to load tags for post", {
      postId,
      error,
    });

    return [];
  }
};

const fetchRelatedRows = async (postId: number, tagIds: number[], limit: number): Promise<RelatedPostRow[]> => {
  if (!tagIds.length) {
    return [];
  }

  try {
    return await query<RelatedPostRow[]>(
      `
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
          p.is_featured AS isFeatured,
          p.view_count AS viewCount,
          p.author_id AS authorId,
          u.username AS authorName,
          u.email AS authorEmail,
          COUNT(DISTINCT pt.tag_id) AS sharedTagCount
        FROM posts p
        INNER JOIN post_tags pt ON pt.post_id = p.id
        LEFT JOIN users u ON u.id = p.author_id
        WHERE pt.tag_id IN (?)
          AND p.id <> ?
          AND ${PUBLISHED_POST_CONDITION}
        GROUP BY
          p.id,
          p.slug,
          p.title,
          p.summary,
          p.cover_image_url,
          p.content_html,
          p.content_md,
          p.published_at,
          p.updated_at,
          p.created_at,
          p.is_featured,
          p.view_count,
          p.author_id,
          u.username,
          u.email
        ORDER BY sharedTagCount DESC, COALESCE(p.published_at, p.created_at) DESC
        LIMIT ?
      `,
      [tagIds, postId, limit],
    );
  } catch (error) {
    console.warn("Failed to load related posts", {
      postId,
      tagIds,
      error,
    });

    return [];
  }
};

const fetchFallbackRows = async (postId: number, limit: number): Promise<RelatedPostRow[]> => {
  if (limit <= 0) {
    return [];
  }

  try {
    return await query<RelatedPostRow[]>(
      `
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
          p.is_featured AS isFeatured,
          p.view_count AS viewCount,
          p.author_id AS authorId,
          u.username AS authorName,
          u.email AS authorEmail,
          0 AS sharedTagCount
        FROM posts p
        LEFT JOIN users u ON u.id = p.author_id
        WHERE ${PUBLISHED_POST_CONDITION}
          AND p.id <> ?
        ORDER BY COALESCE(p.published_at, p.created_at) DESC
        LIMIT ?
      `,
      [postId, limit],
    );
  } catch (error) {
    console.warn("Failed to load fallback posts", {
      postId,
      error,
    });

    return [];
  }
};

export interface RelatedPost extends PublishedPostSummary {
  tags: PublishedTag[];
  sharedTagCount: number;
}

export interface GetRelatedPostsOptions {
  limit?: number;
  fallbackLimit?: number;
}

export const getRelatedPostsForPost = async (
  postId: number,
  options: GetRelatedPostsOptions = {},
): Promise<RelatedPost[]> => {
  const sanitizedPostId = sanitizeId(postId);

  if (!sanitizedPostId) {
    return [];
  }

  const defaultLimit = 5;
  const sanitizedLimit = sanitizeLimit(options.limit, defaultLimit);
  const fallbackLimit = sanitizeLimit(options.fallbackLimit, sanitizedLimit);

  const tagIds = await fetchTagIdsForPost(sanitizedPostId);
  let rows = await fetchRelatedRows(sanitizedPostId, tagIds, sanitizedLimit);

  if (!rows.length) {
    rows = await fetchFallbackRows(sanitizedPostId, fallbackLimit);
  }

  if (!rows.length) {
    return [];
  }

  const mapped = rows.map(mapRelatedPostRow);
  const posts = mapped.map((item) => item.post);

  await enrichCoverImageMetadata(posts);

  const postIds = posts
    .map((post) => post.id)
    .filter((id) => typeof id === "number" && Number.isFinite(id) && id > 0);
  const tagsByPost = postIds.length ? await getTagsForPublishedPosts(postIds) : new Map<number, PublishedTag[]>();

  return mapped.map(({ post, sharedTagCount }) => ({
    ...post,
    tags: tagsByPost.get(post.id) ?? [],
    sharedTagCount,
  }));
};
