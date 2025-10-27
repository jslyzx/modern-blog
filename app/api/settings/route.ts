import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  getSiteSettings,
  isSiteSettingKey,
  SITE_SETTING_KEYS,
  upsertSetting,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "未授权" }, { status: 401 });

const unsupportedKey = () =>
  NextResponse.json({ error: "不支持的设置项" }, { status: 400 });

const parseBaseUrl = (value: string): string | null => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const candidate = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return url.toString();
  } catch (error) {
    console.warn("Invalid site_base_url provided", { value, error });
    return null;
  }
};

const handleWrite = async (request: Request) => {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  let payload: any;

  try {
    payload = await request.json();
  } catch (error) {
    console.warn("Failed to parse settings payload", { error });
    return NextResponse.json({ error: "请求载荷无效" }, { status: 400 });
  }

  const key = typeof payload?.key === "string" ? payload.key : "";

  if (!isSiteSettingKey(key)) {
    return unsupportedKey();
  }

  const rawValue = payload?.value ?? null;
  let normalized: string | null;

  switch (key) {
    case "site_title": {
      if (typeof rawValue !== "string") {
        return NextResponse.json({ error: "站点标题不能为空" }, { status: 400 });
      }

      normalized = rawValue.trim();

      if (!normalized) {
        return NextResponse.json({ error: "站点标题不能为空" }, { status: 400 });
      }
      break;
    }
    case "site_description": {
      if (rawValue === null) {
        normalized = null;
        break;
      }

      if (typeof rawValue !== "string") {
        return NextResponse.json({ error: "站点描述格式不正确" }, { status: 400 });
      }

      normalized = rawValue.trim() || null;
      break;
    }
    case "default_og_image": {
      if (rawValue === null) {
        normalized = null;
        break;
      }

      if (typeof rawValue !== "string") {
        return NextResponse.json({ error: "默认分享图像格式不正确" }, { status: 400 });
      }

      normalized = rawValue.trim() || null;
      break;
    }
    case "site_base_url": {
      if (rawValue === null) {
        normalized = null;
        break;
      }

      if (typeof rawValue !== "string") {
        return NextResponse.json({ error: "站点地址格式不正确" }, { status: 400 });
      }

      normalized = parseBaseUrl(rawValue);

      if (!normalized) {
        return NextResponse.json({ error: "站点地址无效" }, { status: 400 });
      }

      break;
    }
    default: {
      return unsupportedKey();
    }
  }

  try {
    await upsertSetting(key, normalized);
    const settings = await getSiteSettings();

    return NextResponse.json({ settings, updated: { key, value: normalized } });
  } catch (error) {
    console.error("Failed to update site setting", { key, error });
    return NextResponse.json({ error: "保存设置失败" }, { status: 500 });
  }
};

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  try {
    const settings = await getSiteSettings();
    const result: Record<string, string | null> = {};

    for (const key of SITE_SETTING_KEYS) {
      result[key] = settings[key] ?? null;
    }

    return NextResponse.json({ settings: result });
  } catch (error) {
    console.error("Failed to load site settings", { error });
    return NextResponse.json({ error: "获取站点设置失败" }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  return handleWrite(request);
}

export async function PUT(request: Request): Promise<NextResponse> {
  return handleWrite(request);
}
