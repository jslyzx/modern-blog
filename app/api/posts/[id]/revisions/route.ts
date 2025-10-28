import { NextResponse } from "next/server";

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

const unauthorized = () => NextResponse.json({ error: "未授权" }, { status: 401 });

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const postId = parseId(context.params.id);

  if (!postId) {
    return NextResponse.json({ error: "文章 ID 无效" }, { status: 400 });
  }

  try {
    const revisions = await getPostRevisions(postId);

    return NextResponse.json({ revisions, count: revisions.length });
  } catch (error) {
    console.error("Failed to load post revisions", { postId, error });
    return NextResponse.json({ error: "加载文章历史版本失败" }, { status: 500 });
  }
}
