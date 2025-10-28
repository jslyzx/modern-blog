import "server-only";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { revalidateTag, unstable_cache } from "next/cache";

import { query } from "@/lib/db";

export const SETTINGS_CACHE_TAG = "settings";

export const SITE_SETTING_KEYS = [
  "site_title",
  "site_description",
  "default_og_image",
  "site_base_url",
] as const;

const SITE_SETTING_KEY_SET = new Set<string>(SITE_SETTING_KEYS);

export type SiteSettingKey = (typeof SITE_SETTING_KEYS)[number];

export type SettingsMap = Record<string, string | null>;

interface SettingRow extends RowDataPacket {
  k: string;
  v: string | null;
}

const fetchAllSettings = async (): Promise<SettingsMap> => {
  const rows = await query<SettingRow[]>("SELECT k, v FROM settings");
  const map: SettingsMap = {};

  for (const row of rows) {
    if (typeof row.k !== "string" || !row.k) {
      continue;
    }

    map[row.k] = row.v ?? null;
  }

  return map;
};

const getCachedSettings = unstable_cache(fetchAllSettings, ["settings:all"], {
  tags: [SETTINGS_CACHE_TAG],
});

export const getAllSettings = async (): Promise<SettingsMap> => getCachedSettings();

export const getSettingsByKeys = async <T extends readonly string[]>(
  keys: T,
): Promise<Record<T[number], string | null>> => {
  const allSettings = await getAllSettings();
  const result: Partial<Record<string, string | null>> = {};

  for (const key of keys) {
    result[key] = allSettings[key] ?? null;
  }

  return result as Record<T[number], string | null>;
};

export const getSiteSettings = async (): Promise<Record<SiteSettingKey, string | null>> => {
  const settings = await getSettingsByKeys(SITE_SETTING_KEYS);
  return settings as Record<SiteSettingKey, string | null>;
};

export const isSiteSettingKey = (value: unknown): value is SiteSettingKey =>
  typeof value === "string" && SITE_SETTING_KEY_SET.has(value);

export const upsertSetting = async (key: string, value: string | null): Promise<void> => {
  if (value === null) {
    await query<ResultSetHeader>("DELETE FROM settings WHERE `k` = ?", [key]);
    
  } else {
    await query<ResultSetHeader>("REPLACE INTO settings (`k`, `v`) VALUES (?, ?)", [key, value]);
  }

  await revalidateTag(SETTINGS_CACHE_TAG);
};
