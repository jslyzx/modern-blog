import * as fs from "node:fs/promises";
import path from "node:path";

import { nanoid } from "nanoid";
import sharp from "sharp";

import { IMAGE_MIME_EXTENSION_MAP } from "./media-config";

export interface MediaUpload {
  filepath: string;
  size: number;
  originalFilename?: string | null;
  mimetype?: string | null;
}

export interface GeneratedImageVariant {
  url: string;
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
  width: number | null;
  height: number | null;
}

export interface StoredImageVariant {
  url: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  sizeBytes: number | null;
}

export interface StoredImageMetadata {
  createdAt: string;
  original: StoredImageVariant;
  webp?: StoredImageVariant | null;
  blurDataUrl?: string | null;
}

export interface MediaUploadResult {
  url: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  storagePath: string;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
  metadataPath: string;
  webp?: GeneratedImageVariant | null;
}

export interface MediaStorageProvider {
  save(file: MediaUpload): Promise<MediaUploadResult>;
}

export interface AliyunOssConfiguration {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  region: string;
  baseUrl?: string;
}

export class AliyunOssMediaStorage implements MediaStorageProvider {
  constructor(private readonly config: AliyunOssConfiguration) {}

  async save(): Promise<MediaUploadResult> {
    const { bucket } = this.config;

    throw new Error(`Aliyun OSS media provider is not implemented yet for bucket "${bucket}".`);
  }
}

export const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
export const URL_PREFIX = "/uploads";
export const METADATA_FILE_EXTENSION = ".metadata.json";

const WEBP_EXTENSION = ".webp";

const BLUR_PREVIEW_WIDTH = 24;
const BLUR_PREVIEW_QUALITY = 32;

export const isSvgMimeType = (mimeType: string | null | undefined): boolean => mimeType === "image/svg+xml";

const sanitizeFilename = (filename: string) => {
  const withoutPath = path.basename(filename);
  const normalized = withoutPath
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.+/g, ".");
  const cleaned = normalized.replace(/^\.+/, "");

  return cleaned || "file";
};

const ensureUploadsDirectory = async (directory: string) => {
  await fs.mkdir(directory, { recursive: true });
};

const moveFile = async (source: string, destination: string) => {
  try {
    await fs.rename(source, destination);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "EXDEV") {
      const buffer = await fs.readFile(source);
      await fs.writeFile(destination, buffer);
      await fs.unlink(source);
      return;
    }

    throw error;
  }
};

const buildTargetPath = async (filenameBase: string, extension: string) => {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const directory = path.join(UPLOADS_DIR, year, month);
  await ensureUploadsDirectory(directory);

  const uniqueSuffix = nanoid(12);
  const base = filenameBase || "file";
  const finalName = extension ? `${base}-${uniqueSuffix}${extension}` : `${base}-${uniqueSuffix}`;

  return {
    storagePath: path.join(directory, finalName),
    url: `${URL_PREFIX}/${year}/${month}/${finalName}`,
    filename: finalName,
  };
};

export const getMetadataPathForStoragePath = (storagePath: string): string => {
  const parsed = path.parse(storagePath);
  return path.join(parsed.dir, `${parsed.name}${METADATA_FILE_EXTENSION}`);
};

const replaceExtension = (filePath: string, extension: string): string => {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${extension}`);
};

const replaceUrlExtension = (url: string, extension: string): string => {
  const parsed = path.posix.parse(url);
  const directory = parsed.dir || parsed.root || "";
  if (!directory) {
    return `${parsed.name}${extension}`;
  }
  return path.posix.join(directory, `${parsed.name}${extension}`);
};

const generateBlurDataUrl = async (storagePath: string): Promise<string | null> => {
  try {
    const buffer = await sharp(storagePath, { animated: true })
      .resize(BLUR_PREVIEW_WIDTH, BLUR_PREVIEW_WIDTH, { fit: "inside" })
      .toFormat("webp", { quality: BLUR_PREVIEW_QUALITY })
      .toBuffer();

    return `data:image/webp;base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.warn("Failed to generate blur placeholder", { storagePath, error });
    return null;
  }
};

const generateWebpVariant = async (
  sourcePath: string,
  url: string,
  width: number | null,
  height: number | null,
): Promise<GeneratedImageVariant | null> => {
  const webpStoragePath = replaceExtension(sourcePath, WEBP_EXTENSION);
  const webpUrl = replaceUrlExtension(url, WEBP_EXTENSION);

  try {
    await sharp(sourcePath, { animated: true })
      .toFormat("webp", { quality: 82, effort: 4 })
      .toFile(webpStoragePath);

    const stats = await fs.stat(webpStoragePath);

    return {
      url: webpUrl,
      storagePath: webpStoragePath,
      sizeBytes: stats.size,
      mimeType: "image/webp",
      width,
      height,
    };
  } catch (error) {
    console.warn("Failed to generate WebP variant", { sourcePath, webpStoragePath, error });
    return null;
  }
};

const parseSvgDimensions = async (filepath: string) => {
  try {
    const contents = await fs.readFile(filepath, "utf8");
    const widthMatch = contents.match(/width="([0-9.]+)(px)?"/i);
    const heightMatch = contents.match(/height="([0-9.]+)(px)?"/i);

    if (widthMatch && heightMatch) {
      const width = Number.parseFloat(widthMatch[1]);
      const height = Number.parseFloat(heightMatch[1]);

      if (Number.isFinite(width) && Number.isFinite(height)) {
        return {
          width,
          height,
        };
      }
    }

    const viewBoxMatch = contents.match(/viewBox="([0-9.\s-]+)"/i);

    if (viewBoxMatch) {
      const [, viewBox] = viewBoxMatch;
      const segments = viewBox
        .trim()
        .split(/\s+/)
        .map((segment) => Number.parseFloat(segment));

      if (segments.length === 4 && segments.every((value) => Number.isFinite(value))) {
        return {
          width: segments[2],
          height: segments[3],
        };
      }
    }
  } catch (error) {
    console.warn("Failed to parse SVG dimensions", { filepath, error });
  }

  return { width: null, height: null };
};

const toStoredVariant = (variant: GeneratedImageVariant | null | undefined): StoredImageVariant | null => {
  if (!variant) {
    return null;
  }

  return {
    url: variant.url,
    width: variant.width,
    height: variant.height,
    mimeType: variant.mimeType,
    sizeBytes: variant.sizeBytes ?? null,
  };
};

export class LocalMediaStorage implements MediaStorageProvider {
  async save(file: MediaUpload): Promise<MediaUploadResult> {
    const originalName = file.originalFilename ?? "upload";
    const sanitized = sanitizeFilename(originalName);
    const extensionFromName = path.extname(sanitized);
    const normalizedBase = extensionFromName ? sanitized.slice(0, -extensionFromName.length) : sanitized;
    const baseCandidate = normalizedBase || "file";
    const safeBase = baseCandidate.length > 64 ? baseCandidate.slice(0, 64) : baseCandidate;
    const guessedExtension = file.mimetype ? (IMAGE_MIME_EXTENSION_MAP as Record<string, string>)[file.mimetype] : undefined;
    const extension = extensionFromName || guessedExtension || "";

    const { storagePath, url, filename } = await buildTargetPath(safeBase, extension);
    await moveFile(file.filepath, storagePath);

    const mimeType = file.mimetype ?? "application/octet-stream";
    const metadataPath = getMetadataPathForStoragePath(storagePath);

    let width: number | null = null;
    let height: number | null = null;
    let blurDataUrl: string | null = null;
    let webpVariant: GeneratedImageVariant | null = null;

    if (isSvgMimeType(mimeType)) {
      const dimensions = await parseSvgDimensions(storagePath);
      width = dimensions.width;
      height = dimensions.height;
    } else {
      try {
        const metadata = await sharp(storagePath, { animated: true }).metadata();
        width = metadata.width ?? null;
        height = metadata.height ?? null;
      } catch (error) {
        console.warn("Failed to read image metadata", { storagePath, error });
      }

      blurDataUrl = await generateBlurDataUrl(storagePath);

      if (!isSvgMimeType(mimeType) && mimeType !== "image/webp") {
        webpVariant = await generateWebpVariant(storagePath, url, width, height);
      }
    }

    const storedMetadata: StoredImageMetadata = {
      createdAt: new Date().toISOString(),
      original: {
        url,
        width,
        height,
        mimeType,
        sizeBytes: file.size,
      },
      blurDataUrl,
    };

    const storedWebp = toStoredVariant(webpVariant);

    if (storedWebp) {
      storedMetadata.webp = storedWebp;
    }

    try {
      await fs.writeFile(metadataPath, JSON.stringify(storedMetadata, null, 2), "utf8");
    } catch (error) {
      console.warn("Failed to persist image metadata", { metadataPath, error });
    }

    return {
      url,
      filename,
      sizeBytes: file.size,
      mimeType,
      storagePath,
      width,
      height,
      blurDataUrl,
      metadataPath,
      webp: webpVariant,
    };
  }
}
