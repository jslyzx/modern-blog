import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  countPosts,
  createPost,
  listPosts,
  type PostStatus,
} from "@/lib/admin/posts";

const statusSchema = z.enum(["draft", "published", "archived", "all"]) as z.ZodType<PostStatus | "all">;

const querySchema = z.object({
  q: z.string().optional(),
  status: statusSchema.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
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
});

const normalizeOptional = (value?: string | null) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length ? trimmed : null;
};

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));

  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { q, status, page = 1, limit = 20 } = parsedQuery.data ?? {};
  const offset = (page - 1) * limit;

  const search = q?.trim() ? q.trim() : undefined;
  const statusFilter = status ?? undefined;

  const posts = await listPosts({ search, status: statusFilter, limit, offset });
  const total = await countPosts({ search, status: statusFilter });

  return NextResponse.json({
    data: posts,
    meta: {
      total,
      page,
      limit,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  try {
    const post = await createPost({
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
    });

    return NextResponse.json({ data: post }, { status: 201 });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;

    if (code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Slug must be unique" }, { status: 409 });
    }

    console.error("Failed to create post", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
