import { NextResponse } from "next/server";

import { apiErrors } from "@/lib/api/errors";
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

const unauthorized = () => apiErrors.unauthorized();

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const postId = parseId(context.params.id);

  if (!postId) {
    return apiErrors.badRequest("文章 ID 无效", "INVALID_IDENTIFIER");
  }

  try {
    const post = await getPostById(postId);

    if (!post) {
      return apiErrors.notFound("未找到文章", "POST_NOT_FOUND");
    }

    if (post.status === "archived") {
      return apiErrors.badRequest("已归档文章无法生成预览链接", "POST_ARCHIVED");
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

    return apiErrors.internal("生成预览链接失败", "PREVIEW_TOKEN_FAILED");
  }
}
