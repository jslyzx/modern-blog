import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { createTag, listTags } from "@/lib/admin/tags";

const payloadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
});

const normalize = (value: string): string => value.trim();

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tags = await listTags();

  return NextResponse.json({ data: tags });
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

  try {
    const tag = await createTag({
      name: normalize(parsed.data.name),
      slug: normalize(parsed.data.slug),
    });

    return NextResponse.json({ data: tag }, { status: 201 });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;

    if (code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Slug must be unique" }, { status: 409 });
    }

    console.error("Failed to create tag", error);
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
  }
}
