import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { deletePost, getPostById, updatePost } from "@/lib/posts";
import { slugify } from "@/lib/slug";
import { postStatusSchema, postUpdateSchema } from "@/lib/validation/post";

const parseId = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

type RouteContext = {
  params: { id: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const id = parseId(context.params.id);

  if (id === null) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  try {
    const post = await getPostById(id);

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error(`Failed to fetch post ${id}`, error);
    return NextResponse.json({ error: "Failed to load post" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const id = parseId(context.params.id);

  if (id === null) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  try {
    const raw = await request.json();

    if (raw && typeof raw.slug === "string") {
      const trimmedSlug = raw.slug.trim();
      raw.slug = trimmedSlug.length > 0 ? slugify(trimmedSlug) : undefined;
    }

    if (raw && typeof raw.title === "string") {
      const trimmedTitle = raw.title.trim();
      raw.title = trimmedTitle.length > 0 ? trimmedTitle : null;
    }

    if (raw && typeof raw.content === "string") {
      raw.content = raw.content.trim().length > 0 ? raw.content : null;
    }

    if (raw && typeof raw.status === "string") {
      const statusResult = postStatusSchema.safeParse(raw.status);

      if (!statusResult.success) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }

      raw.status = statusResult.data;
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

    const parsed = postUpdateSchema.parse(raw);

    if (typeof parsed.editorId !== "number") {
      return NextResponse.json({ error: "editorId is required for updates" }, { status: 400 });
    }

    if (parsed.status === "published") {
      // Ensure slug is available before persisting
      parsed.slug = parsed.slug ?? (parsed.title ? slugify(parsed.title) : undefined);
    }

    const post = await updatePost(id, parsed);

    return NextResponse.json(post);
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

    console.error(`Failed to update post ${context.params.id}`, error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const id = parseId(context.params.id);

  if (id === null) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  try {
    await deletePost(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`Failed to delete post ${id}`, error);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
