import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { query } from "@/lib/db";
import { randomSlugId, toPinyinSlug } from "@/lib/slug";

const INCREMENTAL_SUFFIX_LIMIT = 10;
const RANDOM_SUFFIX_ATTEMPTS = 5;

export type NumericValue = number | string | null | undefined;

const toCount = (value: NumericValue): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  return 0;
};

const toDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

export const normalizeTagName = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return value.toString().trim();
  }

  return "";
};

interface TagRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  postCount: NumericValue;
}

export interface TagRecord {
  id: number;
  name: string;
  slug: string;
  postCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

const mapRowToTag = (row: TagRow): TagRecord => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  postCount: toCount(row.postCount),
  createdAt: toDate(row.createdAt),
  updatedAt: toDate(row.updatedAt),
});

const TAG_SELECT_BASE = `
  SELECT
    t.id,
    t.name,
    t.slug,
    t.created_at AS createdAt,
    COUNT(pt.post_id) AS postCount
  FROM tags t
  LEFT JOIN post_tags pt ON pt.tag_id = t.id
`;

const buildWhereClause = (search: string | null): { clause: string; params: unknown[] } => {
  if (!search) {
    return { clause: "", params: [] };
  }

  return {
    clause: " WHERE (t.name LIKE ? OR t.slug LIKE ?)",
    params: [`%${search}%`, `%${search}%`],
  };
};

export interface ListTagsOptions {
  search?: string | null;
  limit?: number;
  offset?: number;
}

export interface ListTagsResult {
  tags: TagRecord[];
  total: number;
}

const sanitizeLimit = (value: number | null | undefined, fallback: number): number => {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return fallback;
  }

  const parsed = Math.trunc(value as number);

  if (parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, 100);
};

const sanitizeOffset = (value: number | null | undefined): number => {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return 0;
  }

  const parsed = Math.trunc(value as number);

  return parsed < 0 ? 0 : parsed;
};

export const listTags = async (options: ListTagsOptions = {}): Promise<ListTagsResult> => {
  const search = normalizeTagName(options.search ?? "") || null;
  const limit = sanitizeLimit(options.limit ?? 20, 20);
  const offset = sanitizeOffset(options.offset ?? 0);

  const { clause, params: filterParams } = buildWhereClause(search);

  const dataSql = `${TAG_SELECT_BASE}${clause} GROUP BY t.id ORDER BY t.name ASC LIMIT ? OFFSET ?`;
  const rows = await query<TagRow[]>(dataSql, [...filterParams, limit, offset]);

  const countSql = `SELECT COUNT(*) AS total FROM tags t${clause}`;
  const countRows = await query<Array<RowDataPacket & { total: NumericValue }>>(countSql, filterParams);
  const total = toCount(countRows[0]?.total);

  return {
    tags: rows.map(mapRowToTag),
    total,
  };
};

export const getTagById = async (id: number): Promise<TagRecord | null> => {
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  const rows = await query<TagRow[]>(`${TAG_SELECT_BASE} WHERE t.id = ? GROUP BY t.id LIMIT 1`, [id]);

  if (!rows.length) {
    return null;
  }

  return mapRowToTag(rows[0]);
};

export const getTagBySlug = async (slug: string): Promise<TagRecord | null> => {
  const normalizedSlug = slug.trim();

  if (!normalizedSlug) {
    return null;
  }

  const rows = await query<TagRow[]>(`${TAG_SELECT_BASE} WHERE t.slug = ? GROUP BY t.id LIMIT 1`, [normalizedSlug]);

  if (!rows.length) {
    return null;
  }

  return mapRowToTag(rows[0]);
};

interface IdRow extends RowDataPacket {
  id: number;
}

export interface UniqueSlugOptions {
  excludeId?: number;
}

export const isTagNameTaken = async (name: string, excludeId?: number): Promise<boolean> => {
  if (!name) {
    return false;
  }

  let sql = "SELECT id FROM tags WHERE name = ?";
  const params: Array<string | number> = [name];

  if (excludeId && Number.isFinite(excludeId) && excludeId > 0) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }

  sql += " LIMIT 1";

  const rows = await query<IdRow[]>(sql, params);

  return rows.length > 0;
};

export const isTagSlugTaken = async (slug: string, excludeId?: number): Promise<boolean> => {
  if (!slug) {
    return false;
  }

  let sql = "SELECT id FROM tags WHERE slug = ?";
  const params: Array<string | number> = [slug];

  if (excludeId && Number.isFinite(excludeId) && excludeId > 0) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }

  sql += " LIMIT 1";

  const rows = await query<IdRow[]>(sql, params);

  return rows.length > 0;
};

export const ensureUniqueTagSlug = async (baseSlug: string, options: UniqueSlugOptions = {}): Promise<string> => {
  const normalizedBase = baseSlug.trim() || `tag-${randomSlugId()}`;
  const { excludeId } = options;

  if (!(await isTagSlugTaken(normalizedBase, excludeId))) {
    return normalizedBase;
  }

  for (let increment = 2; increment <= INCREMENTAL_SUFFIX_LIMIT + 1; increment += 1) {
    const candidate = `${normalizedBase}-${increment}`;

    if (!(await isTagSlugTaken(candidate, excludeId))) {
      return candidate;
    }
  }

  for (let attempt = 0; attempt < RANDOM_SUFFIX_ATTEMPTS; attempt += 1) {
    const candidate = `${normalizedBase}-${randomSlugId()}`;

    if (!(await isTagSlugTaken(candidate, excludeId))) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique tag slug");
};

export interface CreateTagInput {
  name: string;
}

export const createTag = async (input: CreateTagInput): Promise<TagRecord> => {
  const name = normalizeTagName(input.name);

  if (!name) {
    throw new Error("Tag name is required");
  }

  if (await isTagNameTaken(name)) {
    throw new Error("Tag name already exists");
  }

  const baseSlug = toPinyinSlug(name);
  const slug = await ensureUniqueTagSlug(baseSlug);

  const result = await query<ResultSetHeader>(
    "INSERT INTO tags (name, slug, created_at) VALUES (?, ?, NOW())",
    [name, slug],
  );

  const tag = await getTagById(result.insertId);

  if (!tag) {
    throw new Error("Failed to load created tag");
  }

  return tag;
};

export interface UpdateTagInput {
  name: string;
}

export const updateTag = async (id: number, input: UpdateTagInput): Promise<TagRecord | null> => {
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  const existing = await getTagById(id);

  if (!existing) {
    return null;
  }

  const name = normalizeTagName(input.name);

  if (!name) {
    throw new Error("Tag name is required");
  }

  if (await isTagNameTaken(name, id)) {
    throw new Error("Tag name already exists");
  }

  let slug = existing.slug;

  if (name !== existing.name) {
    const baseSlug = toPinyinSlug(name);
    slug = await ensureUniqueTagSlug(baseSlug, { excludeId: id });
  }

  await query<ResultSetHeader>("UPDATE tags SET name = ?, slug = ? WHERE id = ?", [name, slug, id]);

  const updated = await getTagById(id);

  if (!updated) {
    throw new Error("Failed to load updated tag");
  }

  return updated;
};

export const deleteTag = async (id: number): Promise<boolean> => {
  if (!Number.isFinite(id) || id <= 0) {
    return false;
  }

  const result = await query<ResultSetHeader>("DELETE FROM tags WHERE id = ?", [id]);

  return result.affectedRows > 0;
};

interface TagOptionRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
}

export interface TagOption {
  id: number;
  name: string;
  slug: string;
}

export const getAllTagOptions = async (): Promise<TagOption[]> => {
  const rows = await query<TagOptionRow[]>("SELECT id, name, slug FROM tags ORDER BY name ASC");

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
  }));
};

export const replacePostTags = async (
  connection: PoolConnection,
  postId: number,
  tagIds: number[],
): Promise<void> => {
  await connection.query("DELETE FROM post_tags WHERE post_id = ?", [postId]);

  if (!tagIds.length) {
    return;
  }

  const uniqueIds: number[] = Array.from(
    new Set(
      tagIds
        .map((id) => (Number.isFinite(id) ? Math.trunc(id) : 0))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );

  if (!uniqueIds.length) {
    return;
  }

  const placeholders = uniqueIds.map(() => "(?, ?)").join(", ");
  const values = uniqueIds.flatMap((tagId) => [postId, tagId]);

  await connection.query(`INSERT INTO post_tags (post_id, tag_id) VALUES ${placeholders}`, values);
};
