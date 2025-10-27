import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  deleteTag,
  getTagById,
  isTagNameTaken,
  normalizeTagName,
  type TagRecord,
  updateTag,
} from "@/lib/tags";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id?: string | string[];
  };
};

const unauthorized = () => NextResponse.json({ error: "未授权" }, { status: 401 });

const serializeTag = (tag: TagRecord) => ({
  id: tag.id,
  name: tag.name,
  slug: tag.slug,
  postCount: tag.postCount,
  createdAt: tag.createdAt ? tag.createdAt.toISOString() : null,
  updatedAt: tag.updatedAt ? tag.updatedAt.toISOString() : null,
});

const parseId = (value: string | string[] | undefined): number | null => {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const tagId = parseId(context.params.id);

  if (!tagId) {
    return NextResponse.json({ error: "标签 ID 无效" }, { status: 400 });
  }

  try {
    const tag = await getTagById(tagId);

    if (!tag) {
      return NextResponse.json({ error: "未找到标签" }, { status: 404 });
    }

    return NextResponse.json({ tag: serializeTag(tag) });
  } catch (error) {
    console.error("Failed to load tag", { tagId, error });
    return NextResponse.json({ error: "获取标签失败" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const tagId = parseId(context.params.id);

  if (!tagId) {
    return NextResponse.json({ error: "标签 ID 无效" }, { status: 400 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.warn("Failed to parse PUT body", error);
    return NextResponse.json({ error: "请求载荷无效" }, { status: 400 });
  }

  const rawName = (payload as { name?: unknown })?.name;
  const name = normalizeTagName(rawName ?? "");

  if (!name) {
    return NextResponse.json({ error: "标签名称不能为空" }, { status: 400 });
  }

  try {
    if (await isTagNameTaken(name, tagId)) {
      return NextResponse.json({ error: "标签名称已存在" }, { status: 400 });
    }

    const tag = await updateTag(tagId, { name });

    if (!tag) {
      return NextResponse.json({ error: "未找到标签" }, { status: 404 });
    }

    return NextResponse.json({ tag: serializeTag(tag) });
  } catch (error) {
    console.error("Failed to update tag", { tagId, error });

    if (error instanceof Error && error.message.includes("already exists")) {
      return NextResponse.json({ error: "标签名称已存在" }, { status: 400 });
    }

    return NextResponse.json({ error: "更新标签失败" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const tagId = parseId(context.params.id);

  if (!tagId) {
    return NextResponse.json({ error: "标签 ID 无效" }, { status: 400 });
  }

  try {
    const deleted = await deleteTag(tagId);

    if (!deleted) {
      return NextResponse.json({ error: "未找到标签" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete tag", { tagId, error });
    return NextResponse.json({ error: "删除标签失败" }, { status: 500 });
  }
}
