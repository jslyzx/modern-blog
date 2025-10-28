import { NextResponse } from "next/server";

import { apiErrors } from "@/lib/api/errors";
import { auth } from "@/auth";
import { restorePostRevision } from "@/lib/admin/post-revisions";

type RouteContext = {
  params: {
    id?: string | string[];
    revisionId?: string | string[];
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

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const postId = parseId(context.params.id);
  const revisionId = parseId(context.params.revisionId);

  if (!postId || !revisionId) {
    return apiErrors.badRequest("参数无效", "INVALID_IDENTIFIER");
  }

  const editorId = typeof session.user.id === "string" ? Number.parseInt(session.user.id, 10) : null;

  try {
    const restored = await restorePostRevision(postId, revisionId, editorId);

    if (!restored) {
      return apiErrors.notFound("未找到历史版本", "REVISION_NOT_FOUND");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to restore post revision", { postId, revisionId, error });
    return apiErrors.internal("恢复历史版本失败", "RESTORE_REVISION_FAILED");
  }
}
