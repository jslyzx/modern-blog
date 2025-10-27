import { buildPostPath, ensureLeadingSlash } from "./paths";

export { buildPostPath } from "./paths";

const FALLBACK_SITE_ORIGIN = "https://modern-blog.example.com";
const FALLBACK_SITE_NAME = "Modern Blog";
const FALLBACK_SITE_DESCRIPTION = "Insights and stories from Modern Blog.";
const FALLBACK_OG_IMAGE_PATH = "/globe.svg";

let cachedOrigin: string | null = null;
let cachedSiteBaseUrl: URL | null | undefined;

const ensureProtocol = (value: string): string => {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://${value}`;
};

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

export const getSiteOrigin = (): string => {
  if (cachedOrigin) {
    return cachedOrigin;
  }

  const rawCandidate =
    process.env.SITE_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.APP_ORIGIN ??
    process.env.VERCEL_URL ??
    "";

  if (!rawCandidate) {
    cachedOrigin = FALLBACK_SITE_ORIGIN;
    return cachedOrigin;
  }

  try {
    const normalized = ensureProtocol(rawCandidate.trim());
    const resolved = new URL(normalized);
    cachedOrigin = resolved.origin;
  } catch (error) {
    console.warn("Unable to determine site origin from environment", {
      error,
    });
    cachedOrigin = FALLBACK_SITE_ORIGIN;
  }

  return cachedOrigin;
};

export const getSiteBaseUrl = (): URL | null => {
  if (cachedSiteBaseUrl !== undefined) {
    return cachedSiteBaseUrl;
  }

  const candidate = process.env.SITE_BASE_URL?.trim();

  if (!candidate) {
    cachedSiteBaseUrl = null;
    return cachedSiteBaseUrl;
  }

  try {
    const normalized = ensureProtocol(candidate);
    cachedSiteBaseUrl = new URL(normalized);
  } catch (error) {
    console.warn("Invalid SITE_BASE_URL provided", {
      candidate,
      error,
    });
    cachedSiteBaseUrl = null;
  }

  return cachedSiteBaseUrl;
};

export const buildSiteUrl = (path: string): string => {
  const normalizedPath = ensureLeadingSlash(path || "/");
  const baseUrl = getSiteBaseUrl();

  if (!baseUrl) {
    return normalizedPath;
  }

  const base = stripTrailingSlash(baseUrl.toString());

  return `${base}${normalizedPath}`;
};

export const buildPostUrl = (slug: string): string => buildSiteUrl(buildPostPath(slug));

export const getMetadataBase = (): URL => new URL(getSiteOrigin());

export const createAbsoluteUrl = (pathOrUrl: string): string => {
  const candidate = pathOrUrl?.trim();

  if (!candidate) {
    const baseUrl = getSiteBaseUrl();

    if (baseUrl) {
      const base = stripTrailingSlash(baseUrl.toString());
      return base || baseUrl.toString();
    }

    return getSiteOrigin();
  }

  try {
    return new URL(candidate).toString();
  } catch {
    // not an absolute URL, fall through to treat as a path relative to the site
  }

  const siteSpecific = buildSiteUrl(candidate);

  try {
    return new URL(siteSpecific).toString();
  } catch {
    // siteSpecific is relative, fall back to using the origin
  }

  return new URL(siteSpecific, getSiteOrigin()).toString();
};

export const ensureAbsoluteUrl = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return createAbsoluteUrl(trimmed);
  }
};

export const getSiteName = (): string => {
  const candidate = process.env.NEXT_PUBLIC_SITE_NAME ?? process.env.SITE_NAME;
  const trimmed = candidate?.trim();

  if (trimmed) {
    return trimmed;
  }

  return FALLBACK_SITE_NAME;
};

export const getSiteDescription = (): string => {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION ?? process.env.SITE_DESCRIPTION;
  const trimmed = candidate?.trim();

  if (trimmed) {
    return trimmed;
  }

  return FALLBACK_SITE_DESCRIPTION;
};

export const getOgImageFallback = (): string => createAbsoluteUrl(FALLBACK_OG_IMAGE_PATH);
