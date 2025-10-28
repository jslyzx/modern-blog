import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isBulkPostAction, performBulkPostAction, type BulkPostAction } from "@/lib/admin/posts";

const unauthorized = () => NextResponse.json({ error: "未授权" }, { status: 401 });

const parseIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueIds = new Set<number>();

  for (const element of value) {
    let candidate: number | null = null;

    if (typeof element === "number") {
      candidate = element;
    } else if (typeof element === "string") {
      const parsed = Number.parseInt(element, 10);
      if (Number.isFinite(parsed)) {
        candidate = parsed;
      }
    }

    if (candidate === null || !Number.isFinite(candidate)) {
      continue;
    }

    const normalized = Math.trunc(candidate);

    if (normalized > 0) {
      uniqueIds.add(normalized);
    }
  }

  return Array.from(uniqueIds);
};

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.warn("Failed to parse bulk post action payload", error);
    return NextResponse.json({ error: "请求载荷无效" }, { status: 400 });
  }

  const actionValue = (payload as { action?: unknown })?.action;
  const idsValue = (payload as { ids?: unknown })?.ids;

  if (!isBulkPostAction(actionValue)) {
    return NextResponse.json({ error: "操作类型无效" }, { status: 400 });
  }

  const action = actionValue as BulkPostAction;
  const ids = parseIds(idsValue);

  if (!ids.length) {
    return NextResponse.json({ error: "请选择要操作的文章" }, { status: 400 });
  }

  try {
    const result = await performBulkPostAction(ids, action);

    return NextResponse.json({
      success: true,
      successCount: result.successCount,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Failed to perform bulk post action", { action, ids, error });
    return NextResponse.json({ error: "批量操作失败" }, { status: 500 });
  }
}
