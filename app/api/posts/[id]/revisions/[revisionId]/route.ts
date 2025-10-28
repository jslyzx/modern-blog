import { NextResponse } from "next/server";

import { apiErrors } from "@/lib/api/errors";
import { auth } from "@/auth";
import { getPostRevisionById } from "@/lib/admin/post-revisions";

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

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const postId = parseId(context.params.id);
  const revisionId = parseId(context.params.revisionId);

  if (!postId || !revisionId) {
    return apiErrors.badRequest("参数无效", "INVALID_IDENTIFIER");
  }

  try {
    const revision = await getPostRevisionById(postId, revisionId);

    if (!revision) {
      return apiErrors.notFound("未找到历史版本", "REVISION_NOT_FOUND");
    }

    return NextResponse.json({ revision });
  } catch (error) {
    console.error("Failed to load post revision detail", { postId, revisionId, error });
    return apiErrors.internal("加载历史版本失败", "GET_REVISION_FAILED");
  }
}
