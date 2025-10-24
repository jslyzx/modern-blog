import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { findMissingPostIds } from "@/lib/posts";
import { slugify } from "@/lib/slug";
import {
  deleteTagRecord,
  getTagById,
  getTagPostIds,
  isTagSlugTaken,
  replaceTagPostAssociations,
  updateTagRecord,
} from "@/lib/tags";

const updateTagSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    slug: z.string().min(1).max(120).optional(),
    postIds: z.array(z.number().int().positive()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

const normalizeIds = (ids?: number[]): number[] =>
  Array.from(new Set((ids ?? []).filter((value) => Number.isInteger(value) && value > 0)));

const buildValidationErrorResponse = (error: z.ZodError) =>
  NextResponse.json(
    {
      error: "Invalid tag payload",
      details: error.flatten(),
    },
    { status: 400 },
  );

const parseTagId = (value: string): number | null => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

export async function GET(_request: NextRequest, context: { params: { id: string } }) {
  const tagId = parseTagId(context.params.id);

  if (!tagId) {
    return NextResponse.json({ error: "Invalid tag id" }, { status: 400 });
  }

  try {
    const tag = await getTagById(tagId);

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    const postIds = await getTagPostIds(tagId);

    return NextResponse.json({
      tag: {
        ...tag,
        usageCount: postIds.length,
      },
      postIds,
    });
  } catch (error) {
    console.error("Failed to load tag", error);
    return NextResponse.json({ error: "Failed to load tag" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: { params: { id: string } }) {
  const tagId = parseTagId(context.params.id);

  if (!tagId) {
    return NextResponse.json({ error: "Invalid tag id" }, { status: 400 });
  }

  const existingTag = await getTagById(tagId);

  if (!existingTag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("Failed to parse tag update payload", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = updateTagSchema.safeParse(payload);

  if (!validation.success) {
    return buildValidationErrorResponse(validation.error);
  }

  const updates: { name?: string; slug?: string } = {};

  if (validation.data.name !== undefined) {
    const trimmed = validation.data.name.trim();

    if (!trimmed) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }

    updates.name = trimmed;
  }

  let normalizedSlug: string | undefined;

  if (validation.data.slug !== undefined) {
    const trimmed = validation.data.slug.trim();

    if (!trimmed) {
      return NextResponse.json({ error: "Slug cannot be empty" }, { status: 400 });
    }

    normalizedSlug = slugify(trimmed);

    if (!normalizedSlug) {
      return NextResponse.json({ error: "Slug cannot be empty" }, { status: 400 });
    }

    if (normalizedSlug !== existingTag.slug && (await isTagSlugTaken(normalizedSlug, tagId))) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }

    updates.slug = normalizedSlug;
  }

  const postIds =
    validation.data.postIds !== undefined ? normalizeIds(validation.data.postIds) : undefined;

  if (postIds && postIds.length > 0) {
    const missingPostIds = await findMissingPostIds(postIds);

    if (missingPostIds.length > 0) {
      return NextResponse.json(
        {
          error: "Some posts do not exist",
          missingPostIds,
        },
        { status: 400 },
      );
    }
  }

  try {
    const updated = await updateTagRecord(tagId, updates);

    if (!updated) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (postIds !== undefined) {
      await replaceTagPostAssociations(tagId, postIds);
    }

    const associatedPostIds = await getTagPostIds(tagId);

    return NextResponse.json({
      tag: {
        ...updated,
        usageCount: associatedPostIds.length,
      },
      postIds: associatedPostIds,
    });
  } catch (error) {
    console.error("Failed to update tag", error);
    return NextResponse.json({ error: "Failed to update tag" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  const tagId = parseTagId(context.params.id);

  if (!tagId) {
    return NextResponse.json({ error: "Invalid tag id" }, { status: 400 });
  }

  try {
    const deleted = await deleteTagRecord(tagId);

    if (!deleted) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete tag", error);
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
  }
}
