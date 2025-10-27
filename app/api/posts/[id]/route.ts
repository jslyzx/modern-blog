import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  deletePostById,
  ensureUniquePostSlug,
  isPostStatus,
  type PostStatus,
  updatePost,
  updatePostStatus,
} from "@/lib/admin/posts";
import { generateSlug } from "@/lib/slug";

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

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const postId = parseId(context.params.id);

  if (!postId) {
    return NextResponse.json({ error: "文章 ID 无效" }, { status: 400 });
  }

  try {
    const deleted = await deletePostById(postId);

    if (!deleted) {
      return NextResponse.json({ error: "未找到文章" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete post", { postId, error });
    return NextResponse.json({ error: "删除文章失败。" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const postId = parseId(context.params.id);

  if (!postId) {
    return NextResponse.json({ error: "文章 ID 无效" }, { status: 400 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.warn("Failed to parse PATCH body", error);
    return NextResponse.json({ error: "请求载荷无效" }, { status: 400 });
  }

  const requestedStatus = (payload as { status?: unknown })?.status;

  if (typeof requestedStatus !== "string" || !isPostStatus(requestedStatus)) {
    return NextResponse.json({ error: "状态无效" }, { status: 400 });
  }

  const status = requestedStatus as PostStatus;

  try {
    const updated = await updatePostStatus(postId, status);

    if (!updated) {
      return NextResponse.json({ error: "未找到文章" }, { status: 404 });
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("Failed to update post status", { postId, status, error });
    return NextResponse.json({ error: "更新文章状态失败。" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const postId = parseId(context.params.id);

  if (!postId) {
    return NextResponse.json({ error: "文章 ID 无效" }, { status: 400 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.warn("Failed to parse PUT body", error);
    return NextResponse.json({ error: "请求载荷无效" }, { status: 400 });
  }

  const data = payload as any;

  if (!data.title || typeof data.title !== "string") {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  }

  try {
    const requestedSlug = typeof data.slug === "string" ? data.slug : "";
    const slugCandidate = requestedSlug.trim() ? generateSlug(requestedSlug) : generateSlug(data.title);
    const slug = await ensureUniquePostSlug(slugCandidate, { excludeId: postId });

    const contentHtml = typeof data.contentHtml === "string" ? data.contentHtml : typeof data.content === "string" ? data.content : "";
    const isFeatured = typeof data.isFeatured === "boolean" ? data.isFeatured : Boolean(data.featured);
    const allowComments = Boolean(data.allowComments ?? true);

    const updated = await updatePost(postId, {
      title: data.title,
      slug,
      summary: typeof data.summary === "string" ? data.summary : "",
      contentHtml,
      coverImageUrl: typeof data.coverImageUrl === "string" ? data.coverImageUrl : "",
      status: (data.status || "draft") as PostStatus,
      isFeatured,
      allowComments,
      tags: Array.isArray(data.tags) ? data.tags : [],
    });

    if (!updated) {
      return NextResponse.json({ error: "未找到文章" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update post", { postId, error });
    return NextResponse.json({ error: "更新文章失败" }, { status: 500 });
  }
}
