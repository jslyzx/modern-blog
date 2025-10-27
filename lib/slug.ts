import { customAlphabet } from "nanoid";
import { pinyin } from "pinyin-pro";

const RANDOM_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const RANDOM_ID_LENGTH = 6;

const nanoid = customAlphabet(RANDOM_ID_ALPHABET, RANDOM_ID_LENGTH);
const DIACRITICS_REGEX = /[\u0300-\u036f]/g;

const toPinyinText = (input: string): string => {
  const trimmed = input.trim();

  if (!trimmed) {
    return "";
  }

  const segments = pinyin(trimmed, {
    toneType: "none",
    type: "array",
    nonZh: "consecutive",
    v: true,
  });

  if (!Array.isArray(segments)) {
    return String(segments ?? "");
  }

  return segments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join(" ");
};

const normalizeSlugValue = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/[\s_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

export const randomSlugId = (): string => nanoid();

export const generateSlug = (input: string): string => {
  const source = typeof input === "string" ? input : String(input ?? "");

  const converted = toPinyinText(source);
  const normalized = normalizeSlugValue(converted || source);

  if (normalized) {
    return normalized;
  }

  return `post-${randomSlugId()}`;
};
