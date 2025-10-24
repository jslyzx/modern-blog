import { NextResponse } from "next/server";

import { incrementPostViewCount } from "@/lib/posts";

const parseId = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

type RouteContext = {
  params: { id: string };
};

export async function POST(_request: Request, context: RouteContext) {
  const id = parseId(context.params.id);

  if (id === null) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  try {
    const viewCount = await incrementPostViewCount(id);
    return NextResponse.json({ id, viewCount });
  } catch (error) {
    console.error(`Failed to update view count for post ${id}`, error);
    return NextResponse.json({ error: "Failed to update view count" }, { status: 500 });
  }
}
