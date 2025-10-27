import { customAlphabet } from "nanoid";
import { pinyin } from "pinyin-pro";

const RANDOM_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const RANDOM_ID_LENGTH = 6;

const nanoid = customAlphabet(RANDOM_ID_ALPHABET, RANDOM_ID_LENGTH);
const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const NORMALIZED_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

const toSlugSource = (input: string | null | undefined): string => {
  if (typeof input === "string") {
    return input;
  }

  if (input === null || input === undefined) {
    return "";
  }

  return String(input);
};

export const randomSlugId = (): string => nanoid();

export const toPinyinSlug = (input: string | null | undefined): string => {
  const source = toSlugSource(input);

  if (!source.trim()) {
    return "";
  }

  const converted = toPinyinText(source);
  return normalizeSlugValue(converted || source);
};

export const isNormalizedSlug = (slug: string | null | undefined): boolean => {
  const candidate = toSlugSource(slug);

  if (!candidate) {
    return false;
  }

  if (candidate.trim() !== candidate) {
    return false;
  }

  return NORMALIZED_SLUG_REGEX.test(candidate);
};

export const generateSlug = (input: string | null | undefined): string => {
  const normalized = toPinyinSlug(input);

  if (normalized) {
    return normalized;
  }

  return `post-${randomSlugId()}`;
};
