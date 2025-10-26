import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  deletePost,
  getPostById,
  updatePost,
} from "@/lib/admin/posts";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const payloadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  allowComments: z.boolean().optional().default(true),
  featured: z.boolean().optional().default(false),
  tagIds: z.array(z.coerce.number().int().positive()).optional().default([]),
  publishedAt: z.string().datetime().optional().nullable(),
});

const normalizeOptional = (value?: string | null) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length ? trimmed : null;
};

type RouteContext = {
  params: {
    id: string;
  };
};

const resolveId = (context: RouteContext): number | null => {
  const parsed = paramsSchema.safeParse(context.params);

  if (!parsed.success) {
    return null;
  }

  return parsed.data.id;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = resolveId(context);

  if (!id) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  const post = await getPostById(id);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({ data: post });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = resolveId(context);

  if (!id) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  const json = await request.json();
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const userIdRaw = session.user.id;
  const authorId = typeof userIdRaw === "string" ? Number.parseInt(userIdRaw, 10) : null;
  const payload = parsed.data;

  const tagIds = Array.from(new Set(payload.tagIds ?? [])).filter((tagId) => Number.isInteger(tagId) && tagId > 0);
  const publishedAt = payload.publishedAt ? new Date(payload.publishedAt) : null;

  if (publishedAt && Number.isNaN(publishedAt.getTime())) {
    return NextResponse.json({ error: "Invalid publishedAt value" }, { status: 400 });
  }

  try {
    const post = await updatePost(id, {
      title: payload.title.trim(),
      slug: payload.slug.trim(),
      content: payload.content,
      excerpt: normalizeOptional(payload.excerpt),
      coverImageUrl: normalizeOptional(payload.coverImageUrl),
      status: payload.status,
      allowComments: payload.allowComments ?? true,
      featured: payload.featured ?? false,
      tagIds,
      authorId: Number.isFinite(authorId) ? authorId : null,
      publishedAt,
    });

    return NextResponse.json({ data: post });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;

    if (code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Slug must be unique" }, { status: 409 });
    }

    console.error("Failed to update post", error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = resolveId(context);

  if (!id) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  try {
    const deleted = await deletePost(id);

    if (!deleted) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete post", error);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
