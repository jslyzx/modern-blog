import { NextResponse } from "next/server";

import { apiErrors } from "@/lib/api/errors";
import { auth } from "@/auth";
import {
  getSiteSettings,
  isSiteSettingKey,
  SITE_SETTING_KEYS,
  upsertSetting,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

const unauthorized = () => apiErrors.unauthorized();

const unsupportedKey = () => apiErrors.badRequest("不支持的设置项", "INVALID_SETTING_KEY");

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
    return apiErrors.badRequest("请求载荷无效", "INVALID_PAYLOAD");
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
        return apiErrors.badRequest("站点标题不能为空", "VALIDATION_ERROR");
      }

      normalized = rawValue.trim();

      if (!normalized) {
        return apiErrors.badRequest("站点标题不能为空", "VALIDATION_ERROR");
      }
      break;
    }
    case "site_description": {
      if (rawValue === null) {
        normalized = null;
        break;
      }

      if (typeof rawValue !== "string") {
        return apiErrors.badRequest("站点描述格式不正确", "VALIDATION_ERROR");
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
        return apiErrors.badRequest("默认分享图像格式不正确", "VALIDATION_ERROR");
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
        return apiErrors.badRequest("站点地址格式不正确", "VALIDATION_ERROR");
      }

      normalized = parseBaseUrl(rawValue);

      if (!normalized) {
        return apiErrors.badRequest("站点地址无效", "INVALID_URL");
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
    return apiErrors.internal("保存设置失败", "SAVE_SETTINGS_FAILED");
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
    return apiErrors.internal("获取站点设置失败", "GET_SETTINGS_FAILED");
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  return handleWrite(request);
}

export async function PUT(request: Request): Promise<NextResponse> {
  return handleWrite(request);
}
