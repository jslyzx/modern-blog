import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createPost, isPostSlugTaken, listPosts, type ListPostsOptions } from "@/lib/posts";
import { slugify } from "@/lib/slug";
import { findMissingTagIds } from "@/lib/tags";

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  excerpt: z.string().max(600).optional().nullable(),
  content: z.string().optional().nullable(),
  status: z.enum(["draft", "published"]),
  publishedAt: z.string().optional().nullable(),
  tagIds: z.array(z.number().int().positive()).optional(),
});

const normalizeIds = (ids?: number[]): number[] =>
  Array.from(new Set((ids ?? []).filter((value) => Number.isInteger(value) && value > 0)));

const parseDateToIso = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date");
  }

  return parsed.toISOString();
};

const parseQueryNumber = (value: string | null): number | undefined => {
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
};

const buildValidationErrorResponse = (error: z.ZodError) =>
  NextResponse.json(
    {
      error: "Invalid post payload",
      details: error.flatten(),
    },
    { status: 400 },
  );

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const statusParam = searchParams.get("status");
  const tagIdParam = searchParams.get("tagId");
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");

  const options: ListPostsOptions = {};

  if (statusParam === "draft" || statusParam === "published") {
    options.status = statusParam;
  } else if (statusParam) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  const tagId = parseQueryNumber(tagIdParam);

  if (tagIdParam && !tagId) {
    return NextResponse.json({ error: "Invalid tag filter" }, { status: 400 });
  }

  if (tagId) {
    options.tagId = tagId;
  }

  const page = parseQueryNumber(pageParam);

  if (pageParam && !page) {
    return NextResponse.json({ error: "Invalid page value" }, { status: 400 });
  }

  if (page) {
    options.page = page;
  }

  const pageSize = parseQueryNumber(pageSizeParam);

  if (pageSizeParam && !pageSize) {
    return NextResponse.json({ error: "Invalid page size" }, { status: 400 });
  }

  if (pageSize) {
    options.pageSize = pageSize;
  }

  try {
    const result = await listPosts(options);

    return NextResponse.json({
      posts: result.posts,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
    });
  } catch (error) {
    console.error("Failed to list posts", error);
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("Failed to parse post creation payload", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = createPostSchema.safeParse(payload);

  if (!validation.success) {
    return buildValidationErrorResponse(validation.error);
  }

  const title = validation.data.title.trim();

  if (!title) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }

  const slug = slugify(validation.data.slug.trim());

  if (!slug) {
    return NextResponse.json({ error: "Slug cannot be empty" }, { status: 400 });
  }

  if (await isPostSlugTaken(slug)) {
    return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  }

  let publishedAt: string | null;

  try {
    publishedAt = parseDateToIso(validation.data.publishedAt);
  } catch (error) {
    return NextResponse.json({ error: "Invalid publishedAt value" }, { status: 400 });
  }

  if (validation.data.status === "published" && !publishedAt) {
    publishedAt = new Date().toISOString();
  }

  if (validation.data.status === "draft") {
    publishedAt = null;
  }

  const tagIds = normalizeIds(validation.data.tagIds);

  if (tagIds.length > 0) {
    const missingTagIds = await findMissingTagIds(tagIds);

    if (missingTagIds.length > 0) {
      return NextResponse.json(
        {
          error: "Some tags do not exist",
          missingTagIds,
        },
        { status: 400 },
      );
    }
  }

  try {
    const post = await createPost({
      title,
      slug,
      excerpt: validation.data.excerpt ?? null,
      content: validation.data.content ?? null,
      status: validation.data.status,
      publishedAt,
      tagIds,
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error("Failed to create post", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
