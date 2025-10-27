import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { deleteTag, getTagById, updateTag } from "@/lib/admin/tags";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const payloadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
});

const normalize = (value: string): string => value.trim();

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
    return NextResponse.json({ error: "Invalid tag id" }, { status: 400 });
  }

  const tag = await getTagById(id);

  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  return NextResponse.json({ data: tag });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = resolveId(context);

  if (!id) {
    return NextResponse.json({ error: "Invalid tag id" }, { status: 400 });
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

  try {
    const tag = await updateTag(id, {
      name: normalize(parsed.data.name),
      slug: normalize(parsed.data.slug),
    });

    return NextResponse.json({ data: tag });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;

    if (code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Slug must be unique" }, { status: 409 });
    }

    console.error("Failed to update tag", error);
    return NextResponse.json({ error: "Failed to update tag" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = resolveId(context);

  if (!id) {
    return NextResponse.json({ error: "Invalid tag id" }, { status: 400 });
  }

  try {
    const deleted = await deleteTag(id);

    if (!deleted) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete tag", error);
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
  }
}
