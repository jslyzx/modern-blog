import { NextResponse } from "next/server";

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

const unauthorized = () => NextResponse.json({ error: "未授权" }, { status: 401 });

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const postId = parseId(context.params.id);
  const revisionId = parseId(context.params.revisionId);

  if (!postId || !revisionId) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  const editorId = typeof session.user.id === "string" ? Number.parseInt(session.user.id, 10) : null;

  try {
    const restored = await restorePostRevision(postId, revisionId, editorId);

    if (!restored) {
      return NextResponse.json({ error: "未找到历史版本" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to restore post revision", { postId, revisionId, error });
    return NextResponse.json({ error: "恢复历史版本失败" }, { status: 500 });
  }
}
