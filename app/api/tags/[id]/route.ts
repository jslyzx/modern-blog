import { NextResponse } from "next/server";

import { apiErrors } from "@/lib/api/errors";
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

const unauthorized = () => apiErrors.unauthorized();

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
    return apiErrors.badRequest("标签 ID 无效", "INVALID_IDENTIFIER");
  }

  try {
    const tag = await getTagById(tagId);

    if (!tag) {
      return apiErrors.notFound("未找到标签", "TAG_NOT_FOUND");
    }

    return NextResponse.json({ tag: serializeTag(tag) });
  } catch (error) {
    console.error("Failed to load tag", { tagId, error });
    return apiErrors.internal("获取标签失败", "GET_TAG_FAILED");
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const tagId = parseId(context.params.id);

  if (!tagId) {
    return apiErrors.badRequest("标签 ID 无效", "INVALID_IDENTIFIER");
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.warn("Failed to parse PUT body", error);
    return apiErrors.badRequest("请求载荷无效", "INVALID_PAYLOAD");
  }

  const rawName = (payload as { name?: unknown })?.name;
  const name = normalizeTagName(rawName ?? "");

  if (!name) {
    return apiErrors.badRequest("标签名称不能为空", "VALIDATION_ERROR");
  }

  try {
    if (await isTagNameTaken(name, tagId)) {
      return apiErrors.badRequest("标签名称已存在", "DUPLICATE_TAG_NAME");
    }

    const tag = await updateTag(tagId, { name });

    if (!tag) {
      return apiErrors.notFound("未找到标签", "TAG_NOT_FOUND");
    }

    return NextResponse.json({ tag: serializeTag(tag) });
  } catch (error) {
    console.error("Failed to update tag", { tagId, error });

    if (error instanceof Error && error.message.includes("already exists")) {
      return apiErrors.badRequest("标签名称已存在", "DUPLICATE_TAG_NAME");
    }

    return apiErrors.internal("更新标签失败", "UPDATE_TAG_FAILED");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const tagId = parseId(context.params.id);

  if (!tagId) {
    return apiErrors.badRequest("标签 ID 无效", "INVALID_IDENTIFIER");
  }

  try {
    const deleted = await deleteTag(tagId);

    if (!deleted) {
      return apiErrors.notFound("未找到标签", "TAG_NOT_FOUND");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete tag", { tagId, error });
    return apiErrors.internal("删除标签失败", "DELETE_TAG_FAILED");
  }
}
