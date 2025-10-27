const ensureLeadingSlash = (value: string): string => (value.startsWith("/") ? value : `/${value}`);

const normalizeSlug = (slug: string): string => {
  if (!slug) {
    return "";
  }

  return slug.trim().replace(/^\/+/, "");
};

export const buildPostPath = (slug: string): string => {
  const normalized = normalizeSlug(slug);

  if (!normalized) {
    return "/";
  }

  return ensureLeadingSlash(normalized);
};

export { ensureLeadingSlash };
