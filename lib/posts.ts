import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { query } from "@/lib/db";
import { buildDraftSlug, slugify } from "@/lib/slug";
import type { Post, PostInput, PostListResponse, PostStatus } from "@/types/post";

type PostRow = RowDataPacket & {
  id: number;
  title: string | null;
  slug: string;
  status: string;
  excerpt: string | null;
  content: string | null;
  editor_content: string | null;
  metadata: string | null;
  tags: string | null;
  allow_comments: number | null;
  is_featured: number | null;
  view_count: number | null;
  published_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const POST_SELECT_FIELDS = [
  "id",
  "title",
  "slug",
  "status",
  "excerpt",
  "content",
  "editor_content",
  "metadata",
  "tags",
  "allow_comments",
  "is_featured",
  "view_count",
  "published_at",
  "created_at",
  "updated_at",
].join(", ");

type PostCountRow = RowDataPacket & {
  count: number;
};

const ensureNumber = (value: number | string | bigint): number => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  return 0;
};

const toIsoString = (value: Date | string | null): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const parseJsonField = <T>(value: string | null): T | null => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn("Failed to parse JSON field", { value, error });
    return null;
  }
};

const serializeJson = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn("Failed to serialize JSON value", { value, error });
    return null;
  }
};

const mapPostRow = (row: PostRow): Post => ({
  id: row.id,
  title: row.title,
  slug: row.slug,
  status: row.status as PostStatus,
  excerpt: row.excerpt,
  content: row.content,
  editorContent: parseJsonField(row.editor_content),
  metadata: parseJsonField(row.metadata),
  tags: parseJsonField<string[]>(row.tags) ?? [],
  allowComments: row.allow_comments === 1,
  isFeatured: row.is_featured === 1,
  viewCount: row.view_count ?? 0,
  publishedAt: toIsoString(row.published_at),
  createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
  updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
});

const fetchPostRowById = async (id: number): Promise<PostRow | null> => {
  const rows = await query<PostRow[]>(`SELECT ${POST_SELECT_FIELDS} FROM posts WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
};

export const getPostById = async (id: number): Promise<Post | null> => {
  const row = await fetchPostRowById(id);
  return row ? mapPostRow(row) : null;
};

type ListPostsOptions = {
  status?: PostStatus;
  search?: string;
  page?: number;
  pageSize?: number;
};

export const listPosts = async (options: ListPostsOptions = {}): Promise<PostListResponse> => {
  const { status, search } = options;
  const page = Math.max(options.page ?? 1, 1);
  const pageSize = Math.max(Math.min(options.pageSize ?? 20, 100), 1);

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  if (search) {
    conditions.push("(title LIKE ? OR slug LIKE ?)");
    const like = `%${search}%`;
    params.push(like, like);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const filterParams = [...params];

  const offset = (page - 1) * pageSize;

  const rows = await query<PostRow[]>(
    `SELECT ${POST_SELECT_FIELDS} FROM posts ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const countRows = await query<PostCountRow[]>(
    `SELECT COUNT(*) as count FROM posts ${whereClause}`,
    filterParams,
  );

  const total = countRows.length > 0 ? ensureNumber(countRows[0].count) : 0;

  return {
    posts: rows.map(mapPostRow),
    total,
    page,
    pageSize,
  };
};

const slugExists = async (slug: string, excludeId?: number): Promise<boolean> => {
  const params: unknown[] = [slug];
  let sql = "SELECT id FROM posts WHERE slug = ?";

  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }

  sql += " LIMIT 1";

  const rows = await query<RowDataPacket[]>(sql, params);
  return rows.length > 0;
};

const ensureUniqueSlug = async (
  slug: string,
  opts: {
    excludeId?: number;
    enforce: boolean;
  },
): Promise<string> => {
  if (!opts.enforce) {
    return slug;
  }

  let candidate = slug;
  let suffix = 1;

  while (await slugExists(candidate, opts.excludeId)) {
    candidate = `${slug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

type ResolveSlugOptions = {
  providedSlug?: string | null;
  title?: string | null;
  status: PostStatus;
  excludeId?: number;
};

const resolveSlug = async ({ providedSlug, title, status, excludeId }: ResolveSlugOptions): Promise<string> => {
  const baseSource = providedSlug ?? title ?? buildDraftSlug();
  const baseSlug = slugify(baseSource);
  const sanitized = baseSlug || buildDraftSlug();
  const enforce = status === "published" || status === "archived";

  return ensureUniqueSlug(sanitized, { excludeId, enforce });
};

const normalizeTags = (tags?: string[] | null): string[] => {
  if (!tags) {
    return [];
  }

  return tags
    .map((tag) => tag.trim())
    .filter((tag, index, all) => tag.length > 0 && all.indexOf(tag) === index);
};

const normalizeBoolean = (value: unknown, fallback = false): 0 | 1 => {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "number") {
    return value === 0 ? 0 : 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return 1;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return 0;
    }
  }

  return fallback ? 1 : 0;
};

const normalizeDateTime = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
};

type CreatePostInput = PostInput & {
  status: PostStatus;
};

export const createPost = async (input: CreatePostInput): Promise<Post> => {
  const status = input.status ?? "draft";
  const slug = await resolveSlug({
    providedSlug: input.slug ?? undefined,
    title: input.title ?? undefined,
    status,
  });

  const now = new Date();
  const publishedAt = status === "published" ? normalizeDateTime(input.publishedAt) ?? normalizeDateTime(now.toISOString()) : normalizeDateTime(input.publishedAt);

  const tags = normalizeTags(input.tags);

  const sql = `
    INSERT INTO posts (
      title,
      slug,
      status,
      excerpt,
      content,
      editor_content,
      metadata,
      tags,
      allow_comments,
      is_featured,
      view_count,
      published_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;

  const params: unknown[] = [
    input.title ?? null,
    slug,
    status,
    input.excerpt ?? null,
    input.content ?? null,
    serializeJson(input.editorContent),
    serializeJson(input.metadata),
    serializeJson(tags),
    normalizeBoolean(input.allowComments, true),
    normalizeBoolean(input.isFeatured, false),
    0,
    publishedAt,
  ];

  const result = await query<ResultSetHeader>(sql, params);
  const newId = result.insertId;

  const created = await getPostById(newId);

  if (!created) {
    throw new Error("Failed to load post after creation.");
  }

  return created;
};

type UpdatePostInternalInput = PostInput & {
  status?: PostStatus;
};

export const updatePost = async (id: number, input: UpdatePostInternalInput): Promise<Post> => {
  const existingRow = await fetchPostRowById(id);

  if (!existingRow) {
    throw new Error(`Post with id ${id} not found.`);
  }

  const nextStatus = input.status ?? (existingRow.status as PostStatus);
  const nextSlug = await resolveSlug({
    providedSlug: input.slug ?? existingRow.slug,
    title: input.title ?? existingRow.title,
    status: nextStatus,
    excludeId: id,
  });

  const nextTags = normalizeTags(input.tags ?? parseJsonField<string[]>(existingRow.tags) ?? []);

  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.title !== undefined) {
    updates.push("title = ?");
    params.push(input.title ?? null);
  }

  if (input.excerpt !== undefined) {
    updates.push("excerpt = ?");
    params.push(input.excerpt ?? null);
  }

  if (input.content !== undefined) {
    updates.push("content = ?");
    params.push(input.content ?? null);
  }

  if (input.editorContent !== undefined) {
    updates.push("editor_content = ?");
    params.push(serializeJson(input.editorContent));
  }

  if (input.metadata !== undefined) {
    updates.push("metadata = ?");
    params.push(serializeJson(input.metadata));
  }

  if (input.tags !== undefined) {
    updates.push("tags = ?");
    params.push(serializeJson(nextTags));
  }

  if (input.allowComments !== undefined) {
    updates.push("allow_comments = ?");
    params.push(normalizeBoolean(input.allowComments));
  }

  if (input.isFeatured !== undefined) {
    updates.push("is_featured = ?");
    params.push(normalizeBoolean(input.isFeatured));
  }

  if (input.status !== undefined || nextSlug !== existingRow.slug) {
    updates.push("status = ?");
    params.push(nextStatus);

    updates.push("slug = ?");
    params.push(nextSlug);
  }

  if (input.publishedAt !== undefined || nextStatus !== (existingRow.status as PostStatus)) {
    const publishedValue =
      nextStatus === "published"
        ? normalizeDateTime(input.publishedAt) ?? normalizeDateTime(existingRow.published_at?.toString() ?? new Date().toISOString())
        : normalizeDateTime(input.publishedAt) ?? null;

    updates.push("published_at = ?");
    params.push(publishedValue);
  }

  if (updates.length === 0) {
    return mapPostRow(existingRow);
  }

  updates.push("updated_at = NOW()");

  params.push(id);

  const sql = `UPDATE posts SET ${updates.join(", ")} WHERE id = ?`;

  await query<ResultSetHeader>(sql, params);

  const updated = await getPostById(id);

  if (!updated) {
    throw new Error("Failed to load post after update.");
  }

  if (typeof input.editorId === "number") {
    const snapshot = {
      title: updated.title,
      slug: updated.slug,
      status: updated.status,
      excerpt: updated.excerpt,
      content: updated.content,
      editorContent: updated.editorContent,
      metadata: updated.metadata,
      tags: updated.tags,
      allowComments: updated.allowComments,
      isFeatured: updated.isFeatured,
      publishedAt: updated.publishedAt,
      updatedAt: updated.updatedAt,
    } as const;

    await query<ResultSetHeader>(
      `INSERT INTO post_revisions (post_id, editor_id, snapshot, created_at) VALUES (?, ?, ?, NOW())`,
      [id, input.editorId, serializeJson(snapshot)],
    );
  }

  return updated;
};

export const deletePost = async (id: number): Promise<void> => {
  await query<ResultSetHeader>("DELETE FROM posts WHERE id = ?", [id]);
};

export const incrementPostViewCount = async (id: number): Promise<number> => {
  const result = await query<ResultSetHeader>(
    "UPDATE posts SET view_count = COALESCE(view_count, 0) + 1, updated_at = NOW() WHERE id = ?",
    [id],
  );

  if (result.affectedRows === 0) {
    throw new Error("Post not found.");
  }

  const rows = await query<PostRow[]>(`SELECT view_count FROM posts WHERE id = ? LIMIT 1`, [id]);
  const row = rows[0];

  return row?.view_count ?? 0;
};
