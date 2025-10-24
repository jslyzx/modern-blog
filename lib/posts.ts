import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { query } from "@/lib/db";

export type PostRow = RowDataPacket & {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  status: "draft" | "published" | string;
  published_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type CountRow = RowDataPacket & {
  count: number | string;
};

type PostTagRow = RowDataPacket & {
  post_id: number;
  tag_id: number;
  tag_name: string;
  tag_slug: string;
};

export type TagSummary = {
  id: number;
  name: string;
  slug: string;
};

export type Post = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: TagSummary[];
};

export type ListPostsOptions = {
  status?: "draft" | "published";
  tagId?: number;
  page?: number;
  pageSize?: number;
};

export type PaginatedPosts = {
  posts: Post[];
  total: number;
  page: number;
  pageSize: number;
};

type CreatePostInput = {
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  status: "draft" | "published";
  publishedAt?: string | null;
  tagIds?: number[];
};

type UpdatePostInput = {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string | null;
  status?: "draft" | "published";
  publishedAt?: string | null;
  tagIds?: number[];
};

type IdRow = RowDataPacket & {
  id: number;
};

const toIsoString = (value: Date | string): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
};

const mapPostRow = (row: PostRow): Omit<Post, "tags"> => ({
  id: row.id,
  title: row.title,
  slug: row.slug,
  excerpt: row.excerpt,
  content: row.content,
  status: row.status === "published" ? "published" : "draft",
  publishedAt:
    row.published_at === null
      ? null
      : row.published_at instanceof Date
        ? row.published_at.toISOString()
        : new Date(row.published_at).toISOString(),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const mapTagSummary = (row: PostTagRow): TagSummary => ({
  id: row.tag_id,
  name: row.tag_name,
  slug: row.tag_slug,
});

const fetchTagsForPostIds = async (postIds: number[]): Promise<Map<number, TagSummary[]>> => {
  if (postIds.length === 0) {
    return new Map();
  }

  const rows = await query<PostTagRow[]>(
    `SELECT pt.post_id, t.id AS tag_id, t.name AS tag_name, t.slug AS tag_slug
     FROM post_tags pt
     INNER JOIN tags t ON t.id = pt.tag_id
     WHERE pt.post_id IN (?)
     ORDER BY t.name ASC`,
    [postIds],
  );

  const map = new Map<number, TagSummary[]>();

  for (const row of rows) {
    const existing = map.get(row.post_id);

    if (existing) {
      existing.push(mapTagSummary(row));
      continue;
    }

    map.set(row.post_id, [mapTagSummary(row)]);
  }

  return map;
};

const setPostTags = async (postId: number, tagIds: number[]): Promise<void> => {
  const uniqueIds = Array.from(
    new Set(tagIds.filter((value) => Number.isInteger(value) && value > 0)),
  );

  await query<ResultSetHeader>(`DELETE FROM post_tags WHERE post_id = ?`, [postId]);

  if (uniqueIds.length === 0) {
    return;
  }

  const placeholders = uniqueIds.map(() => "(?, ?)").join(", ");
  const params: number[] = [];

  for (const tagId of uniqueIds) {
    params.push(postId, tagId);
  }

  await query<ResultSetHeader>(
    `INSERT INTO post_tags (post_id, tag_id) VALUES ${placeholders}`,
    params,
  );
};

const paginateOptions = (options: ListPostsOptions) => {
  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : 25;
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
};

export const listPosts = async (options: ListPostsOptions = {}): Promise<PaginatedPosts> => {
  const { page, pageSize, offset } = paginateOptions(options);

  const joins: string[] = [];
  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (typeof options.tagId === "number") {
    joins.push("INNER JOIN post_tags pt_filter ON pt_filter.post_id = p.id");
    whereClauses.push("pt_filter.tag_id = ?");
    params.push(options.tagId);
  }

  if (options.status) {
    whereClauses.push("p.status = ?");
    params.push(options.status);
  }

  const fromClause = `FROM posts p${joins.length ? ` ${joins.join(" ")}` : ""}`;
  const whereClause = whereClauses.length ? ` WHERE ${whereClauses.join(" AND ")}` : "";

  const countRows = await query<CountRow[]>(
    `SELECT COUNT(DISTINCT p.id) AS count ${fromClause}${whereClause}`,
    params,
  );

  const totalRaw = countRows[0]?.count ?? 0;
  const total = typeof totalRaw === "number" ? totalRaw : Number(totalRaw);

  const postRows = await query<PostRow[]>(
    `SELECT DISTINCT p.id, p.title, p.slug, p.excerpt, p.content, p.status, p.published_at, p.created_at, p.updated_at
     ${fromClause}${whereClause}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  if (postRows.length === 0) {
    return {
      posts: [],
      total,
      page,
      pageSize,
    };
  }

  const tagsMap = await fetchTagsForPostIds(postRows.map((row) => row.id));

  return {
    posts: postRows.map((row) => ({
      ...mapPostRow(row),
      tags: tagsMap.get(row.id) ?? [],
    })),
    total,
    page,
    pageSize,
  };
};

export const getPostById = async (id: number): Promise<Post | null> => {
  const rows = await query<PostRow[]>(
    `SELECT id, title, slug, excerpt, content, status, published_at, created_at, updated_at
     FROM posts
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  const row = rows[0];

  if (!row) {
    return null;
  }

  const tagsMap = await fetchTagsForPostIds([row.id]);

  return {
    ...mapPostRow(row),
    tags: tagsMap.get(row.id) ?? [],
  };
};

export const getPostBySlug = async (slug: string): Promise<Post | null> => {
  const rows = await query<PostRow[]>(
    `SELECT id, title, slug, excerpt, content, status, published_at, created_at, updated_at
     FROM posts
     WHERE slug = ?
     LIMIT 1`,
    [slug],
  );

  const row = rows[0];

  if (!row) {
    return null;
  }

  const tagsMap = await fetchTagsForPostIds([row.id]);

  return {
    ...mapPostRow(row),
    tags: tagsMap.get(row.id) ?? [],
  };
};

export const isPostSlugTaken = async (slug: string, excludeId?: number): Promise<boolean> => {
  const params: Array<string | number> = [slug];
  let condition = "";

  if (typeof excludeId === "number") {
    condition = "AND id <> ?";
    params.push(excludeId);
  }

  const rows = await query<RowDataPacket[]>(
    `SELECT id FROM posts WHERE slug = ? ${condition} LIMIT 1`,
    params,
  );

  return rows.length > 0;
};

export const createPost = async (input: CreatePostInput): Promise<Post> => {
  const result = await query<ResultSetHeader>(
    `INSERT INTO posts (title, slug, excerpt, content, status, published_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      input.slug,
      input.excerpt ?? null,
      input.content ?? null,
      input.status,
      input.publishedAt ?? null,
    ],
  );

  const postId = Number(result.insertId);

  if (Array.isArray(input.tagIds)) {
    await setPostTags(postId, input.tagIds);
  }

  const created = await getPostById(postId);

  if (!created) {
    throw new Error("Failed to load created post");
  }

  return created;
};

export const updatePost = async (id: number, input: UpdatePostInput): Promise<Post | null> => {
  const assignments: string[] = [];
  const params: Array<string | number | null> = [];

  if (input.title !== undefined) {
    assignments.push("title = ?");
    params.push(input.title);
  }

  if (input.slug !== undefined) {
    assignments.push("slug = ?");
    params.push(input.slug);
  }

  if (input.excerpt !== undefined) {
    assignments.push("excerpt = ?");
    params.push(input.excerpt ?? null);
  }

  if (input.content !== undefined) {
    assignments.push("content = ?");
    params.push(input.content ?? null);
  }

  if (input.status !== undefined) {
    assignments.push("status = ?");
    params.push(input.status);
  }

  if (input.publishedAt !== undefined) {
    assignments.push("published_at = ?");
    params.push(input.publishedAt ?? null);
  }

  if (assignments.length > 0) {
    params.push(id);
    const sql = `UPDATE posts SET ${assignments.join(", ")} WHERE id = ?`;
    await query<ResultSetHeader>(sql, params);
  }

  if (input.tagIds !== undefined) {
    await setPostTags(id, input.tagIds);
  }

  return getPostById(id);
};

export const deletePost = async (id: number): Promise<boolean> => {
  await query<ResultSetHeader>(`DELETE FROM post_tags WHERE post_id = ?`, [id]);
  const result = await query<ResultSetHeader>(`DELETE FROM posts WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

export const findPostBySlug = async (slug: string): Promise<Post | null> => {
  return getPostBySlug(slug);
};

export const findMissingPostIds = async (postIds: number[]): Promise<number[]> => {
  const uniqueIds = Array.from(
    new Set(postIds.filter((value) => Number.isInteger(value) && value > 0)),
  );

  if (uniqueIds.length === 0) {
    return [];
  }

  const rows = await query<IdRow[]>(
    `SELECT id FROM posts WHERE id IN (?)`,
    [uniqueIds],
  );

  const found = new Set<number>(rows.map((row) => row.id));

  return uniqueIds.filter((id) => !found.has(id));
};

export const getPublishedPostsByTagId = async (
  tagId: number,
  options: { page?: number; pageSize?: number } = {},
): Promise<PaginatedPosts> => {
  return listPosts({
    status: "published",
    tagId,
    page: options.page,
    pageSize: options.pageSize,
  });
};
