import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getPostById } from "@/lib/admin/posts";
import { createPreviewToken, PREVIEW_TOKEN_TTL_MS } from "@/lib/preview-token";
import { createAbsoluteUrlFromConfig, getSiteConfig } from "@/lib/site";

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

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const postId = parseId(context.params.id);

  if (!postId) {
    return NextResponse.json({ error: "文章 ID 无效" }, { status: 400 });
  }

  try {
    const post = await getPostById(postId);

    if (!post) {
      return NextResponse.json({ error: "未找到文章" }, { status: 404 });
    }

    if (post.status === "archived") {
      return NextResponse.json({ error: "已归档文章无法生成预览链接" }, { status: 400 });
    }

    const { token, payload } = createPreviewToken(postId);
    const siteConfig = await getSiteConfig();
    const previewPath = `/preview/${encodeURIComponent(token)}`;
    const previewUrl = createAbsoluteUrlFromConfig(siteConfig, previewPath);
    const expiresAtIso = new Date(payload.exp).toISOString();
    const expiresInMs = Math.max(0, payload.exp - Date.now());

    const response = NextResponse.json({
      token,
      previewUrl,
      expiresAt: expiresAtIso,
      expiresInMs,
      ttlMs: PREVIEW_TOKEN_TTL_MS,
    });
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    console.error("Failed to generate preview token", {
      postId,
      error,
    });

    return NextResponse.json({ error: "生成预览链接失败" }, { status: 500 });
  }
}
