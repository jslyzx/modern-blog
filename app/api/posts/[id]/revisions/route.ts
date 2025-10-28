import { NextResponse } from "next/server";

import { apiErrors } from "@/lib/api/errors";
import { auth } from "@/auth";
import { getPostRevisions } from "@/lib/admin/post-revisions";

type RouteContext = {
  params: {
    id?: string | string[];
  };
};

const parseId = (value: string | string[] | undefined): number | null => {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const unauthorized = () => apiErrors.unauthorized();

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const postId = parseId(context.params.id);

  if (!postId) {
    return apiErrors.badRequest("文章 ID 无效", "INVALID_IDENTIFIER");
  }

  try {
    const revisions = await getPostRevisions(postId);

    return NextResponse.json({ revisions, count: revisions.length });
  } catch (error) {
    console.error("Failed to load post revisions", { postId, error });
    return apiErrors.internal("加载文章历史版本失败", "GET_POST_REVISIONS_FAILED");
  }
}
