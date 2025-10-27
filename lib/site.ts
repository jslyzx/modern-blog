import "server-only";

import { unstable_cache } from "next/cache";

import { buildPostPath, ensureLeadingSlash } from "@/lib/paths";
import { getSiteSettings, SETTINGS_CACHE_TAG } from "@/lib/settings";

export { buildPostPath } from "@/lib/paths";

const FALLBACK_SITE_ORIGIN = "https://modern-blog.example.com";
const FALLBACK_SITE_NAME = "Modern Blog";
const FALLBACK_SITE_DESCRIPTION = "Insights and stories from Modern Blog.";
const FALLBACK_OG_IMAGE_PATH = "/globe.svg";

const ensureProtocol = (value: string): string => {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://${value}`;
};

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const normalizeOptional = (value?: string | null): string => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  return trimmed || "";
};

const parseUrlCandidate = (value?: string | null): URL | null => {
  const candidate = normalizeOptional(value);

  if (!candidate) {
    return null;
  }

  try {
    return new URL(ensureProtocol(candidate));
  } catch (error) {
    console.warn("Invalid URL candidate", {
      value: candidate,
      error,
    });
    return null;
  }
};

const determineOrigin = (baseUrl: URL | null, additionalCandidates: Array<string | null | undefined>): string => {
  if (baseUrl) {
    return baseUrl.origin;
  }

  for (const candidate of additionalCandidates) {
    const parsed = parseUrlCandidate(candidate);

    if (parsed) {
      return parsed.origin;
    }
  }

  return FALLBACK_SITE_ORIGIN;
};

const createAbsoluteUrlWithContext = (baseUrl: URL | null, origin: string, target: string): string => {
  const candidate = target.trim();

  if (!candidate) {
    if (baseUrl) {
      const base = stripTrailingSlash(baseUrl.toString());
      return base || baseUrl.origin;
    }

    return origin;
  }

  try {
    return new URL(candidate).toString();
  } catch {
    // fall through to treat as a path
  }

  const normalizedPath = ensureLeadingSlash(candidate);

  if (baseUrl) {
    const base = stripTrailingSlash(baseUrl.toString());
    return `${base}${normalizedPath}`;
  }

  return new URL(normalizedPath, origin).toString();
};

const ensureAbsoluteUrlWithContext = (
  baseUrl: URL | null,
  origin: string,
  value?: string | null,
): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return createAbsoluteUrlWithContext(baseUrl, origin, trimmed);
};

type LoadedSiteConfig = {
  siteName: string;
  siteDescription: string;
  baseUrl: URL | null;
  baseUrlString: string | null;
  origin: string;
  defaultOgImage: string;
  defaultOgImageSetting: string | null;
  siteBaseUrlSetting: string | null;
};

const loadSiteConfig = async (): Promise<LoadedSiteConfig> => {
  const settings = await getSiteSettings();

  const siteTitleSetting = normalizeOptional(settings.site_title);
  const envSiteTitle = normalizeOptional(process.env.NEXT_PUBLIC_SITE_NAME) || normalizeOptional(process.env.SITE_NAME);
  const siteName = siteTitleSetting || envSiteTitle || FALLBACK_SITE_NAME;

  const siteDescriptionSetting = normalizeOptional(settings.site_description);
  const envSiteDescription =
    normalizeOptional(process.env.NEXT_PUBLIC_SITE_DESCRIPTION) || normalizeOptional(process.env.SITE_DESCRIPTION);
  const siteDescription = siteDescriptionSetting || envSiteDescription || FALLBACK_SITE_DESCRIPTION;

  const siteBaseUrlSetting = normalizeOptional(settings.site_base_url);
  const envBaseUrl = normalizeOptional(process.env.SITE_BASE_URL);
  const baseUrl = parseUrlCandidate(siteBaseUrlSetting || envBaseUrl);
  const baseUrlString = baseUrl ? stripTrailingSlash(baseUrl.toString()) : null;

  const origin = determineOrigin(baseUrl, [
    envBaseUrl,
    normalizeOptional(process.env.NEXT_PUBLIC_SITE_URL),
    normalizeOptional(process.env.SITE_URL),
    normalizeOptional(process.env.APP_ORIGIN),
    normalizeOptional(process.env.VERCEL_URL),
  ]);

  const defaultOgImageSetting = normalizeOptional(settings.default_og_image);
  const defaultOgImageSource = defaultOgImageSetting || FALLBACK_OG_IMAGE_PATH;
  const defaultOgImage =
    ensureAbsoluteUrlWithContext(baseUrl, origin, defaultOgImageSource) ??
    createAbsoluteUrlWithContext(baseUrl, origin, FALLBACK_OG_IMAGE_PATH);

  return {
    siteName,
    siteDescription,
    baseUrl,
    baseUrlString,
    origin,
    defaultOgImage,
    defaultOgImageSetting: defaultOgImageSetting || null,
    siteBaseUrlSetting: siteBaseUrlSetting || null,
  };
};

const getCachedSiteConfig = unstable_cache(loadSiteConfig, ["site:config"], {
  tags: [SETTINGS_CACHE_TAG],
});

export type SiteConfig = LoadedSiteConfig;

export const getSiteConfig = async (): Promise<SiteConfig> => getCachedSiteConfig();

export const getSiteName = async (): Promise<string> => (await getSiteConfig()).siteName;

export const getSiteDescription = async (): Promise<string> => (await getSiteConfig()).siteDescription;

export const getOgImageFallback = async (): Promise<string> => (await getSiteConfig()).defaultOgImage;

export const getMetadataBase = async (): Promise<URL> => new URL((await getSiteConfig()).origin);

export const buildSiteUrlFromConfig = (config: SiteConfig, path: string): string => {
  const normalizedPath = ensureLeadingSlash(path || "/");

  if (config.baseUrlString) {
    return `${config.baseUrlString}${normalizedPath}`;
  }

  return normalizedPath;
};

export const buildSiteUrl = async (path: string): Promise<string> => buildSiteUrlFromConfig(await getSiteConfig(), path);

export const buildPostUrlFromConfig = (config: SiteConfig, slug: string): string =>
  buildSiteUrlFromConfig(config, buildPostPath(slug));

export const buildPostUrl = async (slug: string): Promise<string> => buildPostUrlFromConfig(await getSiteConfig(), slug);

export const createAbsoluteUrlFromConfig = (config: SiteConfig, pathOrUrl: string): string =>
  createAbsoluteUrlWithContext(config.baseUrl, config.origin, pathOrUrl);

export const createAbsoluteUrl = async (pathOrUrl: string): Promise<string> =>
  createAbsoluteUrlFromConfig(await getSiteConfig(), pathOrUrl);

export const ensureAbsoluteUrlFromConfig = (config: SiteConfig, value?: string | null): string | null =>
  ensureAbsoluteUrlWithContext(config.baseUrl, config.origin, value);

export const ensureAbsoluteUrl = async (value?: string | null): Promise<string | null> =>
  ensureAbsoluteUrlFromConfig(await getSiteConfig(), value);
