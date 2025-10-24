const NON_ALPHANUMERIC_REGEX = /[^a-z0-9\s-]/g;
const WHITESPACE_REGEX = /\s+/g;
const MULTIPLE_DASH_REGEX = /-+/g;

export const slugify = (value: string): string => {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return "";
  }

  return trimmed
    .replace(NON_ALPHANUMERIC_REGEX, "")
    .replace(WHITESPACE_REGEX, "-")
    .replace(MULTIPLE_DASH_REGEX, "-")
    .replace(/^-|-$/g, "");
};
