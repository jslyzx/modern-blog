import { NextResponse } from "next/server";

import { apiErrors } from "@/lib/api/errors";
import { auth } from "@/auth";
import { createPost, ensureUniquePostSlug, type PostStatus } from "@/lib/admin/posts";
import { generateSlug } from "@/lib/slug";

const unauthorized = () => apiErrors.unauthorized();

const parseTagIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueIds = new Set<number>();

  for (const element of value) {
    let candidate: number | null = null;

    if (typeof element === "number") {
      candidate = element;
    } else if (typeof element === "string") {
      const parsed = Number.parseInt(element, 10);

      if (Number.isFinite(parsed)) {
        candidate = parsed;
      }
    }

    if (candidate === null || !Number.isFinite(candidate)) {
      continue;
    }

    const normalized = Math.trunc(candidate);

    if (normalized > 0) {
      uniqueIds.add(normalized);
    }
  }

  return Array.from(uniqueIds);
};

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return unauthorized();
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.warn("Failed to parse POST body", error);
    return apiErrors.badRequest("请求载荷无效", "INVALID_PAYLOAD");
  }

  interface PostCreateData {
    title: string;
    slug?: string;
    content?: string;
    contentHtml?: string;
    contentMd?: string;
    contentMarkdown?: string;
    excerpt?: string;
    summary?: string;
    status?: string;
    tags?: number[];
    tagIds?: number[];
    featuredImageId?: number | null;
    isFeatured?: boolean;
    featured?: boolean | number | string;
    allowComments?: boolean;
    coverImageUrl?: string;
  }

  const data = payload as PostCreateData;

  if (!data.title || typeof data.title !== "string") {
    return apiErrors.badRequest("标题不能为空", "VALIDATION_ERROR");
  }

  try {
    const requestedSlug = typeof data.slug === "string" ? data.slug : "";
    const slugCandidate = requestedSlug.trim() ? generateSlug(requestedSlug) : generateSlug(data.title);
    const slug = await ensureUniquePostSlug(slugCandidate);

    const contentHtml = typeof data.contentHtml === "string" ? data.contentHtml : typeof data.content === "string" ? data.content : "";
    const contentMd =
      typeof data.contentMd === "string"
        ? data.contentMd
        : typeof data.contentMarkdown === "string"
          ? data.contentMarkdown
          : null;
    const isFeatured = typeof data.isFeatured === "boolean" ? data.isFeatured : Boolean(data.featured);
    const allowComments = Boolean(data.allowComments ?? true);
    const tagIds = parseTagIds(data.tagIds ?? data.tags);
    const authorId = Number.parseInt(session.user.id, 10);

    const postId = await createPost({
      title: data.title,
      slug,
      summary: typeof data.summary === "string" ? data.summary : "",
      contentHtml,
      contentMd,
      coverImageUrl: typeof data.coverImageUrl === "string" ? data.coverImageUrl : "",
      status: (data.status || "draft") as PostStatus,
      isFeatured,
      allowComments,
      authorId,
      tagIds,
    });

    return NextResponse.json({ success: true, id: postId });
  } catch (error) {
    console.error("Failed to create post", error);
    return apiErrors.internal("创建文章失败", "CREATE_POST_FAILED");
  }
}
