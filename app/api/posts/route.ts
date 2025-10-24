import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createPost, listPosts } from "@/lib/posts";
import { slugify } from "@/lib/slug";
import { postCreateSchema, postStatusSchema } from "@/lib/validation/post";
import type { PostStatus } from "@/types/post";

const parseNumber = (value: string | null, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const search = url.searchParams.get("search") ?? undefined;
  const pageParam = url.searchParams.get("page");
  const pageSizeParam = url.searchParams.get("pageSize");

  let status: PostStatus | undefined;

  if (statusParam) {
    const parseResult = postStatusSchema.safeParse(statusParam);

    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    status = parseResult.data;
  }

  const page = Math.max(parseNumber(pageParam, 1), 1);
  const pageSize = Math.max(Math.min(parseNumber(pageSizeParam, 20), 100), 1);

  try {
    const response = await listPosts({ status, search, page, pageSize });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to list posts", error);
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();

    if (raw && typeof raw.slug === "string") {
      const trimmed = raw.slug.trim();
      raw.slug = trimmed ? slugify(trimmed) : undefined;
    }

    if (raw && typeof raw.title === "string") {
      const trimmedTitle = raw.title.trim();
      raw.title = trimmedTitle.length > 0 ? trimmedTitle : null;
    }

    if (raw && typeof raw.content === "string") {
      raw.content = raw.content.trim().length > 0 ? raw.content : null;
    }

    if (raw && typeof raw.metadata === "string") {
      try {
        raw.metadata = JSON.parse(raw.metadata);
      } catch (error) {
        console.warn("Failed to parse metadata from request", error);
        raw.metadata = null;
      }
    }

    if (raw && typeof raw.tags === "string") {
      raw.tags = raw.tags
        .split(",")
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0);
    }

    const parsed = postCreateSchema.parse(raw);

    const post = await createPost(parsed);

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid post payload",
          details: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
        },
        { status: 422 },
      );
    }

    console.error("Failed to create post", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
