import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databaseEnv } from "@/lib/env";
import { getPool, query } from "@/lib/db";

interface RevisionColumnInfo {
  hasRevisionNumber: boolean;
  hasContentMd: boolean;
  hasTitle: boolean;
  hasSummary: boolean;
  hasCoverImageUrl: boolean;
  hasIsFeatured: boolean;
  hasAllowComments: boolean;
  hasStatus: boolean;
  hasSlug: boolean;
  hasAuthorId: boolean;
  hasEditorId: boolean;
  hasPublishedAt: boolean;
  diffSummaryColumn: string | null;
}

const DEFAULT_REVISION_COLUMN_INFO: RevisionColumnInfo = {
  hasRevisionNumber: false,
  hasContentMd: false,
  hasTitle: false,
  hasSummary: false,
  hasCoverImageUrl: false,
  hasIsFeatured: false,
  hasAllowComments: false,
  hasStatus: false,
  hasSlug: false,
  hasAuthorId: false,
  hasEditorId: false,
  hasPublishedAt: false,
  diffSummaryColumn: null,
};

let revisionColumnInfoCache: RevisionColumnInfo | null = null;
let revisionColumnInfoPromise: Promise<RevisionColumnInfo> | null = null;

const loadRevisionColumnInfo = async (): Promise<RevisionColumnInfo> => {
  try {
    const rows = await query<Array<RowDataPacket & { column_name: string | null }>>(
      `SELECT COLUMN_NAME AS column_name
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'post_revisions'`,
      [databaseEnv.database],
    );

    if (!rows.length) {
      console.warn("No metadata found for post_revisions table. Falling back to defaults.");
      return DEFAULT_REVISION_COLUMN_INFO;
    }

    const columnNames = new Set(
      rows
        .map((row) => row.column_name?.toLowerCase())
        .filter((value): value is string => Boolean(value)),
    );

    if (!columnNames.has("content_html")) {
      console.warn("post_revisions table is missing required content_html column.");
    }

    return {
      hasRevisionNumber: columnNames.has("revision_number"),
      hasContentMd: columnNames.has("content_md"),
      hasTitle: columnNames.has("title"),
      hasSummary: columnNames.has("summary"),
      hasCoverImageUrl: columnNames.has("cover_image_url"),
      hasIsFeatured: columnNames.has("is_featured"),
      hasAllowComments: columnNames.has("allow_comments"),
      hasStatus: columnNames.has("status"),
      hasSlug: columnNames.has("slug"),
      hasAuthorId: columnNames.has("author_id"),
      hasEditorId: columnNames.has("editor_id"),
      hasPublishedAt: columnNames.has("published_at"),
      diffSummaryColumn: columnNames.has("diff_summary")
        ? "diff_summary"
        : columnNames.has("change_summary")
          ? "change_summary"
          : null,
    } satisfies RevisionColumnInfo;
  } catch (error) {
    console.warn("Failed to load post_revisions schema metadata", { error });
    return DEFAULT_REVISION_COLUMN_INFO;
  }
};

const getRevisionColumnInfo = async (): Promise<RevisionColumnInfo> => {
  if (revisionColumnInfoCache) {
    return revisionColumnInfoCache;
  }

  if (!revisionColumnInfoPromise) {
    revisionColumnInfoPromise = loadRevisionColumnInfo()
      .then((info) => {
        revisionColumnInfoCache = info;
        return info;
      })
      .catch((error) => {
        console.warn("Failed to resolve revision column info", { error });
        revisionColumnInfoCache = DEFAULT_REVISION_COLUMN_INFO;
        return DEFAULT_REVISION_COLUMN_INFO;
      })
      .finally(() => {
        revisionColumnInfoPromise = null;
      });
  }

  return revisionColumnInfoPromise;
};

type PostRevisionRow = RowDataPacket & {
  id: number;
  post_id: number;
  editor_id: number | null;
  created_at: Date | string | null;
  revision_number?: number | string | null;
  content_html?: string | null;
  content_md?: string | null;
  title?: string | null;
  summary?: string | null;
  cover_image_url?: string | null;
  is_featured?: number | null;
  allow_comments?: number | null;
  status?: string | null;
  slug?: string | null;
  author_id?: number | null;
  published_at?: Date | string | null;
  diff_summary?: string | null;
  editor_username?: string | null;
  editor_email?: string | null;
};

type NumericLike = number | string | bigint | null | undefined;

const parseNumeric = (value: NumericLike): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toIsoString = (value: Date | string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return value.toISOString();
  }

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  } catch (error) {
    console.warn("Failed to convert value to ISO string", { value, error });
    return null;
  }
};

const normalizeText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length ? trimmed : null;
};

const boolToTinyInt = (value: boolean | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return value ? 1 : 0;
};

interface RevisionSelectOptions {
  includeContent: boolean;
  includeEditor: boolean;
}

const buildRevisionSelectColumns = (
  capabilities: RevisionColumnInfo,
  options: RevisionSelectOptions,
): string => {
  const columns: string[] = [
    "r.id AS id",
    "r.post_id AS post_id",
    "r.editor_id AS editor_id",
    "r.created_at AS created_at",
  ];

  if (capabilities.hasRevisionNumber) {
    columns.push("r.revision_number AS revision_number");
  }

  if (options.includeContent) {
    columns.push("r.content_html AS content_html");

    if (capabilities.hasContentMd) {
      columns.push("r.content_md AS content_md");
    }

    if (capabilities.hasTitle) {
      columns.push("r.title AS title");
    }

    if (capabilities.hasSummary) {
      columns.push("r.summary AS summary");
    }

    if (capabilities.hasCoverImageUrl) {
      columns.push("r.cover_image_url AS cover_image_url");
    }

    if (capabilities.hasIsFeatured) {
      columns.push("r.is_featured AS is_featured");
    }

    if (capabilities.hasAllowComments) {
      columns.push("r.allow_comments AS allow_comments");
    }

    if (capabilities.hasStatus) {
      columns.push("r.status AS status");
    }

    if (capabilities.hasSlug) {
      columns.push("r.slug AS slug");
    }

    if (capabilities.hasAuthorId) {
      columns.push("r.author_id AS author_id");
    }

    if (capabilities.hasPublishedAt) {
      columns.push("r.published_at AS published_at");
    }
  }

  if (capabilities.diffSummaryColumn) {
    columns.push(`r.${capabilities.diffSummaryColumn} AS diff_summary`);
  }

  if (options.includeEditor) {
    columns.push("u.username AS editor_username");
    columns.push("u.email AS editor_email");
  }

  return columns.join(", ");
};

const createSnapshotFromRow = (
  row: PostRevisionRow,
  capabilities: RevisionColumnInfo,
): PostRevisionSnapshot => {
  const snapshot: PostRevisionSnapshot = {
    postId: Number(row.post_id),
    contentHtml: typeof row.content_html === "string" ? row.content_html : row.content_html ?? "",
  };

  if (capabilities.hasContentMd) {
    snapshot.contentMd = typeof row.content_md === "string" ? row.content_md : row.content_md ?? null;
  }

  if (capabilities.hasTitle) {
    snapshot.title = row.title ?? null;
  }

  if (capabilities.hasSummary) {
    snapshot.summary = row.summary ?? null;
  }

  if (capabilities.hasCoverImageUrl) {
    snapshot.coverImageUrl = row.cover_image_url ?? null;
  }

  if (capabilities.hasIsFeatured) {
    snapshot.isFeatured = row.is_featured === null ? null : Boolean(row.is_featured);
  }

  if (capabilities.hasAllowComments) {
    snapshot.allowComments = row.allow_comments === null ? null : Boolean(row.allow_comments);
  }

  if (capabilities.hasStatus) {
    snapshot.status = row.status ?? null;
  }

  if (capabilities.hasSlug) {
    snapshot.slug = row.slug ?? null;
  }

  if (capabilities.hasAuthorId) {
    snapshot.authorId = typeof row.author_id === "number" ? row.author_id : null;
  }

  if (capabilities.hasPublishedAt) {
    snapshot.publishedAt = row.published_at ?? null;
  }

  return snapshot;
};

const computeRevisionPosition = async (
  postId: number,
  row: PostRevisionRow,
): Promise<number> => {
  if (row.revision_number !== undefined && row.revision_number !== null) {
    const numeric = parseNumeric(row.revision_number);

    if (numeric && numeric > 0) {
      return numeric;
    }
  }

  if (row.created_at) {
    const rows = await query<Array<RowDataPacket & { position: NumericLike }>>(
      `SELECT COUNT(*) AS position
       FROM post_revisions
       WHERE post_id = ?
         AND (created_at < ? OR (created_at = ? AND id <= ?))`,
      [postId, row.created_at, row.created_at, row.id],
    );

    const position = parseNumeric(rows[0]?.position ?? null);

    if (position && position > 0) {
      return position;
    }
  }

  const fallbackRows = await query<Array<RowDataPacket & { position: NumericLike }>>(
    `SELECT COUNT(*) AS position
     FROM post_revisions
     WHERE post_id = ?
       AND id <= ?`,
    [postId, row.id],
  );

  const fallback = parseNumeric(fallbackRows[0]?.position ?? null);

  return fallback && fallback > 0 ? fallback : 1;
};

const applySnapshotToPost = async (
  connection: PoolConnection,
  postId: number,
  snapshot: PostRevisionSnapshot,
): Promise<void> => {
  const assignments: string[] = ["content_html = ?"];
  const values: Array<string | number | null> = [snapshot.contentHtml];

  if ("contentMd" in snapshot) {
    assignments.push("content_md = ?");
    values.push(snapshot.contentMd ?? null);
  }

  if ("title" in snapshot) {
    assignments.push("title = ?");
    values.push(snapshot.title ?? "");
  }

  if ("summary" in snapshot) {
    assignments.push("summary = ?");
    values.push(normalizeText(snapshot.summary ?? null));
  }

  if ("coverImageUrl" in snapshot) {
    assignments.push("cover_image_url = ?");
    values.push(normalizeText(snapshot.coverImageUrl ?? null));
  }

  if ("isFeatured" in snapshot) {
    assignments.push("is_featured = ?");
    values.push(boolToTinyInt(snapshot.isFeatured ?? null));
  }

  if ("allowComments" in snapshot) {
    assignments.push("allow_comments = ?");
    values.push(boolToTinyInt(snapshot.allowComments ?? null));
  }

  assignments.push("updated_at = NOW()");

  const sql = `UPDATE posts SET ${assignments.join(", ")} WHERE id = ?`;
  values.push(postId);

  await connection.query<ResultSetHeader>(sql, values);
};

const getNextRevisionNumber = async (
  connection: PoolConnection,
  postId: number,
): Promise<number> => {
  const [rows] = await connection.query<Array<RowDataPacket & { revision_number: NumericLike }>>(
    `SELECT revision_number
     FROM post_revisions
     WHERE post_id = ?
     ORDER BY revision_number DESC
     LIMIT 1
     FOR UPDATE`,
    [postId],
  );

  const latest = parseNumeric(rows[0]?.revision_number ?? null);

  if (latest && latest > 0) {
    return latest + 1;
  }

  const [countRows] = await connection.query<Array<RowDataPacket & { count: NumericLike }>>(
    `SELECT COUNT(*) AS count FROM post_revisions WHERE post_id = ? FOR UPDATE`,
    [postId],
  );

  const count = parseNumeric(countRows[0]?.count ?? null) ?? 0;

  return count + 1;
};

export interface PostRevisionSnapshot {
  postId: number;
  title?: string | null;
  summary?: string | null;
  contentHtml: string;
  contentMd?: string | null;
  coverImageUrl?: string | null;
  isFeatured?: boolean | null;
  allowComments?: boolean | null;
  status?: string | null;
  slug?: string | null;
  authorId?: number | null;
  publishedAt?: Date | string | null;
  editorId?: number | null;
}

interface SavePostRevisionOptions {
  capabilities?: RevisionColumnInfo;
}

export const savePostRevisionSnapshot = async (
  connection: PoolConnection,
  snapshot: PostRevisionSnapshot,
  options: SavePostRevisionOptions = {},
): Promise<number> => {
  const capabilities = options.capabilities ?? (await getRevisionColumnInfo());

  const columns: string[] = ["post_id", "content_html"];
  const placeholders: string[] = ["?", "?"];
  const values: Array<string | number | null> = [snapshot.postId, snapshot.contentHtml];

  if (capabilities.hasRevisionNumber) {
    const nextRevision = await getNextRevisionNumber(connection, snapshot.postId);
    columns.push("revision_number");
    placeholders.push("?");
    values.push(nextRevision);
  }

  if (capabilities.hasContentMd) {
    columns.push("content_md");
    placeholders.push("?");
    values.push(snapshot.contentMd ?? null);
  }

  if (capabilities.hasTitle) {
    columns.push("title");
    placeholders.push("?");
    values.push(snapshot.title ?? "");
  }

  if (capabilities.hasSummary) {
    columns.push("summary");
    placeholders.push("?");
    values.push(normalizeText(snapshot.summary ?? null));
  }

  if (capabilities.hasCoverImageUrl) {
    columns.push("cover_image_url");
    placeholders.push("?");
    values.push(normalizeText(snapshot.coverImageUrl ?? null));
  }

  if (capabilities.hasIsFeatured) {
    columns.push("is_featured");
    placeholders.push("?");
    values.push(boolToTinyInt(snapshot.isFeatured ?? null));
  }

  if (capabilities.hasAllowComments) {
    columns.push("allow_comments");
    placeholders.push("?");
    values.push(boolToTinyInt(snapshot.allowComments ?? null));
  }

  if (capabilities.hasStatus) {
    columns.push("status");
    placeholders.push("?");
    values.push(snapshot.status ?? null);
  }

  if (capabilities.hasSlug) {
    columns.push("slug");
    placeholders.push("?");
    values.push(snapshot.slug ?? null);
  }

  if (capabilities.hasAuthorId) {
    columns.push("author_id");
    placeholders.push("?");
    values.push(snapshot.authorId ?? null);
  }

  if (capabilities.hasPublishedAt) {
    columns.push("published_at");
    placeholders.push("?");
    values.push(snapshot.publishedAt instanceof Date ? snapshot.publishedAt.toISOString() : snapshot.publishedAt ?? null);
  }

  if (capabilities.hasEditorId) {
    columns.push("editor_id");
    placeholders.push("?");
    values.push(snapshot.editorId ?? null);
  }

  const sql = `INSERT INTO post_revisions (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`;
  const [result] = await connection.query<ResultSetHeader>(sql, values);

  return result.insertId;
};

export interface PostRevisionEditor {
  id: number | null;
  name: string | null;
  email: string | null;
}

export interface PostRevisionSummary {
  id: number;
  postId: number;
  revisionNumber: number;
  createdAt: string | null;
  diffSummary: string | null;
  isLatest: boolean;
  editor: PostRevisionEditor;
}

export interface PostRevisionDetail extends PostRevisionSummary {
  contentHtml: string;
  contentMd: string | null;
  title?: string | null;
  summary?: string | null;
  coverImageUrl?: string | null;
  isFeatured?: boolean | null;
  allowComments?: boolean | null;
  status?: string | null;
  slug?: string | null;
  totalCount: number;
}

export const getPostRevisionCount = async (postId: number): Promise<number> => {
  const rows = await query<Array<RowDataPacket & { count: NumericLike }>>(
    `SELECT COUNT(*) AS count FROM post_revisions WHERE post_id = ?`,
    [postId],
  );

  const count = parseNumeric(rows[0]?.count ?? null);

  return count && count > 0 ? count : 0;
};

export const getPostRevisions = async (postId: number): Promise<PostRevisionSummary[]> => {
  const capabilities = await getRevisionColumnInfo();
  const selectColumns = buildRevisionSelectColumns(capabilities, {
    includeContent: false,
    includeEditor: true,
  });

  const rows = await query<PostRevisionRow[]>(
    `SELECT ${selectColumns}
     FROM post_revisions r
     LEFT JOIN users u ON u.id = r.editor_id
     WHERE r.post_id = ?
     ORDER BY r.created_at DESC, r.id DESC`,
    [postId],
  );

  if (!rows.length) {
    return [];
  }

  const total = rows.length;

  return rows.map((row, index) => {
    const fallbackNumber = total - index;
    const revisionNumber = parseNumeric(row.revision_number ?? null) ?? fallbackNumber;

    return {
      id: row.id,
      postId: row.post_id,
      revisionNumber,
      createdAt: toIsoString(row.created_at),
      diffSummary: normalizeText(row.diff_summary ?? null),
      isLatest: index === 0,
      editor: {
        id: typeof row.editor_id === "number" ? row.editor_id : null,
        name: row.editor_username ?? null,
        email: row.editor_email ?? null,
      },
    } satisfies PostRevisionSummary;
  });
};

export const getPostRevisionById = async (
  postId: number,
  revisionId: number,
): Promise<PostRevisionDetail | null> => {
  const capabilities = await getRevisionColumnInfo();
  const selectColumns = buildRevisionSelectColumns(capabilities, {
    includeContent: true,
    includeEditor: true,
  });

  const rows = await query<PostRevisionRow[]>(
    `SELECT ${selectColumns}
     FROM post_revisions r
     LEFT JOIN users u ON u.id = r.editor_id
     WHERE r.post_id = ? AND r.id = ?
     LIMIT 1`,
    [postId, revisionId],
  );

  if (!rows.length) {
    return null;
  }

  const row = rows[0];
  const totalCountPromise = getPostRevisionCount(postId);
  const revisionNumber = await computeRevisionPosition(postId, row);
  const totalCount = await totalCountPromise;

  const contentHtml = typeof row.content_html === "string" ? row.content_html : row.content_html ?? "";
  const contentMd = capabilities.hasContentMd
    ? typeof row.content_md === "string"
      ? row.content_md
      : row.content_md ?? null
    : null;

  const detail: PostRevisionDetail = {
    id: row.id,
    postId: row.post_id,
    revisionNumber,
    createdAt: toIsoString(row.created_at),
    diffSummary: normalizeText(row.diff_summary ?? null),
    isLatest: revisionNumber === totalCount,
    editor: {
      id: typeof row.editor_id === "number" ? row.editor_id : null,
      name: row.editor_username ?? null,
      email: row.editor_email ?? null,
    },
    contentHtml,
    contentMd,
    totalCount,
  };

  if (capabilities.hasTitle) {
    detail.title = row.title ?? null;
  }

  if (capabilities.hasSummary) {
    detail.summary = row.summary ?? null;
  }

  if (capabilities.hasCoverImageUrl) {
    detail.coverImageUrl = row.cover_image_url ?? null;
  }

  if (capabilities.hasIsFeatured) {
    detail.isFeatured = row.is_featured === null ? null : Boolean(row.is_featured);
  }

  if (capabilities.hasAllowComments) {
    detail.allowComments = row.allow_comments === null ? null : Boolean(row.allow_comments);
  }

  if (capabilities.hasStatus) {
    detail.status = row.status ?? null;
  }

  if (capabilities.hasSlug) {
    detail.slug = row.slug ?? null;
  }

  return detail;
};

export const restorePostRevision = async (
  postId: number,
  revisionId: number,
  editorId: number | null,
): Promise<boolean> => {
  const capabilities = await getRevisionColumnInfo();
  const selectColumns = buildRevisionSelectColumns(capabilities, {
    includeContent: true,
    includeEditor: false,
  });

  const pool = getPool();
  let connection: PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query<PostRevisionRow[]>(
      `SELECT ${selectColumns}
       FROM post_revisions r
       WHERE r.post_id = ? AND r.id = ?
       FOR UPDATE`,
      [postId, revisionId],
    );

    if (!rows.length) {
      await connection.rollback();
      return false;
    }

    const row = rows[0];
    const snapshot = createSnapshotFromRow(row, capabilities);
    snapshot.editorId = editorId ?? null;

    await applySnapshotToPost(connection, postId, snapshot);
    await savePostRevisionSnapshot(connection, { ...snapshot, postId }, { capabilities });

    await connection.commit();

    return true;
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Failed to rollback restorePostRevision transaction", {
          error: rollbackError,
        });
      }
    }

    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
