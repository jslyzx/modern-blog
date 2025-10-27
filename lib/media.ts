import { promises as fs } from "node:fs/promises";
import path from "node:path";

import { nanoid } from "nanoid";

import { IMAGE_MIME_EXTENSION_MAP } from "./media-config";

export interface MediaUpload {
  filepath: string;
  size: number;
  originalFilename?: string | null;
  mimetype?: string | null;
}

export interface MediaUploadResult {
  url: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  storagePath: string;
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

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const URL_PREFIX = "/uploads";

const MIME_EXTENSION_MAP = IMAGE_MIME_EXTENSION_MAP;

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

export class LocalMediaStorage implements MediaStorageProvider {
  async save(file: MediaUpload): Promise<MediaUploadResult> {
    const originalName = file.originalFilename ?? "upload";
    const sanitized = sanitizeFilename(originalName);
    const extensionFromName = path.extname(sanitized);
    const normalizedBase = extensionFromName ? sanitized.slice(0, -extensionFromName.length) : sanitized;
    const baseCandidate = normalizedBase || "file";
    const safeBase = baseCandidate.length > 64 ? baseCandidate.slice(0, 64) : baseCandidate;
    const guessedExtension = file.mimetype ? MIME_EXTENSION_MAP[file.mimetype] : undefined;
    const extension = extensionFromName || guessedExtension || "";

    const { storagePath, url, filename } = await buildTargetPath(safeBase, extension);
    await moveFile(file.filepath, storagePath);

    return {
      url,
      filename,
      sizeBytes: file.size,
      mimeType: file.mimetype ?? "application/octet-stream",
      storagePath,
    };
  }
}

