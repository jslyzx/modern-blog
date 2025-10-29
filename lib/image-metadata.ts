import * as fs from "node:fs/promises";
import path from "node:path";

import { cache } from "react";

import { URL_PREFIX, getMetadataPathForStoragePath, type StoredImageMetadata, type StoredImageVariant } from "@/lib/media";

const PUBLIC_DIR = path.join(process.cwd(), "public");

const normalizeUrlPath = (rawUrl: string): string | null => {
  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.pathname;
  } catch {
    // not an absolute URL
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

const resolveStoragePathFromUrl = (rawUrl: string): string | null => {
  const pathname = normalizeUrlPath(rawUrl);

  if (!pathname) {
    return null;
  }

  const normalized = path.posix.normalize(pathname);

  if (!normalized.startsWith(URL_PREFIX)) {
    return null;
  }

  const relative = normalized.slice(URL_PREFIX.length).replace(/^\/+/, "");

  if (!relative || relative.includes("..")) {
    return null;
  }

  const uploadsRoot = URL_PREFIX.replace(/^\//, "");
  const candidate = path.join(PUBLIC_DIR, uploadsRoot, relative);
  const normalizedCandidate = path.normalize(candidate);

  if (!normalizedCandidate.startsWith(path.join(PUBLIC_DIR, uploadsRoot))) {
    return null;
  }

  return normalizedCandidate;
};

const resolveMetadataPathFromUrl = (rawUrl: string): string | null => {
  const storagePath = resolveStoragePathFromUrl(rawUrl);

  if (!storagePath) {
    return null;
  }

  return getMetadataPathForStoragePath(storagePath);
};

const ensureFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const ensureOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
};

const sanitizeVariant = (input: unknown): StoredImageVariant | null => {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Partial<StoredImageVariant>;
  const url = ensureOptionalString(candidate.url);

  if (!url) {
    return null;
  }

  const mimeType = ensureOptionalString(candidate.mimeType) ?? "image/jpeg";
  const width = ensureFiniteNumber(candidate.width);
  const height = ensureFiniteNumber(candidate.height);
  const sizeBytes = ensureFiniteNumber(candidate.sizeBytes);

  return {
    url,
    width,
    height,
    mimeType,
    sizeBytes,
  };
};

const sanitizeMetadata = (input: unknown): StoredImageMetadata | null => {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Partial<StoredImageMetadata> & { createdAt?: unknown };
  const original = sanitizeVariant(candidate.original);

  if (!original) {
    return null;
  }

  const createdAt = ensureOptionalString(candidate.createdAt) ?? new Date().toISOString();
  const blurDataUrl = ensureOptionalString(candidate.blurDataUrl);
  const webp = sanitizeVariant(candidate.webp);

  const metadata: StoredImageMetadata = {
    createdAt,
    original,
  };

  if (blurDataUrl) {
    metadata.blurDataUrl = blurDataUrl;
  }

  if (webp) {
    metadata.webp = webp;
  }

  return metadata;
};

const readMetadataFile = async (metadataPath: string): Promise<StoredImageMetadata | null> => {
  try {
    const contents = await fs.readFile(metadataPath, "utf8");
    const parsed = JSON.parse(contents) as unknown;
    return sanitizeMetadata(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    console.warn("Failed to read image metadata", { metadataPath, error });
    return null;
  }
};

export const loadImageMetadata = cache(async (url: string | null | undefined): Promise<StoredImageMetadata | null> => {
  if (!url || typeof url !== "string") {
    return null;
  }

  const metadataPath = resolveMetadataPathFromUrl(url);

  if (!metadataPath) {
    return null;
  }

  const metadata = await readMetadataFile(metadataPath);

  if (!metadata) {
    return null;
  }

  return metadata;
});

export type LoadedImageMetadata = StoredImageMetadata;
