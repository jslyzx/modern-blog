import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createPost, type PostStatus } from "@/lib/admin/posts";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const data = payload as any;

  if (!data.title || typeof data.title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const slug = data.slug || data.title.toLowerCase().replace(/\s+/g, "-");

  try {
    const postId = await createPost({
      title: data.title,
      slug,
      excerpt: data.excerpt || "",
      content: data.content || "",
      coverImageUrl: data.coverImageUrl || "",
      status: (data.status || "draft") as PostStatus,
      featured: Boolean(data.featured),
      allowComments: Boolean(data.allowComments ?? true),
      authorId: parseInt(session.user.id, 10),
      tags: Array.isArray(data.tags) ? data.tags : [],
    });

    return NextResponse.json({ success: true, id: postId });
  } catch (error) {
    console.error("Failed to create post", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
