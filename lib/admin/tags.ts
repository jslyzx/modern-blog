import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { query, queryWithConnection, withTransaction } from "@/lib/db";

export interface AdminTag {
  id: number;
  name: string;
  slug: string;
  postCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface TagOption {
  id: number;
  name: string;
  slug: string;
}

export interface CreateTagInput {
  name: string;
  slug: string;
}

export interface UpdateTagInput {
  name: string;
  slug: string;
}

interface TagRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  postCount?: number | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
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

const mapTagRow = (row: TagRow): AdminTag => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  postCount: row.postCount ?? 0,
  createdAt: toDate(row.createdAt ?? null),
  updatedAt: toDate(row.updatedAt ?? null),
});

export const listTags = async (): Promise<AdminTag[]> => {
  const rows = await query<TagRow[]>(
    `SELECT
       t.id,
       t.name,
       t.slug,
       COALESCE(COUNT(pt.post_id), 0) AS postCount,
       t.created_at AS createdAt,
       t.updated_at AS updatedAt
     FROM tags t
     LEFT JOIN post_tags pt ON pt.tag_id = t.id
     GROUP BY t.id, t.name, t.slug, t.created_at, t.updated_at
     ORDER BY t.name ASC`,
  );

  return rows.map(mapTagRow);
};

export const listTagOptions = async (): Promise<TagOption[]> => {
  const rows = await query<Array<RowDataPacket & TagOption>>(
    `SELECT t.id, t.name, t.slug FROM tags t ORDER BY t.name ASC`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
  }));
};

export const getTagById = async (id: number): Promise<AdminTag | null> => {
  const rows = await query<TagRow[]>(
    `SELECT
       t.id,
       t.name,
       t.slug,
       COALESCE(COUNT(pt.post_id), 0) AS postCount,
       t.created_at AS createdAt,
       t.updated_at AS updatedAt
     FROM tags t
     LEFT JOIN post_tags pt ON pt.tag_id = t.id
     WHERE t.id = ?
     GROUP BY t.id, t.name, t.slug, t.created_at, t.updated_at
     LIMIT 1`,
    [id],
  );

  if (!rows.length) {
    return null;
  }

  return mapTagRow(rows[0]);
};

export const getTagsForPost = async (postId: number): Promise<TagOption[]> => {
  const rows = await query<Array<RowDataPacket & TagOption>>(
    `SELECT t.id, t.name, t.slug
     FROM tags t
     INNER JOIN post_tags pt ON pt.tag_id = t.id
     WHERE pt.post_id = ?
     ORDER BY t.name ASC`,
    [postId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
  }));
};

export const createTag = async ({ name, slug }: CreateTagInput): Promise<AdminTag> => {
  const result = await query<ResultSetHeader>(
    `INSERT INTO tags (name, slug) VALUES (?, ?)`,
    [name, slug],
  );

  const createdId = Number(result.insertId);

  const tag = await getTagById(createdId);

  if (!tag) {
    throw new Error("Failed to load tag after creation");
  }

  return tag;
};

export const updateTag = async (id: number, { name, slug }: UpdateTagInput): Promise<AdminTag> => {
  const result = await query<ResultSetHeader>(
    `UPDATE tags SET name = ?, slug = ?, updated_at = NOW() WHERE id = ?`,
    [name, slug, id],
  );

  if (!result.affectedRows) {
    throw new Error("Tag not found");
  }

  const tag = await getTagById(id);

  if (!tag) {
    throw new Error("Failed to load tag after update");
  }

  return tag;
};

export const deleteTag = async (id: number): Promise<boolean> => {
  return withTransaction(async (connection) => {
    await queryWithConnection(connection, `DELETE FROM post_tags WHERE tag_id = ?`, [id]);

    const result = await queryWithConnection<ResultSetHeader>(connection, `DELETE FROM tags WHERE id = ?`, [id]);

    return result.affectedRows > 0;
  });
};
