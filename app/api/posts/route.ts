import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createPost, ensureUniquePostSlug, type PostStatus } from "@/lib/admin/posts";
import { generateSlug } from "@/lib/slug";

const unauthorized = () => NextResponse.json({ error: "未授权" }, { status: 401 });

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
    return NextResponse.json({ error: "请求载荷无效" }, { status: 400 });
  }

  const data = payload as any;

  if (!data.title || typeof data.title !== "string") {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  }

  try {
    const requestedSlug = typeof data.slug === "string" ? data.slug : "";
    const slugCandidate = requestedSlug.trim() ? generateSlug(requestedSlug) : generateSlug(data.title);
    const slug = await ensureUniquePostSlug(slugCandidate);

    const contentHtml = typeof data.contentHtml === "string" ? data.contentHtml : typeof data.content === "string" ? data.content : "";
    const isFeatured = typeof data.isFeatured === "boolean" ? data.isFeatured : Boolean(data.featured);
    const allowComments = Boolean(data.allowComments ?? true);

    const postId = await createPost({
      title: data.title,
      slug,
      summary: typeof data.summary === "string" ? data.summary : "",
      contentHtml,
      coverImageUrl: typeof data.coverImageUrl === "string" ? data.coverImageUrl : "",
      status: (data.status || "draft") as PostStatus,
      isFeatured,
      allowComments,
      authorId: parseInt(session.user.id, 10),
      tags: Array.isArray(data.tags) ? data.tags : [],
    });

    return NextResponse.json({ success: true, id: postId });
  } catch (error) {
    console.error("Failed to create post", error);
    return NextResponse.json({ error: "创建文章失败" }, { status: 500 });
  }
}
