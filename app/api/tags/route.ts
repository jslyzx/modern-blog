import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { findMissingPostIds } from "@/lib/posts";
import { slugify } from "@/lib/slug";
import {
  createTagRecord,
  getTagPostIds,
  isTagSlugTaken,
  listTagsWithUsage,
  replaceTagPostAssociations,
} from "@/lib/tags";

const createTagSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120).optional(),
  postIds: z.array(z.number().int().positive()).optional(),
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

export async function GET() {
  try {
    const tags = await listTagsWithUsage();
    return NextResponse.json({ tags });
  } catch (error) {
    console.error("Failed to list tags", error);
    return NextResponse.json({ error: "Failed to load tags" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("Failed to parse tag creation payload", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = createTagSchema.safeParse(payload);

  if (!validation.success) {
    return buildValidationErrorResponse(validation.error);
  }

  const name = validation.data.name.trim();

  if (!name) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }

  let slugInput = validation.data.slug?.trim();

  if (!slugInput) {
    slugInput = undefined;
  }

  let normalizedSlug = slugInput ? slugify(slugInput) : slugify(name);

  if (!normalizedSlug) {
    return NextResponse.json({ error: "Slug cannot be empty" }, { status: 400 });
  }

  if (await isTagSlugTaken(normalizedSlug)) {
    return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  }

  const postIds = normalizeIds(validation.data.postIds);

  if (postIds.length > 0) {
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
    const tag = await createTagRecord({ name, slug: normalizedSlug });

    if (postIds.length > 0) {
      await replaceTagPostAssociations(tag.id, postIds);
    }

    const associatedPostIds = await getTagPostIds(tag.id);

    return NextResponse.json(
      {
        tag: {
          ...tag,
          usageCount: associatedPostIds.length,
        },
        postIds: associatedPostIds,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create tag", error);
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
  }
}
