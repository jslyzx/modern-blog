import { NextResponse } from "next/server";

import { apiErrors } from "@/lib/api/errors";
import { auth } from "@/auth";
import {
  createTag,
  isTagNameTaken,
  listTags,
  normalizeTagName,
  type TagRecord,
} from "@/lib/tags";

export const dynamic = "force-dynamic";

const unauthorized = () => apiErrors.unauthorized();

const serializeTag = (tag: TagRecord) => ({
  id: tag.id,
  name: tag.name,
  slug: tag.slug,
  postCount: tag.postCount,
  createdAt: tag.createdAt ? tag.createdAt.toISOString() : null,
  updatedAt: tag.updatedAt ? tag.updatedAt.toISOString() : null,
});

const parsePageParam = (value: string | null): number => {
  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const parsePageSizeParam = (value: string | null): number => {
  if (!value) {
    return 20;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 20;
  }

  return Math.min(parsed, 100);
};

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const searchParam = normalizeTagName(url.searchParams.get("search") ?? "");
  const search = searchParam || null;
  const page = parsePageParam(url.searchParams.get("page"));
  const pageSize = parsePageSizeParam(url.searchParams.get("pageSize"));
  const offset = (page - 1) * pageSize;

  try {
    const { tags, total } = await listTags({ search, limit: pageSize, offset });
    const serialized = tags.map(serializeTag);
    const pageCount = pageSize > 0 ? Math.ceil(total / pageSize) : 0;

    return NextResponse.json({
      tags: serialized,
      pagination: {
        total,
        page,
        pageSize,
        pageCount,
        hasNextPage: page < pageCount,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Failed to list tags", { search, page, pageSize, error });
    return apiErrors.internal("获取标签列表失败", "LIST_TAGS_FAILED");
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.warn("Failed to parse POST body", error);
    return apiErrors.badRequest("请求载荷无效", "INVALID_PAYLOAD");
  }

  const rawName = (payload as { name?: unknown })?.name;
  const name = normalizeTagName(rawName ?? "");

  if (!name) {
    return apiErrors.badRequest("标签名称不能为空", "VALIDATION_ERROR");
  }

  try {
    if (await isTagNameTaken(name)) {
      return apiErrors.badRequest("标签名称已存在", "DUPLICATE_TAG_NAME");
    }

    const tag = await createTag({ name });

    return NextResponse.json({ tag: serializeTag(tag) }, { status: 201 });
  } catch (error) {
    console.error("Failed to create tag", { name, error });

    if (error instanceof Error && error.message.includes("already exists")) {
      return apiErrors.badRequest("标签名称已存在", "DUPLICATE_TAG_NAME");
    }

    return apiErrors.internal("创建标签失败", "CREATE_TAG_FAILED");
  }
}
