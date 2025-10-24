import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { deletePost, getPostById, isPostSlugTaken, updatePost } from "@/lib/posts";
import { slugify } from "@/lib/slug";
import { findMissingTagIds } from "@/lib/tags";

const updatePostSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    slug: z.string().min(1).max(200).optional(),
    excerpt: z.string().max(600).optional().nullable(),
    content: z.string().optional().nullable(),
    status: z.enum(["draft", "published"]).optional(),
    publishedAt: z.string().optional().nullable(),
    tagIds: z.array(z.number().int().positive()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

const normalizeIds = (ids?: number[]): number[] =>
  Array.from(new Set((ids ?? []).filter((value) => Number.isInteger(value) && value > 0)));

const buildValidationErrorResponse = (error: z.ZodError) =>
  NextResponse.json(
    {
      error: "Invalid post payload",
      details: error.flatten(),
    },
    { status: 400 },
  );

const parseDateToIso = (value: string): string => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date");
  }

  return parsed.toISOString();
};

const parsePostId = (value: string): number | null => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

export async function GET(_request: NextRequest, context: { params: { id: string } }) {
  const postId = parsePostId(context.params.id);

  if (!postId) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  try {
    const post = await getPostById(postId);

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error("Failed to load post", error);
    return NextResponse.json({ error: "Failed to load post" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: { params: { id: string } }) {
  const postId = parsePostId(context.params.id);

  if (!postId) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  const existingPost = await getPostById(postId);

  if (!existingPost) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("Failed to parse post update payload", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = updatePostSchema.safeParse(payload);

  if (!validation.success) {
    return buildValidationErrorResponse(validation.error);
  }

  const updates: {
    title?: string;
    slug?: string;
    excerpt?: string | null;
    content?: string | null;
    status?: "draft" | "published";
    publishedAt?: string | null;
    tagIds?: number[];
  } = {};

  if (validation.data.title !== undefined) {
    const trimmed = validation.data.title.trim();

    if (!trimmed) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }

    updates.title = trimmed;
  }

  if (validation.data.slug !== undefined) {
    const trimmed = validation.data.slug.trim();

    if (!trimmed) {
      return NextResponse.json({ error: "Slug cannot be empty" }, { status: 400 });
    }

    const normalizedSlug = slugify(trimmed);

    if (!normalizedSlug) {
      return NextResponse.json({ error: "Slug cannot be empty" }, { status: 400 });
    }

    if (normalizedSlug !== existingPost.slug && (await isPostSlugTaken(normalizedSlug, postId))) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }

    updates.slug = normalizedSlug;
  }

  if (validation.data.excerpt !== undefined) {
    updates.excerpt = validation.data.excerpt ?? null;
  }

  if (validation.data.content !== undefined) {
    updates.content = validation.data.content ?? null;
  }

  if (validation.data.status !== undefined) {
    updates.status = validation.data.status;
  }

  let publishedAtToApply: string | null | undefined;

  if (validation.data.publishedAt !== undefined) {
    if (validation.data.publishedAt === null) {
      publishedAtToApply = null;
    } else {
      try {
        publishedAtToApply = parseDateToIso(validation.data.publishedAt);
      } catch (error) {
        return NextResponse.json({ error: "Invalid publishedAt value" }, { status: 400 });
      }
    }
  }

  const nextStatus = updates.status ?? existingPost.status;

  if (nextStatus === "draft") {
    publishedAtToApply = publishedAtToApply ?? null;
  } else if (nextStatus === "published") {
    if (publishedAtToApply === undefined) {
      publishedAtToApply = existingPost.publishedAt ?? new Date().toISOString();
    } else if (publishedAtToApply === null) {
      publishedAtToApply = new Date().toISOString();
    }
  }

  if (publishedAtToApply !== undefined) {
    updates.publishedAt = publishedAtToApply;
  }

  if (validation.data.tagIds !== undefined) {
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

    updates.tagIds = tagIds;
  }

  try {
    const updated = await updatePost(postId, updates);

    if (!updated) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ post: updated });
  } catch (error) {
    console.error("Failed to update post", error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  const postId = parsePostId(context.params.id);

  if (!postId) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  try {
    const deleted = await deletePost(postId);

    if (!deleted) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete post", error);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
