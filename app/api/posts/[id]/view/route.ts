import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { query } from "@/lib/db";

type RouteContext = {
  params: {
    id?: string | string[];
  };
};

const parseId = (value: string | string[] | undefined): number | null => {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const toViewCount = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 0 ? 0 : Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? (parsed < 0 ? 0 : Math.trunc(parsed)) : 0;
  }

  if (typeof value === "bigint") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? (numeric < 0 ? 0 : Math.trunc(numeric)) : 0;
  }

  return 0;
};

export async function POST(_request: Request, context: RouteContext) {
  const postId = parseId(context.params.id);

  if (!postId) {
    return NextResponse.json({ error: "文章 ID 无效" }, { status: 400 });
  }

  try {
    const result = await query<ResultSetHeader>(
      `UPDATE posts
       SET view_count = COALESCE(view_count, 0) + 1,
           updated_at = updated_at
       WHERE id = ?
         AND status = 'published'
         AND (published_at IS NULL OR published_at <= NOW())`,
      [postId],
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: "未找到文章" }, { status: 404 });
    }

    const rows = await query<Array<RowDataPacket & { viewCount: number | string | bigint | null }>>(
      "SELECT view_count AS viewCount FROM posts WHERE id = ? LIMIT 1",
      [postId],
    );

    const rawCount = rows[0]?.viewCount ?? 0;
    const viewCount = toViewCount(rawCount);

    return NextResponse.json({ success: true, viewCount });
  } catch (error) {
    console.error("Failed to increment post view count", {
      postId,
      error,
    });

    return NextResponse.json({ error: "记录文章浏览量失败" }, { status: 500 });
  }
}
