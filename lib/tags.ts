import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { query } from "@/lib/db";

export type TagRecord = RowDataPacket & {
  id: number;
  name: string;
  slug: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type Tag = {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

export type TagWithUsage = Tag & {
  usageCount: number;
};

type TagUsageRow = TagRecord & {
  usage_count: number | string | null;
};

type TagPostRow = RowDataPacket & {
  post_id: number;
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

const mapTagRecord = (row: TagRecord): Tag => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

export const listTagsWithUsage = async (): Promise<TagWithUsage[]> => {
  const rows = await query<TagUsageRow[]>(
    `SELECT t.id, t.name, t.slug, t.created_at, t.updated_at, COUNT(pt.post_id) AS usage_count
     FROM tags t
     LEFT JOIN post_tags pt ON pt.tag_id = t.id
     GROUP BY t.id
     ORDER BY t.name ASC`,
  );

  return rows.map((row) => ({
    ...mapTagRecord(row),
    usageCount: typeof row.usage_count === "number" ? row.usage_count : Number(row.usage_count ?? 0),
  }));
};

export const getTagById = async (id: number): Promise<Tag | null> => {
  const rows = await query<TagRecord[]>(
    `SELECT id, name, slug, created_at, updated_at FROM tags WHERE id = ? LIMIT 1`,
    [id],
  );

  const row = rows[0];

  if (!row) {
    return null;
  }

  return mapTagRecord(row);
};

export const getTagBySlug = async (slug: string): Promise<Tag | null> => {
  const rows = await query<TagRecord[]>(
    `SELECT id, name, slug, created_at, updated_at FROM tags WHERE slug = ? LIMIT 1`,
    [slug],
  );

  const row = rows[0];

  if (!row) {
    return null;
  }

  return mapTagRecord(row);
};

export const isTagSlugTaken = async (slug: string, excludeId?: number): Promise<boolean> => {
  const params: Array<string | number> = [slug];
  let condition = "";

  if (typeof excludeId === "number") {
    condition = "AND id <> ?";
    params.push(excludeId);
  }

  const rows = await query<RowDataPacket[]>(
    `SELECT id FROM tags WHERE slug = ? ${condition} LIMIT 1`,
    params,
  );

  return rows.length > 0;
};

export const getTagsByIds = async (ids: number[]): Promise<Tag[]> => {
  const uniqueIds = Array.from(
    new Set(ids.filter((value) => Number.isInteger(value) && value > 0)),
  );

  if (uniqueIds.length === 0) {
    return [];
  }

  const rows = await query<TagRecord[]>(
    `SELECT id, name, slug, created_at, updated_at FROM tags WHERE id IN (?) ORDER BY name ASC`,
    [uniqueIds],
  );

  return rows.map(mapTagRecord);
};

export const findMissingTagIds = async (ids: number[]): Promise<number[]> => {
  const uniqueIds = Array.from(
    new Set(ids.filter((value) => Number.isInteger(value) && value > 0)),
  );

  if (uniqueIds.length === 0) {
    return [];
  }

  const rows = await query<IdRow[]>(`SELECT id FROM tags WHERE id IN (?)`, [uniqueIds]);
  const found = new Set(rows.map((row) => row.id));

  return uniqueIds.filter((id) => !found.has(id));
};

export const createTagRecord = async (data: { name: string; slug: string }): Promise<Tag> => {
  const result = await query<ResultSetHeader>(
    `INSERT INTO tags (name, slug) VALUES (?, ?)`,
    [data.name, data.slug],
  );

  const id = Number(result.insertId);

  const created = await getTagById(id);

  if (!created) {
    throw new Error("Failed to load created tag");
  }

  return created;
};

export const updateTagRecord = async (
  id: number,
  data: { name?: string; slug?: string },
): Promise<Tag | null> => {
  const assignments: string[] = [];
  const params: Array<string | number> = [];

  if (typeof data.name === "string") {
    assignments.push("name = ?");
    params.push(data.name);
  }

  if (typeof data.slug === "string") {
    assignments.push("slug = ?");
    params.push(data.slug);
  }

  if (assignments.length > 0) {
    params.push(id);
    const sql = `UPDATE tags SET ${assignments.join(", ")} WHERE id = ?`;
    await query<ResultSetHeader>(sql, params);
  }

  return getTagById(id);
};

export const deleteTagRecord = async (id: number): Promise<boolean> => {
  await query<ResultSetHeader>(`DELETE FROM post_tags WHERE tag_id = ?`, [id]);
  const result = await query<ResultSetHeader>(`DELETE FROM tags WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

export const getTagPostIds = async (tagId: number): Promise<number[]> => {
  const rows = await query<TagPostRow[]>(
    `SELECT post_id FROM post_tags WHERE tag_id = ? ORDER BY post_id ASC`,
    [tagId],
  );

  return rows.map((row) => row.post_id);
};

export const replaceTagPostAssociations = async (
  tagId: number,
  postIds: number[],
): Promise<void> => {
  const uniqueIds = Array.from(
    new Set(postIds.filter((value) => Number.isInteger(value) && value > 0)),
  );

  await query<ResultSetHeader>(`DELETE FROM post_tags WHERE tag_id = ?`, [tagId]);

  if (uniqueIds.length === 0) {
    return;
  }

  const placeholders = uniqueIds.map(() => "(?, ?)").join(", ");
  const params: number[] = [];

  for (const postId of uniqueIds) {
    params.push(postId, tagId);
  }

  await query<ResultSetHeader>(
    `INSERT INTO post_tags (post_id, tag_id) VALUES ${placeholders}`,
    params,
  );
};
